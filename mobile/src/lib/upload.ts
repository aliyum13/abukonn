import { API_URL } from './api';
import { getToken } from './storage';

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

// Pro multi-media limits (design decision, see ROADMAP): images up to 10MB
// each, video up to 50MB AND 60 seconds. Checked here, client-side, before
// the network request starts -- so a huge file is rejected instantly instead
// of failing partway through (or worse, succeeding and wasting the person's
// data on an upload the backend would reject anyway once size-cap
// enforcement lands server-side too).
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

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
export async function uploadMedia(
  uri: string,
  folder: string,
  mediaType?: 'image' | 'video',
  fileSizeBytes?: number | null,
  durationMs?: number | null
): Promise<{ secure_url: string; media_type: 'image' | 'video'; duration_seconds: number | null; thumbnail_url: string | null }> {
  const type = mediaType ?? guessMediaType(uri);

  if (fileSizeBytes != null) {
    const cap = type === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (fileSizeBytes > cap) {
      const capMb = Math.round(cap / (1024 * 1024));
      throw new Error(`${type === 'video' ? 'Videos' : 'Images'} must be under ${capMb}MB.`);
    }
  }
  // Expo's picker reports video duration in milliseconds.
  if (type === 'video' && durationMs != null && durationMs > 60000) {
    throw new Error('Videos can be up to 60 seconds long.');
  }

  const token = await getToken();

  // 1. Ask our backend to sign the upload (keeps the Cloudinary secret server-side).
  const sigRes = await fetch(
    `${API_URL}/api/stories/upload-signature?folder=${encodeURIComponent(folder)}`,
    { headers: { Authorization: `Bearer ${token}` } },
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

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/${type}/upload`, {
    method: 'POST',
    body: fd,
  });
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
