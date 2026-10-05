const { canUploadLibrary } = require('../lib/libraryAccess');

// Who may add to the Library: a full admin (role === 'admin') or anyone holding
// the library_contributor role, read fresh from the DB (see lib/libraryAccess,
// the single definition shared with the client-facing /permissions endpoint).

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
