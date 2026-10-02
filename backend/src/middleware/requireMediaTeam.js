const { hasRole, ROLE_TYPES } = require('../models/UserRole');

// Gate for publishing News: the caller must hold the media_team role. Chain it
// AFTER an auth middleware (it relies on req.user.id). The role is read fresh
// from the DB on every request, so a grant or revoke applies immediately.
async function requireMediaTeam(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  try {
    if (!(await hasRole(req.user.id, ROLE_TYPES.MEDIA_TEAM))) {
      return res.status(403).json({ message: 'Forbidden. Media Team access is required to publish News.' });
    }
    next();
  } catch (err) {
    console.error('requireMediaTeam:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = requireMediaTeam;
