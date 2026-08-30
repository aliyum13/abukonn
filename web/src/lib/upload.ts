// Direct-to-Cloudinary upload, shared across every composer that needs it
// (feed post composer, story composer, DM image attachments).
//
// This bypasses Railway's ~30s proxy timeout by uploading straight from the
// browser to Cloudinary instead of routing the file through our backend —
// the backend only ever sees the resulting URL. Sending large files through
// the backend is what caused image posts and photo stories to hang before
// this pattern was adopted.
//
// folder must be one the backend whitelists: abukonn/posts, abukonn/stories,
// abukonn/messages, abukonn/files, abukonn/groups.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
// Multi-media upload limits, tiered for the "increased upload limits" Pro
// perk. Free: 10MB image / 200MB video / 180s. Pro: 25MB / 400MB / 360s.
// Free's video allowance was raised from 50MB/60s -- 60s was far too short
// for the lecture clips and event footage testers actually post. Pro was
// raised in step (was 150MB/180s, which the new free tier would otherwise
// have matched or beaten) so the tier structure stays intact and Pro is
// still strictly the better deal. Mirrors mobile/src/lib/upload.ts.
const LIMITS = {
  free: { imageBytes: 10 * 1024 * 1024, videoBytes: 200 * 1024 * 1024, videoSeconds: 180 },
  pro:  { imageBytes: 25 * 1024 * 1024, videoBytes: 400 * 1024 * 1024, videoSeconds: 360 },
} as const;

// Size-scaled upload deadline, mirroring mobile's uploadTimeoutFor(). The old
// flat 5-minute abort was sized for 50MB video; a 200MB upload on weak campus
// WiFi (~300 KB/s) legitimately needs ~11 minutes and would have been killed
// mid-flight. Scaling by bytes keeps a small stuck upload failing fast while
// giving a genuinely large one the room it needs.
const MIN_UPLOAD_BYTES_PER_SEC = 300 * 1024;
const MIN_UPLOAD_TIMEOUT_MS = 60000;
const MAX_UPLOAD_TIMEOUT_MS = 900000; // 15min ceiling, so nothing hangs forever

function uploadTimeoutFor(bytes: number): number {
  const needed = Math.ceil(bytes / MIN_UPLOAD_BYTES_PER_SEC) * 1000;
  return Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.max(MIN_UPLOAD_TIMEOUT_MS, needed));
}

// Picks the active tier. is_pro doesn't exist yet, so callers pass nothing
// and everyone gets free limits (Option A, matching every other Pro
// candidate). PRO-GATE: once the app knows the user's Pro status, callers
// pass isPro and Pro users get the higher tier -- no other change needed.
function limitsFor(isPro?: boolean) {
  return isPro ? LIMITS.pro : LIMITS.free;
}

export interface UploadResult {
  secure_url: string;
  media_type: 'image' | 'video';
  duration_seconds: number | null;
  thumbnail_url: string | null;
}

// Reads a video file's duration client-side, without uploading anything --
// loads it into an off-DOM <video> element just long enough to read
// .duration from its metadata, then releases the object URL. Used to reject
// an over-length video before spending any bandwidth on it.
function readVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      const url = URL.createObjectURL(file);
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(video.duration) ? video.duration : null);
      };
      video.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      video.src = url;
    } catch {
      resolve(null);
    }
  });
}

// Uploads one file, reporting 0-100 progress via onProgress. Auto-detects
// image vs video from the file's MIME type (what the browser itself reports
// for the selected file — reliable, unlike guessing from a filename).
// isPro (optional) selects the higher Pro limit tier; omitted = free tier.
export async function uploadMedia(
  file: File,
  folder: string,
  token: string | null,
  onProgress?: (pct: number) => void,
  isPro?: boolean,
): Promise<UploadResult> {
  const isVideo = file.type.startsWith('video/');
  const limits = limitsFor(isPro);

  // Pre-flight checks, before any network call — file.size is always known
  // synchronously; video duration needs a quick metadata read (no upload).
  const cap = isVideo ? limits.videoBytes : limits.imageBytes;
  if (file.size > cap) {
    throw new Error(`${isVideo ? 'Videos' : 'Images'} must be under ${Math.round(cap / (1024 * 1024))}MB.`);
  }
  if (isVideo) {
    const duration = await readVideoDurationSeconds(file);
    if (duration != null && duration > limits.videoSeconds) {
      throw new Error(`Videos can be up to ${limits.videoSeconds} seconds long.`);
    }
  }

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const sigRes = await fetch(
          `${API_URL}/api/stories/upload-signature?folder=${encodeURIComponent(folder)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        if (!sigRes.ok) throw new Error('Could not start the upload.');
        const { signature, timestamp, api_key, cloud_name, folder: signedFolder } =
          await sigRes.json() as {
            signature: string; timestamp: number; api_key: string;
            cloud_name: string; folder: string;
          };

        const xhr = new XMLHttpRequest();
        // file.size is always known in the browser, so the deadline is scaled
        // to this exact upload rather than to a worst-case guess.
        const tid = setTimeout(() => xhr.abort(), uploadTimeoutFor(file.size));
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          clearTimeout(tid);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText) as { secure_url: string; duration?: number };
              resolve({
                secure_url: data.secure_url,
                media_type: isVideo ? 'video' : 'image',
                duration_seconds: isVideo && data.duration ? Math.round(data.duration) : null,
                // Cloudinary auto-generates a JPG thumbnail for any video at
                // a predictable URL (swap the extension) — no extra request.
                thumbnail_url: isVideo ? data.secure_url.replace(/\.[a-zA-Z0-9]+$/, '.jpg') : null,
              });
            } catch {
              reject(new Error('Invalid Cloudinary response'));
            }
          } else {
            try {
              const err = JSON.parse(xhr.responseText) as { error?: { message: string } };
              reject(new Error(err.error?.message || (isVideo ? 'Video upload failed' : 'Image upload failed')));
            } catch {
              reject(new Error(isVideo ? 'Video upload failed' : 'Image upload failed'));
            }
          }
        };
        xhr.onerror = () => { clearTimeout(tid); reject(new Error('Network error — check your connection')); };
        xhr.onabort = () => { clearTimeout(tid); reject(new Error('Upload timed out — please try again')); };

        const fd = new FormData();
        fd.append('file', file);
        fd.append('api_key', api_key);
        fd.append('timestamp', String(timestamp));
        fd.append('signature', signature);
        fd.append('folder', signedFolder);
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloud_name}/${isVideo ? 'video' : 'image'}/upload`);
        xhr.send(fd);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Upload failed'));
      }
    })();
  });
}
