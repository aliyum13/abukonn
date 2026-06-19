const pool = require('../config/db');

const CREATE_STORIES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.stories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  media_url TEXT,
  media_type VARCHAR(10) DEFAULT 'image',
  story_type VARCHAR(10) NOT NULL DEFAULT 'image',
  text_content TEXT,
  bg_color VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON abukonn.stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_stories_user ON abukonn.stories(user_id);`;

const MIGRATE_STORIES_TABLE = `
ALTER TABLE abukonn.stories ALTER COLUMN media_url DROP NOT NULL;
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS story_type VARCHAR(10) NOT NULL DEFAULT 'image';
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS text_content TEXT;
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS bg_color VARCHAR(20);`;

async function createStoriesTable() {
  await pool.query(CREATE_STORIES_TABLE);
  try { await pool.query(MIGRATE_STORIES_TABLE); } catch { /* columns already exist */ }
  console.log('Stories table ready');
}

async function createStory({ userId, mediaUrl, mediaType = 'image', storyType = 'image', textContent = null, bgColor = null }) {
  const result = await pool.query(
    `INSERT INTO abukonn.stories (user_id, media_url, media_type, story_type, text_content, bg_color)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, mediaUrl, mediaType, storyType, textContent, bgColor]
  );
  return result.rows[0];
}

async function getActiveStoriesForUser(userId) {
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.media_url, s.media_type, s.story_type, s.text_content, s.bg_color,
            s.created_at, s.expires_at,
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
