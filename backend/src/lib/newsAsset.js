const cloudinary = require('../config/cloudinary');

// News cover images are Cloudinary `image` assets under abukonn/news/ (the admin panel's
// multipart upload and the mobile composer both put them there). The stored image_url
// encodes the asset id exactly:
//   https://res.cloudinary.com/<cloud>/image/upload/[v123/]abukonn/news/<id>.<ext>
const NEWS_FOLDER = 'abukonn/news/';

// Returns the asset's public_id (no extension), or null if the URL isn't one we can be sure
// about. Deliberately strict, like libraryAsset: anything outside our own cloud, resource
// type or folder returns null and is NOT touched, rather than guessing at an id. A cover
// that came from somewhere else (an older article, a URL pasted into the API) is simply
// left alone.
function newsCoverPublicIdFromUrl(imageUrl, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;

  // ['', <cloud>, 'image', 'upload', ('v123',)? ...id segments]
  const segs = url.pathname.split('/');
  if (segs[2] !== 'image' || segs[3] !== 'upload') return null;
  if (cloudName && segs[1] !== cloudName) return null;

  const rest = segs.slice(4);
  if (rest[0] && /^v\d+$/.test(rest[0])) rest.shift();
  let id;
  try {
    id = rest.map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
  if (!id.startsWith(NEWS_FOLDER)) return null;
  if (id.split('/').some(s => s === '' || s === '.' || s === '..')) return null;
  // Image public_ids carry no extension.
  const withoutExt = id.replace(/\.[A-Za-z0-9]+$/, '');
  return withoutExt.length > NEWS_FOLDER.length ? withoutExt : null;
}

// Best-effort removal of an article's cover after its row is gone. Never throws and never
// affects the outcome of the request: an orphaned image costs storage, a failed delete
// request would cost an editor's action. Resolves true only when Cloudinary confirms.
async function deleteNewsCover(imageUrl) {
  try {
    if (!imageUrl) return false;
    const publicId = newsCoverPublicIdFromUrl(imageUrl);
    if (!publicId) {
      console.log('[news] Cloudinary cleanup skipped: cover is not a recognised abukonn/news image');
      return false;
    }
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    console.log(`[news] Cloudinary delete ${publicId}: ${result?.result}`);
    return result?.result === 'ok';
  } catch (err) {
    console.error('[news] Cloudinary delete failed:', err.message);
    return false;
  }
}

module.exports = { newsCoverPublicIdFromUrl, deleteNewsCover, NEWS_FOLDER };
