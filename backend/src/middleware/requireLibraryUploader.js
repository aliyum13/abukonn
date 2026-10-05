const pool = require('../config/db');
const { hasRole, ROLE_TYPES } = require('../models/UserRole');

// Who may add to the Library: a full admin (role === 'admin') or anyone holding
// the library_contributor role. Both are read fresh from the DB on every call,
// never from the token, so a grant or revoke applies immediately.
//
// This is the single definition: the upload gate below and the client-facing
// "can I upload?" endpoint both use it, so what the UI shows can't drift from
// what the server enforces.
async function canUploadLibrary(userId) {
  const { rows } = await pool.query('SELECT role FROM abukonn.users WHERE id = $1', [userId]);
  if (rows[0]?.role === 'admin') return true;
  return hasRole(userId, ROLE_TYPES.LIBRARY_CONTRIBUTOR);
}

// Chain AFTER `auth` (it relies on req.user.id). Deliberately not adminAuth: a
// contributor who isn't an admin has no way past that, which is the point.
async function requireLibraryUploader(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  try {
    if (!(await canUploadLibrary(req.user.id))) {
      return res.status(403).json({ message: 'Forbidden. Library Contributor access is required to upload.' });
    }
    next();
  } catch (err) {
    console.error('requireLibraryUploader:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = requireLibraryUploader;
module.exports.canUploadLibrary = canUploadLibrary;
