/**
 * One-time repair for documents uploaded to Cloudinary before the
 * extension-preservation fix (use_filename/unique_filename).
 *
 * Those files were stored under a random public_id with NO extension
 * (e.g. ".../abukonn/library/8f3ka2x1" instead of "...report_8f3ka2x1.docx"),
 * which is why they show a raw download prompt instead of previewing.
 *
 * This finds every affected row across library_materials, messages, and
 * group_messages, renames the underlying Cloudinary asset to include the
 * correct extension (derived from the stored file_name), and updates the
 * DB row's file_url to match — all without re-uploading anything.
 *
 * Run once from the backend directory:
 *   node scripts/fix-file-extensions.js
 *
 * Safe to re-run: rows that already look correct are skipped automatically.
 * Also exported for use from an authenticated admin route (see
 * routes/admin.js) so it can be triggered without shell/CLI access.
 */

function getExtension(fileName) {
  if (!fileName) return null;
  const parts = fileName.split('.');
  if (parts.length < 2) return null;
  return parts.pop().toLowerCase();
}

/** True if the URL's final path segment already ends with the given extension. */
function urlHasExtension(url, ext) {
  if (!ext) return true;
  try {
    const path = new URL(url).pathname;
    return path.toLowerCase().endsWith(`.${ext}`);
  } catch {
    return true; // malformed URL — leave it alone
  }
}

/** Extracts the Cloudinary public_id (folder path, no extension) from a raw-resource secure_url. */
function publicIdFromUrl(url) {
  const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+)$/);
  return match ? match[1] : null;
}

async function repairRow(pool, cloudinaryClient, { table, idColumn, id, fileUrl, fileName }) {
  const ext = getExtension(fileName);
  if (!ext) return { skipped: 'no extension in file_name' };
  if (urlHasExtension(fileUrl, ext)) return { skipped: 'already correct' };

  const publicId = publicIdFromUrl(fileUrl);
  if (!publicId) return { skipped: 'could not parse public_id from URL' };

  const newPublicId = `${publicId}.${ext}`;
  const renamed = await cloudinaryClient.uploader.rename(publicId, newPublicId, { resource_type: 'raw' });
  const newUrl = renamed.secure_url;

  await pool.query(`UPDATE abukonn.${table} SET file_url = $1 WHERE ${idColumn} = $2`, [newUrl, id]);

  return { fixed: true, from: fileUrl, to: newUrl };
}

async function repairTable(pool, cloudinaryClient, table, idColumn) {
  const { rows } = await pool.query(
    `SELECT ${idColumn} AS id, file_url, file_name FROM abukonn.${table} WHERE file_url IS NOT NULL AND file_name IS NOT NULL`
  );

  let fixedCount = 0;
  let skippedCount = 0;
  const errors = [];

  for (const row of rows) {
    try {
      const result = await repairRow(pool, cloudinaryClient, {
        table, idColumn, id: row.id, fileUrl: row.file_url, fileName: row.file_name,
      });
      if (result.fixed) fixedCount++;
      else skippedCount++;
    } catch (err) {
      errors.push({ id: row.id, message: err.message });
    }
  }

  return { checked: rows.length, fixed: fixedCount, skipped: skippedCount, errors };
}

async function repairAll(pool, cloudinaryClient) {
  const [library_materials, messages, group_messages] = await Promise.all([
    repairTable(pool, cloudinaryClient, 'library_materials', 'id'),
    repairTable(pool, cloudinaryClient, 'messages', 'id'),
    repairTable(pool, cloudinaryClient, 'group_messages', 'id'),
  ]);
  return { library_materials, messages, group_messages };
}

module.exports = { repairAll, repairTable, repairRow, getExtension, urlHasExtension, publicIdFromUrl };

// Allow running directly: node scripts/fix-file-extensions.js
if (require.main === module) {
  require('dotenv').config();
  const pool = require('../src/config/db');
  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  repairAll(pool, cloudinary)
    .then((results) => {
      console.log(JSON.stringify(results, null, 2));
      const totalFixed = results.library_materials.fixed + results.messages.fixed + results.group_messages.fixed;
      const totalErrors = results.library_materials.errors.length + results.messages.errors.length + results.group_messages.errors.length;
      console.log(`\nTotal fixed: ${totalFixed}, total errors: ${totalErrors}`);
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Script failed:', err);
      process.exit(1);
    });
}
