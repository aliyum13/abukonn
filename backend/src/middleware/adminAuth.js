const jwt = require('jsonwebtoken');
const pool = require('../config/db');

async function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Always verify is_admin from DB (not just token) for security
    const result = await pool.query(
      'SELECT is_admin FROM abukonn.users WHERE id = $1',
      [decoded.id]
    );

    const user = result.rows[0];
    if (!user || !user.is_admin) {
      return res.status(403).json({ message: 'Forbidden. Admin access required.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Stricter second gate, chained AFTER adminAuth, for endpoints that grant
// authority (assign roles, make someone an admin).
//
// adminAuth only checks is_admin, and is_admin is ALSO set for the scoped
// admin-panel roles `editor` and `class_coordinator` (see setUserRole), who are
// meant to reach just their own sections (news/highlights, timetable/calendar).
// Without this, an editor could PATCH their own role to 'admin' and from there
// grant themselves anything. Requires role === 'admin' exactly, read fresh from
// the DB like adminAuth does, never from the token.
async function requireFullAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  try {
    const { rows } = await pool.query('SELECT role FROM abukonn.users WHERE id = $1', [req.user.id]);
    if (rows[0]?.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden. Full admin role required.' });
    }
    next();
  } catch (err) {
    console.error('requireFullAdmin:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = adminAuth;
module.exports.requireFullAdmin = requireFullAdmin;
