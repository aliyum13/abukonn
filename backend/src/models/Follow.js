const pool = require('../config/db');

const CREATE_FOLLOWS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id)
);
`;

async function createFollowsTable() {
  await pool.query(CREATE_FOLLOWS_TABLE);
  console.log('Follows table ready');
}

async function followUser(followerId, followingId) {
  const result = await pool.query(
    `INSERT INTO abukonn.follows (follower_id, following_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [followerId, followingId]
  );
  return result.rows[0] || null;
}

async function unfollowUser(followerId, followingId) {
  const result = await pool.query(
    `DELETE FROM abukonn.follows WHERE follower_id = $1 AND following_id = $2 RETURNING *`,
    [followerId, followingId]
  );
  return result.rows[0] || null;
}

async function getStats(userId) {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM abukonn.follows WHERE following_id = $1) AS followers_count,
       (SELECT COUNT(*) FROM abukonn.follows WHERE follower_id = $1)  AS following_count`,
    [userId]
  );
  const row = result.rows[0];
  return {
    followers_count: parseInt(row.followers_count, 10),
    following_count: parseInt(row.following_count, 10),
  };
}

async function isFollowing(followerId, followingId) {
  const result = await pool.query(
    `SELECT 1 FROM abukonn.follows WHERE follower_id = $1 AND following_id = $2`,
    [followerId, followingId]
  );
  return result.rows.length > 0;
}

async function getFollowers(userId, currentUserId) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.department, u.level, u.profile_photo_url,
            EXISTS(SELECT 1 FROM abukonn.follows cf WHERE cf.follower_id = $2 AND cf.following_id = u.id) AS is_following
     FROM abukonn.follows f
     JOIN abukonn.users u ON f.follower_id = u.id
     WHERE f.following_id = $1
     ORDER BY f.created_at DESC`,
    [userId, currentUserId]
  );
  return result.rows;
}

async function getFollowing(userId, currentUserId) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.department, u.level, u.profile_photo_url,
            EXISTS(SELECT 1 FROM abukonn.follows cf WHERE cf.follower_id = $2 AND cf.following_id = u.id) AS is_following
     FROM abukonn.follows f
     JOIN abukonn.users u ON f.following_id = u.id
     WHERE f.follower_id = $1
     ORDER BY f.created_at DESC`,
    [userId, currentUserId]
  );
  return result.rows;
}

async function getSuggestions(userId, limit = 5) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.department, u.level, u.profile_photo_url
     FROM abukonn.users u
     WHERE u.id != $1
       AND u.id NOT IN (
         SELECT following_id FROM abukonn.follows WHERE follower_id = $1
       )
     ORDER BY RANDOM()
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
}

// Common SELECT for people cards, with is_following relative to the viewer.
const PERSON_SELECT = `
  u.id, u.full_name, u.username, u.department, u.level, u.profile_photo_url,
  u.bio, COALESCE(u.role,'user') AS role,
  COALESCE(u.is_verified,FALSE) AS is_verified,
  COALESCE(u.is_content_creator,FALSE) AS is_content_creator,
  COALESCE(u.is_admin,FALSE) AS is_admin,
  (SELECT COUNT(*) FROM abukonn.follows ff WHERE ff.following_id = u.id)::int AS followers_count,
  EXISTS(SELECT 1 FROM abukonn.follows cf WHERE cf.follower_id = $1 AND cf.following_id = u.id) AS is_following
`;

// One prioritised "section" of people for the Discover page. Excludes the
// viewer, anyone they already follow, and blocked users. `extraWhere` is an
// SQL fragment scoping the section; params start at $2.
async function discoverSection(currentUserId, extraWhere, extraParams = [], limit = 20) {
  const result = await pool.query(
    `SELECT ${PERSON_SELECT}
     FROM abukonn.users u
     WHERE u.id != $1
       AND u.id NOT IN (SELECT following_id FROM abukonn.follows WHERE follower_id = $1)
       AND u.id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1)
       AND u.id NOT IN (SELECT blocker_id FROM abukonn.blocks WHERE blocked_id = $1)
       AND (${extraWhere})
     ORDER BY followers_count DESC, u.created_at DESC
     LIMIT ${limit}`,
    [currentUserId, ...extraParams]
  );
  return result.rows;
}

// Search users by name or username (excludes the viewer and blocked users).
async function searchPeople(currentUserId, query, limit = 30) {
  const like = `%${query}%`;
  const result = await pool.query(
    `SELECT ${PERSON_SELECT}
     FROM abukonn.users u
     WHERE u.id != $1
       AND u.id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1)
       AND u.id NOT IN (SELECT blocker_id FROM abukonn.blocks WHERE blocked_id = $1)
       AND (u.full_name ILIKE $2 OR u.username ILIKE $2)
     ORDER BY is_verified DESC, followers_count DESC
     LIMIT ${limit}`,
    [currentUserId, like]
  );
  return result.rows;
}

module.exports = {
  createFollowsTable,
  followUser,
  unfollowUser,
  getStats,
  isFollowing,
  getFollowers,
  getFollowing,
  getSuggestions,
  discoverSection,
  searchPeople,
};
