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
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS bg_color VARCHAR(20);
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS font_style VARCHAR(20);
-- Who can see this story:
--   'all'    — every follower (default, existing behaviour)
--   'except' — every follower EXCEPT the people listed in story_audience
--   'only'   — ONLY the people listed in story_audience
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS audience VARCHAR(10) NOT NULL DEFAULT 'all';
-- Link preview, captured when the story is posted. Snapshotted rather than
-- re-fetched on every view: pages change, go down, or start redirecting, and we
-- don't want to hit a third-party site once per viewer.
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS link_title TEXT;
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS link_description TEXT;
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS link_image TEXT;
ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS link_site_name TEXT;`;

// The people named by a story's 'except'/'only' list. This is a SNAPSHOT taken
// when the story is posted — deliberately not a live reference to the author's
// current default, so that changing your privacy setting later can never
// retroactively expose (or hide) a story you already posted.
const CREATE_STORY_AUDIENCE_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.story_audience (
  story_id INTEGER NOT NULL REFERENCES abukonn.stories(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  PRIMARY KEY (story_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_story_audience_story ON abukonn.story_audience(story_id);`;

// The author's remembered default — the audience applies to future statuses
// until they change it.
const CREATE_STORY_AUDIENCE_PREF_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.story_audience_pref (
  user_id INTEGER PRIMARY KEY REFERENCES abukonn.users(id) ON DELETE CASCADE,
  audience VARCHAR(10) NOT NULL DEFAULT 'all'
);
CREATE TABLE IF NOT EXISTS abukonn.story_audience_pref_list (
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  target_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, target_id)
);`;

async function createStoryAudienceTables() {
  await pool.query(CREATE_STORY_AUDIENCE_TABLE);
  await pool.query(CREATE_STORY_AUDIENCE_PREF_TABLE);
  console.log('Story audience tables ready');
}

// Read the author's saved audience preference.
async function getAudiencePref(userId) {
  const { rows } = await pool.query(
    `SELECT audience FROM abukonn.story_audience_pref WHERE user_id = $1`,
    [userId]
  );
  const { rows: list } = await pool.query(
    `SELECT target_id FROM abukonn.story_audience_pref_list WHERE user_id = $1`,
    [userId]
  );
  return {
    audience: rows[0]?.audience || 'all',
    user_ids: list.map(r => r.target_id),
  };
}

// Save the author's audience preference for future stories.
async function setAudiencePref(userId, audience, userIds = []) {
  await pool.query(
    `INSERT INTO abukonn.story_audience_pref (user_id, audience) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET audience = EXCLUDED.audience`,
    [userId, audience]
  );
  await pool.query(`DELETE FROM abukonn.story_audience_pref_list WHERE user_id = $1`, [userId]);
  if (audience !== 'all' && userIds.length > 0) {
    await pool.query(
      `INSERT INTO abukonn.story_audience_pref_list (user_id, target_id)
       SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
      [userId, userIds]
    );
  }
  return getAudiencePref(userId);
}

// Snapshot the audience list onto a specific story.
async function setStoryAudience(storyId, userIds = []) {
  if (!userIds.length) return;
  await pool.query(
    `INSERT INTO abukonn.story_audience (story_id, user_id)
     SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
    [storyId, userIds]
  );
}

async function createStoriesTable() {
  await pool.query(CREATE_STORIES_TABLE);
  try { await pool.query(MIGRATE_STORIES_TABLE); } catch { /* columns already exist */ }
  await pool.query(`ALTER TABLE abukonn.stories ADD COLUMN IF NOT EXISTS caption TEXT`);
  console.log('Stories table ready');
}

async function createStory({ userId, mediaUrl, mediaType = 'image', storyType = 'image', textContent = null, bgColor = null, caption = null, fontStyle = null, audience = 'all', link = null }) {
  const result = await pool.query(
    `INSERT INTO abukonn.stories
       (user_id, media_url, media_type, story_type, text_content, bg_color, caption, font_style, audience,
        link_url, link_title, link_description, link_image, link_site_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [userId, mediaUrl, mediaType, storyType, textContent, bgColor, caption, fontStyle, audience,
     link?.url || null, link?.title || null, link?.description || null, link?.image || null, link?.site_name || null]
  );
  return result.rows[0];
}

// Can this viewer see this story? Mirrors the audience rule in
// getActiveStoriesForUser. Used to guard view/react/reply so a story that isn't
// visible to someone can't be interacted with by guessing its id.
async function canViewStory(storyId, viewerId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abukonn.stories s
     WHERE s.id = $1
       AND s.expires_at > NOW()
       AND (
         s.user_id = $2
         OR (
           s.user_id IN (SELECT following_id FROM abukonn.follows WHERE follower_id = $2)
           AND NOT EXISTS (
             SELECT 1 FROM abukonn.blocks b
             WHERE (b.blocker_id = s.user_id AND b.blocked_id = $2)
                OR (b.blocker_id = $2 AND b.blocked_id = s.user_id)
           )
           AND (
             COALESCE(s.audience, 'all') = 'all'
             OR (s.audience = 'except' AND NOT EXISTS (
                   SELECT 1 FROM abukonn.story_audience a WHERE a.story_id = s.id AND a.user_id = $2))
             OR (s.audience = 'only' AND EXISTS (
                   SELECT 1 FROM abukonn.story_audience a WHERE a.story_id = s.id AND a.user_id = $2))
           )
         )
       )
     LIMIT 1`,
    [storyId, viewerId]
  );
  return rows.length > 0;
}

async function getActiveStoriesForUser(userId) {
  const result = await pool.query(
    `SELECT s.id, s.user_id, s.media_url, s.media_type, s.story_type, s.text_content, s.bg_color,
            s.caption, s.font_style, s.created_at, s.expires_at,
            s.link_url, s.link_title, s.link_description, s.link_image, s.link_site_name,
            u.full_name AS user_name, u.profile_photo_url AS user_photo,
            CASE WHEN s.user_id = $1 THEN COUNT(sv.id)::int ELSE NULL END AS view_count,
            -- Has THIS viewer seen this story? Read from story_views (the server
            -- is the source of truth), so seen state survives switching device
            -- or clearing browser storage.
            EXISTS (
              SELECT 1 FROM abukonn.story_views v
              WHERE v.story_id = s.id AND v.viewer_id = $1
            ) AS viewed,
            -- Has this viewer muted the author? Muted authors are returned but
            -- flagged, so the UI can move them to a separate Muted section
            -- rather than dropping them entirely.
            EXISTS (
              SELECT 1 FROM abukonn.story_mutes m
              WHERE m.muter_id = $1 AND m.muted_id = s.user_id
            ) AS muted
     FROM abukonn.stories s
     JOIN abukonn.users u ON s.user_id = u.id
     LEFT JOIN abukonn.story_views sv ON sv.story_id = s.id
     WHERE s.expires_at > NOW()
       AND (
         -- Always see my own stories, whatever the audience.
         s.user_id = $1
         OR (
           -- Otherwise: I must follow them, they must not have blocked me
           -- (and I must not have blocked them), and I must fall inside the
           -- audience they chose for that specific story.
           s.user_id IN (SELECT following_id FROM abukonn.follows WHERE follower_id = $1)
           AND NOT EXISTS (
             SELECT 1 FROM abukonn.blocks b
             WHERE (b.blocker_id = s.user_id AND b.blocked_id = $1)
                OR (b.blocker_id = $1 AND b.blocked_id = s.user_id)
           )
           AND (
             COALESCE(s.audience, 'all') = 'all'
             OR (
               s.audience = 'except'
               AND NOT EXISTS (
                 SELECT 1 FROM abukonn.story_audience a
                 WHERE a.story_id = s.id AND a.user_id = $1
               )
             )
             OR (
               s.audience = 'only'
               AND EXISTS (
                 SELECT 1 FROM abukonn.story_audience a
                 WHERE a.story_id = s.id AND a.user_id = $1
               )
             )
           )
         )
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
            s.caption, s.font_style, s.created_at, s.expires_at,
            s.link_url, s.link_title, s.link_description, s.link_image, s.link_site_name,
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

// Muting is one-directional and silent: the muted person is never told, and it
// doesn't affect following. Their stories still load (so they can be shown in a
// separate Muted section) — they're just flagged, not hidden from the API.
const CREATE_STORY_MUTES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.story_mutes (
  muter_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  muted_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (muter_id, muted_id)
);`;

async function createStoryMutesTable() {
  await pool.query(CREATE_STORY_MUTES_TABLE);
  console.log('Story mutes table ready');
}

async function muteUserStories(muterId, mutedId) {
  if (muterId === mutedId) return false;
  await pool.query(
    `INSERT INTO abukonn.story_mutes (muter_id, muted_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [muterId, mutedId]
  );
  return true;
}

async function unmuteUserStories(muterId, mutedId) {
  await pool.query(
    `DELETE FROM abukonn.story_mutes WHERE muter_id = $1 AND muted_id = $2`,
    [muterId, mutedId]
  );
  return true;
}

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

// Full viewer list for a story — name, photo, and when they viewed it.
// Only ever returned to the story owner (enforced in the controller).
async function getStoryViewers(storyId) {
  const { rows } = await pool.query(
    `SELECT sv.viewer_id AS user_id, sv.viewed_at,
            u.full_name AS user_name, u.profile_photo_url AS user_photo,
            u.department
     FROM abukonn.story_views sv
     JOIN abukonn.users u ON sv.viewer_id = u.id
     WHERE sv.story_id = $1
     ORDER BY sv.viewed_at DESC`,
    [storyId]
  );
  return rows;
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

  const storyRes = await pool.query(`SELECT user_id FROM abukonn.stories WHERE id=$1`, [storyId]);
  const isOwner = storyRes.rows[0]?.user_id === userId;

  let likersList = [];
  if (isOwner) {
    const likers = await pool.query(
      `SELECT r.user_id, u.full_name AS user_name, u.profile_photo_url AS user_photo
       FROM abukonn.story_reactions r
       JOIN abukonn.users u ON r.user_id = u.id
       WHERE r.story_id = $1
       ORDER BY r.created_at DESC`,
      [storyId]
    );
    likersList = likers.rows;
  }

  return {
    count: parseInt(cnt.rows[0].count, 10),
    is_liked: liked.rows.length > 0,
    likers: likersList,
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
  createStoryAudienceTables,
  getAudiencePref,
  setAudiencePref,
  setStoryAudience,
  canViewStory,
  createStoryMutesTable,
  muteUserStories,
  unmuteUserStories,
  createStoriesTable,
  createStory,
  getActiveStoriesForUser,
  getMyActiveStories,
  deleteStory,
  getStoryById,
  createStoryViewsTable,
  recordStoryView,
  getStoryViewers,
  createStoryReactionsTable,
  toggleStoryReaction,
  getStoryReactions,
  createStoryRepliesTable,
  createStoryReply,
  getStoryReplies,
};
