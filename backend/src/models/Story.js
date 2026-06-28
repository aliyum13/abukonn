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
  await pool.query(`ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS caption TEXT`);
  console.log('Stories table ready');
}

async function createStory({ userId, mediaUrl, mediaType = 'image', storyType = 'image', textContent = null, bgColor = null, caption = null }) {
  const result = await pool.query(
    `INSERT INTO abukonn.stories (user_id, media_url, media_type, story_type, text_content, bg_color, caption)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, mediaUrl, mediaType, storyType, textContent, bgColor, caption]
  );
  return result.rows[0];
}

async function getActiveStoriesForUser(userId) {
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.media_url, s.media_type, s.story_type, s.text_content, s.bg_color,
            s.caption, s.created_at, s.expires_at,
            u.full_name AS user_name, u.profile_photo_url AS user_photo,
            COUNT(sv.id)::int AS view_count
     FROM abukonn.stories s
     JOIN abukonn.users u ON s.user_id = u.id
     LEFT JOIN abukonn.story_views sv ON sv.story_id = s.id
     WHERE s.expires_at > NOW()
       AND (
         s.user_id = $1
         OR s.user_id IN (SELECT following_id FROM abukonn.follows WHERE follower_id = $1)
       )
     GROUP BY s.id, u.full_name, u.profile_photo_url
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

async function getMyActiveStories(userId) {
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.media_url, s.media_type, s.story_type, s.text_content, s.bg_color,
            s.caption, s.created_at, s.expires_at,
            COUNT(sv.id)::int AS view_count
     FROM abukonn.stories s
     LEFT JOIN abukonn.story_views sv ON sv.story_id = s.id
     WHERE s.user_id = $1 AND s.expires_at > NOW()
     GROUP BY s.id
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getStoryById(storyId) {
  const result = await pool.query(`SELECT * FROM abukonn.stories WHERE id = $1`, [storyId]);
  return result.rows[0] || null;
}

// ── Story views ──────────────────────────────────────────────────────────────

const CREATE_STORY_VIEWS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.story_views (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES abukonn.stories(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON abukonn.story_views(story_id);`;

async function createStoryViewsTable() {
  await pool.query(CREATE_STORY_VIEWS_TABLE);
  console.log('Story views table ready');
}

async function recordStoryView(storyId, viewerId) {
  await pool.query(
    `INSERT INTO abukonn.story_views (story_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [storyId, viewerId]
  );
}

// ── Story reactions ──────────────────────────────────────────────────────────

const CREATE_STORY_REACTIONS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.story_reactions (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES abukonn.stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_story_reactions_story ON abukonn.story_reactions(story_id);`;

async function createStoryReactionsTable() {
  await pool.query(CREATE_STORY_REACTIONS_TABLE);
  console.log('Story reactions table ready');
}

async function toggleStoryReaction(storyId, userId) {
  const del = await pool.query(
    `DELETE FROM abukonn.story_reactions WHERE story_id=$1 AND user_id=$2 RETURNING id`,
    [storyId, userId]
  );
  if (del.rowCount > 0) {
    const cnt = await pool.query(`SELECT COUNT(*) FROM abukonn.story_reactions WHERE story_id=$1`, [storyId]);
    return { liked: false, count: parseInt(cnt.rows[0].count, 10) };
  }
  await pool.query(
    `INSERT INTO abukonn.story_reactions (story_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [storyId, userId]
  );
  const cnt = await pool.query(`SELECT COUNT(*) FROM abukonn.story_reactions WHERE story_id=$1`, [storyId]);
  return { liked: true, count: parseInt(cnt.rows[0].count, 10) };
}

async function getStoryReactions(storyId, userId) {
  const cnt = await pool.query(`SELECT COUNT(*) FROM abukonn.story_reactions WHERE story_id=$1`, [storyId]);
  const liked = await pool.query(
    `SELECT 1 FROM abukonn.story_reactions WHERE story_id=$1 AND user_id=$2`, [storyId, userId]
  );
  const likers = await pool.query(
    `SELECT r.user_id, u.full_name AS user_name, u.profile_photo_url AS user_photo
     FROM abukonn.story_reactions r
     JOIN abukonn.users u ON r.user_id = u.id
     WHERE r.story_id = $1
     ORDER BY r.created_at DESC`,
    [storyId]
  );
  return {
    count: parseInt(cnt.rows[0].count, 10),
    is_liked: liked.rows.length > 0,
    likers: likers.rows,
  };
}

// ── Story replies ────────────────────────────────────────────────────────────

const CREATE_STORY_REPLIES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.story_replies (
  id SERIAL PRIMARY KEY,
  story_id INTEGER NOT NULL REFERENCES abukonn.stories(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_story_replies_story ON abukonn.story_replies(story_id);`;

async function createStoryRepliesTable() {
  await pool.query(CREATE_STORY_REPLIES_TABLE);
  console.log('Story replies table ready');
}

async function createStoryReply(storyId, senderId, content) {
  const result = await pool.query(
    `INSERT INTO abukonn.story_replies (story_id, sender_id, content) VALUES ($1, $2, $3) RETURNING *`,
    [storyId, senderId, content]
  );
  return result.rows[0];
}

async function getStoryReplies(storyId) {
  const result = await pool.query(
    `SELECT r.*, u.full_name AS sender_name, u.profile_photo_url AS sender_photo
     FROM abukonn.story_replies r
     JOIN abukonn.users u ON r.sender_id = u.id
     WHERE r.story_id = $1
     ORDER BY r.created_at ASC`,
    [storyId]
  );
  return result.rows;
}

module.exports = {
  createStoriesTable,
  createStory,
  getActiveStoriesForUser,
  getMyActiveStories,
  deleteStory,
  getStoryById,
  createStoryViewsTable,
  recordStoryView,
  createStoryReactionsTable,
  toggleStoryReaction,
  getStoryReactions,
  createStoryRepliesTable,
  createStoryReply,
  getStoryReplies,
};
