const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Throttle last_active writes: stamping on every request would be a DB write per
// API call. We only write if we haven't stamped this user in the last 5 minutes,
// tracked in-process. This keeps DAU/MAU accurate (5-min granularity is plenty)
// while a browsing user generates ~12 writes/hour instead of hundreds.
const STAMP_INTERVAL_MS = 5 * 60 * 1000;
const lastStamped = new Map(); // userId -> epoch ms of last write

// Bound the map so it can't grow forever on a long-lived process.
const MAX_TRACKED = 50000;

function stampLastActive(userId) {
  const now = Date.now();
  const prev = lastStamped.get(userId);
  if (prev && now - prev < STAMP_INTERVAL_MS) return; // stamped recently, skip
  lastStamped.set(userId, now);

  if (lastStamped.size > MAX_TRACKED) {
    // Drop the oldest entries; they'll just re-stamp on their next request.
    const cutoff = now - STAMP_INTERVAL_MS;
    for (const [id, t] of lastStamped) if (t < cutoff) lastStamped.delete(id);
  }

  // Fire-and-forget: never block or fail the request on this. last_active is not
  // worth breaking an API call over.
  pool
    .query('UPDATE abukonn.users SET last_active = NOW() WHERE id = $1', [userId])
    .catch(() => { lastStamped.delete(userId); }); // let it retry next request
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    if (decoded?.id) stampLastActive(decoded.id);
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// Decodes a bearer token WHEN PRESENT, but never rejects the request for a
// missing or invalid one. For routes that must stay reachable without login
// (news is public campus content -- neither client sends a token on these
// GETs today) but can personalise their response (e.g. is_liked) when the
// caller happens to be authenticated. `auth` above is still what enforces
// real authentication everywhere that requires it; this is deliberately
// weaker and should only gate routes that are meant to work anonymously too.
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      if (decoded?.id) stampLastActive(decoded.id);
    } catch {
      // Invalid/expired token on an optional route -- proceed anonymously
      // rather than rejecting; req.user simply stays unset.
    }
  }
  next();
}

module.exports = auth;
module.exports.optionalAuth = optionalAuth;
