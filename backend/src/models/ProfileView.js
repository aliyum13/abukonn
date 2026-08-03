const pool = require('../config/db');

// One row per (viewer, viewed) pair -- NOT one row per visit. Re-viewing the
// same profile updates viewed_at rather than inserting a new row (see
// recordView's ON CONFLICT), so "who viewed you" always reflects each
// person's MOST RECENT visit, not a raw visit count. That's the right
// semantics for a "who viewed your profile" list (LinkedIn-style): someone
// who checks your profile daily should sit at the top, fresh, not create 30
// entries.
const CREATE_PROFILE_VIEWS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.profile_views (
  viewer_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  viewed_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (viewer_id, viewed_id)
);
`;

async function createProfileViewsTable() {
  await pool.query(CREATE_PROFILE_VIEWS_TABLE);
  // Read pattern is always "viewers of user X within the last 30 days,
  // freshest first" -- this index serves exactly that.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON abukonn.profile_views(viewed_id, viewed_at DESC)`);
  console.log('Profile views table ready');
}

// Records that viewerId visited viewedId's profile. Recording happens for
// EVERY visit regardless of either party's Pro status -- only READING the
// list back is Pro-gated (see the controller). If recording were also
// gated, a free user who upgrades would find their view history already
// missing everyone who visited before they went Pro.
async function recordView(viewerId, viewedId) {
  if (viewerId === viewedId) return; // never record self-views
  await pool.query(
    `INSERT INTO abukonn.profile_views (viewer_id, viewed_id, viewed_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (viewer_id, viewed_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
    [viewerId, viewedId]
  );
}

// Who viewed userId's profile in the last 30 days, freshest first, in the
// same PERSON_SELECT shape the rest of the app already uses for a person
// card (avatar, badges, follow status). $1 is userId itself, reused for
// PERSON_SELECT's is_following check -- correctly answers "do I (the
// profile owner) follow this viewer back", not "does the viewer follow me"
// (that's followers_count/is_following elsewhere; here it's from the
// profile-owner's point of view since they're the one reading this list).
async function getViewers(userId, limit = 50) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.department, u.level, u.profile_photo_url,
            COALESCE(u.role,'user') AS role,
            COALESCE(u.is_verified,FALSE) AS is_verified,
            COALESCE(u.is_content_creator,FALSE) AS is_content_creator,
            EXISTS(SELECT 1 FROM abukonn.follows f WHERE f.follower_id = $1 AND f.following_id = u.id) AS is_following,
            pv.viewed_at
     FROM abukonn.profile_views pv
     JOIN abukonn.users u ON u.id = pv.viewer_id
     WHERE pv.viewed_id = $1
       AND pv.viewed_at > NOW() - INTERVAL '30 days'
       AND u.id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1)
       AND u.id NOT IN (SELECT blocker_id FROM abukonn.blocks WHERE blocked_id = $1)
     ORDER BY pv.viewed_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// Cheap count for a badge/preview (e.g. "3 new views") without pulling the
// full identity list -- same 30-day window and block-filtering as getViewers.
async function getViewerCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM abukonn.profile_views pv
     WHERE pv.viewed_id = $1
       AND pv.viewed_at > NOW() - INTERVAL '30 days'
       AND pv.viewer_id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1)
       AND pv.viewer_id NOT IN (SELECT blocker_id FROM abukonn.blocks WHERE blocked_id = $1)`,
    [userId]
  );
  return result.rows[0].count;
}

module.exports = { createProfileViewsTable, recordView, getViewers, getViewerCount };
