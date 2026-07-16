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

  // 2. Upload the file straight to Cloudinary.
  const fd = new FormData();
  fd.append('file', { uri, name: 'upload.jpg', type: 'image/jpeg' } as unknown as Blob);
  fd.append('api_key', api_key);
  fd.append('timestamp', String(timestamp));
  fd.append('signature', signature);
  fd.append('folder', signedFolder);

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  if (!upRes.ok) throw new Error('Image upload failed.');
  const data = (await upRes.json()) as { secure_url?: string };
  if (!data.secure_url) throw new Error('Image upload failed.');
  return data.secure_url;
}
