import { API_URL, fetchWithTimeout } from './api';
import { getToken } from './storage';

// The signature call is a tiny JSON round-trip -- it should fail fast.
const SIGNATURE_TIMEOUT_MS = 30000;

// The upload itself gets a SIZE-SCALED deadline instead of one flat number.
// A single 60s cap was fine for 10MB images but is nowhere near enough for a
// 200MB video: even a healthy 2 MB/s connection needs ~100s, and weak campus
// WiFi (~300 KB/s) needs ~11 minutes. A flat cap large enough for the worst
// case would also mean a genuinely hung 2MB image sat there for 15 minutes
// before failing. Scaling by bytes keeps small uploads failing fast while
// giving big ones the room they actually need.
const MIN_UPLOAD_BYTES_PER_SEC = 300 * 1024; // slowest throughput we'll wait for
const MIN_UPLOAD_TIMEOUT_MS = 60000;         // floor, for small files
const MAX_UPLOAD_TIMEOUT_MS = 900000;        // 15min ceiling, so nothing hangs forever

// Deadline for uploading `bytes`. Callers that don't know the size pass the
// tier cap, so an unknown-size file is treated as the largest it's allowed
// to be rather than defaulting to the (far too short) floor.
function uploadTimeoutFor(bytes: number): number {
  const needed = Math.ceil(bytes / MIN_UPLOAD_BYTES_PER_SEC) * 1000;
  return Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.max(MIN_UPLOAD_TIMEOUT_MS, needed));
}

// Upload an image to Cloudinary directly and return its URL.
//
// This is how the web client does it, and it matters: the backend sits behind
// Railway's ~30s request timeout and isn't built to receive large files. Sending
// the file THROUGH the backend (multipart) hangs — which is exactly why image
// posts and photo stories never completed. We upload straight to Cloudinary and
// hand the backend only the resulting URL.
//
// folder must be one the backend whitelists: abukonn/posts, abukonn/stories, etc.
export async function uploadImage(uri: string, folder: string): Promise<string> {
  const { secure_url } = await uploadMedia(uri, folder, 'image');
  return secure_url;
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', '3gp']);

// Multi-media upload limits, tiered for the "increased upload limits" Pro
// perk. Free: 10MB image / 200MB video / 180s. Pro: 25MB / 400MB / 360s.
// Free's video allowance was raised from 50MB/60s -- 60s was far too short
// for the lecture clips and event footage testers actually post. Pro was
// raised in step (was 150MB/180s, which the new free tier would otherwise
// have matched or beaten) so the tier structure stays intact and Pro is
// still strictly the better deal.
// Checked client-side before the network request starts, so a huge file is
// rejected instantly instead of failing partway through (or wasting the
// person's data on an upload the backend would reject anyway). Kept as
// explicit tiers so the Pro values read in one place and the free→pro
// switch is a single flag.
const LIMITS = {
  free: { imageBytes: 10 * 1024 * 1024, videoBytes: 200 * 1024 * 1024, videoMs: 180000 },
  pro:  { imageBytes: 25 * 1024 * 1024, videoBytes: 400 * 1024 * 1024, videoMs: 360000 },
} as const;

// Picks the active tier. is_pro doesn't exist yet, so callers pass nothing
// and everyone gets free limits (Option A). PRO-GATE: once the app knows
// the user's Pro status, callers pass isPro and Pro users get the higher
// tier -- no other change needed.
function limitsFor(isPro?: boolean) {
  return isPro ? LIMITS.pro : LIMITS.free;
}

// Guess image vs video from a local file URI's extension. Good enough here:
// both the image picker and camera give us a real extension on the URI, and
// this only decides which Cloudinary endpoint/resource_type to use — the
// actual file bytes are what get uploaded either way, this doesn't inspect
// or trust anything the server would need to re-verify.
function guessMediaType(uri: string): 'image' | 'video' {
  const ext = uri.split('.').pop()?.toLowerCase().split('?')[0] ?? '';
  return VIDEO_EXTENSIONS.has(ext) ? 'video' : 'image';
}

// Upload an image OR video to Cloudinary directly, returning the URL plus
// (for video) the duration and an auto-generated thumbnail — both of which
// Cloudinary computes for us on upload, so post_media never has to guess.
// mediaType can be passed explicitly (e.g. the composer already knows which
// picker produced this file) or left to be auto-detected from the URI.
// fileSizeBytes, when the caller has it (expo-image-picker's asset.fileSize),
// is checked against the per-type cap before any network call is made.
// isPro (optional) selects the higher Pro limit tier; omitted = free tier.
export async function uploadMedia(
  uri: string,
  folder: string,
  mediaType?: 'image' | 'video',
  fileSizeBytes?: number | null,
  durationMs?: number | null,
  isPro?: boolean
): Promise<{ secure_url: string; media_type: 'image' | 'video'; duration_seconds: number | null; thumbnail_url: string | null }> {
  const type = mediaType ?? guessMediaType(uri);
  const limits = limitsFor(isPro);

  if (fileSizeBytes != null) {
    const cap = type === 'video' ? limits.videoBytes : limits.imageBytes;
    if (fileSizeBytes > cap) {
      const capMb = Math.round(cap / (1024 * 1024));
      throw new Error(`${type === 'video' ? 'Videos' : 'Images'} must be under ${capMb}MB.`);
    }
  }
  // Expo's picker reports video duration in milliseconds.
  if (type === 'video' && durationMs != null && durationMs > limits.videoMs) {
    throw new Error(`Videos can be up to ${limits.videoMs / 1000} seconds long.`);
  }

  const token = await getToken();

  // 1. Ask our backend to sign the upload (keeps the Cloudinary secret server-side).
  const sigRes = await fetchWithTimeout(
    `${API_URL}/api/stories/upload-signature?folder=${encodeURIComponent(folder)}`,
    { headers: { Authorization: `Bearer ${token}` } },
    SIGNATURE_TIMEOUT_MS,
  );
  if (!sigRes.ok) throw new Error('Could not start the upload.');
  const { signature, timestamp, api_key, cloud_name, folder: signedFolder } =
    (await sigRes.json()) as {
      signature: string; timestamp: number; api_key: string;
      cloud_name: string; folder: string;
    };

  // 2. Upload the file straight to Cloudinary, to the endpoint matching its
  // resource type — video/upload for video, image/upload for everything
  // else. Cloudinary requires this; posting a video to image/upload fails.
  const ext = uri.split('.').pop()?.split('?')[0] || (type === 'video' ? 'mp4' : 'jpg');
  const mime = type === 'video' ? `video/${ext === 'mov' ? 'quicktime' : ext}` : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  const fd = new FormData();
  fd.append('file', { uri, name: `upload.${ext}`, type: mime } as unknown as Blob);
  fd.append('api_key', api_key);
  fd.append('timestamp', String(timestamp));
  fd.append('signature', signature);
  fd.append('folder', signedFolder);

  const upRes = await fetchWithTimeout(
    `https://api.cloudinary.com/v1_1/${cloud_name}/${type}/upload`,
    { method: 'POST', body: fd },
    // Size-scaled: the caller's measured size when it has one, else the tier
    // cap for this media type (the largest this file is allowed to be).
    uploadTimeoutFor(fileSizeBytes ?? (type === 'video' ? limits.videoBytes : limits.imageBytes)),
  );
  if (!upRes.ok) throw new Error(type === 'video' ? 'Video upload failed.' : 'Image upload failed.');
  const data = (await upRes.json()) as {
    secure_url?: string; duration?: number;
  };
  if (!data.secure_url) throw new Error(type === 'video' ? 'Video upload failed.' : 'Image upload failed.');

  // Cloudinary auto-generates a JPG thumbnail for any uploaded video at a
  // predictable URL (swap the extension) — no separate request needed.
  const thumbnailUrl = type === 'video'
    ? data.secure_url.replace(/\.[a-zA-Z0-9]+$/, '.jpg')
    : null;

  return {
    secure_url: data.secure_url,
    media_type: type,
    duration_seconds: type === 'video' && data.duration ? Math.round(data.duration) : null,
    thumbnail_url: thumbnailUrl,
  };
}
