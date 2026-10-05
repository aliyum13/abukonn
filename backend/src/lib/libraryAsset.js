const cloudinary = require('cloudinary').v2;

// Library uploads are stored as Cloudinary `raw` assets under this folder with an
// explicit public_id that includes the file extension (see libraryController's
// upload). The stored file_url therefore encodes the asset id exactly:
//   https://res.cloudinary.com/<cloud>/raw/upload/[v123/]abukonn/library/<id>
// and the extension-repair script renames assets while rewriting file_url to
// match, so the URL always reflects the current public_id.
const LIBRARY_FOLDER = 'abukonn/library/';

// Returns the asset's public_id, or null if the URL isn't one we can be sure
// about. Deliberately strict: anything outside our own cloud, resource type or
// folder returns null and is NOT touched, rather than guessing at an id.
function libraryPublicIdFromUrl(fileUrl, cloudName = process.env.CLOUDINARY_CLOUD_NAME) {
  let url;
  try {
    url = new URL(fileUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return null;

  // ['', <cloud>, 'raw', 'upload', ('v123',)? ...id segments]
  const segs = url.pathname.split('/');
  if (segs[2] !== 'raw' || segs[3] !== 'upload') return null;
  if (cloudName && segs[1] !== cloudName) return null;

  const rest = segs.slice(4);
  if (rest[0] && /^v\d+$/.test(rest[0])) rest.shift();
  let id;
  try {
    id = rest.map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
  if (!id.startsWith(LIBRARY_FOLDER) || id.length === LIBRARY_FOLDER.length) return null;
  if (id.split('/').some(s => s === '' || s === '.' || s === '..')) return null;
  return id;
}

// Best-effort removal of the file after its database row is gone. Never throws
// and never affects the outcome of the request: an orphaned file costs storage,
// a failed delete request would cost a user's action. Resolves true only when
// Cloudinary confirms the deletion.
async function deleteLibraryAsset(fileUrl) {
  try {
    const publicId = libraryPublicIdFromUrl(fileUrl);
    if (!publicId) {
      console.log('[library] Cloudinary cleanup skipped: URL is not a recognised library asset');
      return false;
    }
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'raw', invalidate: true });
    console.log(`[library] Cloudinary delete ${publicId}: ${result?.result}`);
    return result?.result === 'ok';
  } catch (err) {
    console.error('[library] Cloudinary delete failed:', err.message);
    return false;
  }
}

module.exports = { libraryPublicIdFromUrl, deleteLibraryAsset, LIBRARY_FOLDER };
