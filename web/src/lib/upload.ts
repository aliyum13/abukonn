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

// Pro multi-media limits (design decision, see ROADMAP): images up to 10MB
// each, video up to 50MB AND 60 seconds.
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

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
export async function uploadMedia(
  file: File,
  folder: string,
  token: string | null,
  onProgress?: (pct: number) => void,
): Promise<UploadResult> {
  const isVideo = file.type.startsWith('video/');

  // Pre-flight checks, before any network call — file.size is always known
  // synchronously; video duration needs a quick metadata read (no upload).
  const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    throw new Error(`${isVideo ? 'Videos' : 'Images'} must be under ${Math.round(cap / (1024 * 1024))}MB.`);
  }
  if (isVideo) {
    const duration = await readVideoDurationSeconds(file);
    if (duration != null && duration > 60) {
      throw new Error('Videos can be up to 60 seconds long.');
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
        // 5 minutes — video files are larger and slower to upload than the
        // images this timeout was originally sized for.
        const tid = setTimeout(() => xhr.abort(), 300000);
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
