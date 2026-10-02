const pool = require('../config/db');

const CREATE_NEWS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('academic', 'sports', 'events', 'general')),
  image_url TEXT,
  created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

// Mirrors abukonn.post_likes exactly: composite primary key (no surrogate id
// needed -- one row per user per article), ON DELETE CASCADE on both sides so
// a deleted user or article cleans up its own like rows for free.
const CREATE_NEWS_LIKES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.news_likes (
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  news_id INTEGER NOT NULL REFERENCES abukonn.news(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, news_id)
);
`;

async function createNewsTable() {
  await pool.query(CREATE_NEWS_TABLE);
  // Likes were never persisted for news -- both clients only ever toggled a
  // local useState that reset on every reload. Additive, like every other
  // migration in this file: existing articles get likes_count = 0.
  await pool.query(`ALTER TABLE abukonn.news ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0`);
  await pool.query(CREATE_NEWS_LIKES_TABLE);
  // Set the first (and only) time a publish push is claimed for the article, so
  // the campus-wide notification can never go out twice for one article.
  await pool.query(`ALTER TABLE abukonn.news ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ`);
  console.log('News table ready');
}

// currentUserId is optional -- GET /api/news has never required login (see
// the optionalAuth route wiring), and news should keep working for a
// signed-out caller. `nl.user_id = $1` is simply never true when $1 is NULL,
// so is_liked correctly comes back false for an anonymous request rather
// than needing a separate branch.
async function getAllNews(currentUserId = null) {
  const result = await pool.query(
    `SELECT n.*, u.full_name AS author_name,
            EXISTS(
              SELECT 1 FROM abukonn.news_likes nl
              WHERE nl.news_id = n.id AND nl.user_id = $1
            ) AS is_liked
     FROM abukonn.news n
     LEFT JOIN abukonn.users u ON n.created_by = u.id
     ORDER BY n.created_at DESC`,
    [currentUserId]
  );
  return result.rows;
}

async function getNewsById(id, currentUserId = null) {
  const result = await pool.query(
    `SELECT n.*, u.full_name AS author_name,
            EXISTS(
              SELECT 1 FROM abukonn.news_likes nl
              WHERE nl.news_id = n.id AND nl.user_id = $2
            ) AS is_liked
     FROM abukonn.news n
     LEFT JOIN abukonn.users u ON n.created_by = u.id
     WHERE n.id = $1`,
    [id, currentUserId]
  );
  return result.rows[0] || null;
}

// Mirrors Post.toggleLike exactly: check existence, delete-or-insert, adjust
// the denormalised counter with a floor at 0 so a race can never take it
// negative. Requires a real userId -- the /like route sits behind the
// REQUIRED `auth` middleware, unlike the GETs above.
async function toggleLike(newsId, userId) {
  const existing = await pool.query(
    `SELECT 1 FROM abukonn.news_likes WHERE news_id = $1 AND user_id = $2`,
    [newsId, userId]
  );
  const alreadyLiked = existing.rows.length > 0;

  if (alreadyLiked) {
    await pool.query(`DELETE FROM abukonn.news_likes WHERE news_id = $1 AND user_id = $2`, [newsId, userId]);
    await pool.query(`UPDATE abukonn.news SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`, [newsId]);
  } else {
    await pool.query(`INSERT INTO abukonn.news_likes (news_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [newsId, userId]);
    await pool.query(`UPDATE abukonn.news SET likes_count = likes_count + 1 WHERE id = $1`, [newsId]);
  }

  const { rows } = await pool.query(`SELECT likes_count FROM abukonn.news WHERE id = $1`, [newsId]);
  return { likes_count: rows[0]?.likes_count ?? 0, is_liked: !alreadyLiked };
}

// News no longer has user-facing categories, but the column is NOT NULL with a
// CHECK, so every article is stored as 'general'.
async function createNews({ title, content, category = 'general', imageUrl, createdBy }) {
  const result = await pool.query(
    `INSERT INTO abukonn.news (title, content, category, image_url, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, content, category, imageUrl || null, createdBy]
  );
  return result.rows[0];
}

// Articles published after the user last opened News, not counting their own
// (an author shouldn't see a badge for what they just posted). A NULL
// last_seen_news_at -- or no such user -- means "never seen": everything counts.
async function getUnreadCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM abukonn.news n
     WHERE n.created_by IS DISTINCT FROM $1
       AND n.created_at > COALESCE(
         (SELECT last_seen_news_at FROM abukonn.users WHERE id = $1),
         '-infinity'::timestamptz
       )`,
    [userId]
  );
  return rows[0].count;
}

async function markSeen(userId) {
  await pool.query(`UPDATE abukonn.users SET last_seen_news_at = NOW() WHERE id = $1`, [userId]);
}

// Atomically claims the right to announce an article. Exactly one caller ever
// gets true, however many times this is invoked for the same id.
async function claimNotification(newsId) {
  const { rows } = await pool.query(
    `UPDATE abukonn.news SET notified_at = NOW()
     WHERE id = $1 AND notified_at IS NULL
     RETURNING id`,
    [newsId]
  );
  return rows.length > 0;
}

module.exports = {
  CREATE_NEWS_TABLE,
  CREATE_NEWS_LIKES_TABLE,
  createNewsTable,
  getAllNews,
  getNewsById,
  createNews,
  toggleLike,
  getUnreadCount,
  markSeen,
  claimNotification,
};
