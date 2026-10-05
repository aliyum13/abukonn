const pool = require('../config/db');
const { hasRole, ROLE_TYPES } = require('../models/UserRole');

// Who may do what in the Library. Every check reads the DB fresh (never the
// token), so a revoked contributor loses upload AND delete rights immediately,
// even for their own uploads. This is the single definition: the route gates,
// the per-material `can_delete` flag clients use to show a delete control, and
// the delete handler itself all go through it, so the UI can't drift from the
// rule the server enforces.

async function isFullAdmin(userId) {
  const { rows } = await pool.query('SELECT role FROM abukonn.users WHERE id = $1', [userId]);
  return rows[0]?.role === 'admin';
}

const isContributor = userId => hasRole(userId, ROLE_TYPES.LIBRARY_CONTRIBUTOR);

async function canUploadLibrary(userId) {
  return (await isFullAdmin(userId)) || isContributor(userId);
}

// What a user may delete, resolved once so a list of materials doesn't cost two
// queries per row:  all -> any material (full admin)
//                   own -> only materials they uploaded (Library Contributor)
// Neither -> nothing. Editors, coordinators and students have neither.
async function deleteCapabilities(userId) {
  if (await isFullAdmin(userId)) return { all: true, own: true };
  return { all: false, own: await isContributor(userId) };
}

// A material with no uploader (uploaded_by NULL: the account was deleted) can
// therefore only be deleted by a full admin.
function mayDelete(caps, material, userId) {
  if (caps.all) return true;
  return caps.own && material.uploaded_by != null && Number(material.uploaded_by) === Number(userId);
}

module.exports = { isFullAdmin, canUploadLibrary, deleteCapabilities, mayDelete };
