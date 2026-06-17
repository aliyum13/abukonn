const pool = require('../config/db');

const CREATE_STORIES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.stories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) DEFAULT 'image',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON abukonn.stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_user ON abukonn.stories(user_id);`;

async function createStoriesTable() {
  await pool.query(CREATE_STORIES_TABLE);
  console.log('Stories table ready');
}

async function createStory({ userId, mediaUrl, mediaType = 'image' }) {
  const result = await pool.query(
    `INSERT INTO abukonn.stories (user_id, media_url, media_type)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, mediaUrl, mediaType]
  );
  return result.rows[0];
}

async function getActiveStoriesForUser(userId) {
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.media_url, s.media_type, s.created_at, s.expires_at,
            u.full_name AS user_name, u.profile_photo_url AS user_photo
     FROM abukonn.stories s
     JOIN abukonn.users u ON s.user_id = u.id
     WHERE s.expires_at > NOW()
       AND (
         s.user_id = $1
         OR s.user_id IN (SELECT following_id FROM abukonn.follows WHERE follower_id = $1)
       )
     ORDER BY s.user_id = $1 DESC, s.user_id, s.created_at ASC`,
    [userId]
  );
  return result.rows;
}

async function deleteStory(storyId, userId) {
  const result = await pool.query(
    `DELETE FROM abukonn.stories WHERE id = $1 AND user_id = $2 RETURNING *`,
    [storyId, userId]
  );
  return result.rows[0] || null;
}

module.exports = { createStoriesTable, createStory, getActiveStoriesForUser, deleteStory };
