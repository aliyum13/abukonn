const pool = require('../config/db');

async function createHashtagTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.hashtags (
      id         SERIAL PRIMARY KEY,
      tag        VARCHAR(100) UNIQUE NOT NULL,
      post_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS hashtags_tag_idx       ON abukonn.hashtags(tag);
    CREATE INDEX IF NOT EXISTS hashtags_count_idx     ON abukonn.hashtags(post_count DESC);

    CREATE TABLE IF NOT EXISTS abukonn.post_hashtags (
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id)    ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES abukonn.hashtags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );
    CREATE INDEX IF NOT EXISTS ph_tag_idx ON abukonn.post_hashtags(tag_id);
  `);
  console.log('Hashtag tables ready');
}

/**
 * Extract lowercase hashtag words from post content.
 * Returns e.g. ['abukonn', 'csweek', 'campus'] for "#ABUkonn #CSWeek #campus"
 */
function extractTags(content) {
  const matches = content.match(/#([a-zA-Z0-9_]+)/g) || [];
  // deduplicate, lowercase, strip leading #
  return [...new Set(matches.map(m => m.slice(1).toLowerCase()))];
}

/**
 * Upsert hashtags for a post and link them via post_hashtags.
 * Called after createPost succeeds.
 */
async function indexPostHashtags(postId, content) {
  const tags = extractTags(content);
  if (tags.length === 0) return;

  for (const tag of tags) {
    const { rows } = await pool.query(
      `INSERT INTO abukonn.hashtags (tag, post_count)
       VALUES ($1, 1)
       ON CONFLICT (tag)
       DO UPDATE SET post_count = abukonn.hashtags.post_count + 1
       RETURNING id`,
      [tag]
    );
    const tagId = rows[0].id;
    await pool.query(
      `INSERT INTO abukonn.post_hashtags (post_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, tagId]
    );
  }
}

/**
 * Decrement post_count for each hashtag when a post is deleted.
 */
async function removePostHashtags(postId) {
  const { rows } = await pool.query(
    `DELETE FROM abukonn.post_hashtags WHERE post_id = $1 RETURNING tag_id`,
    [postId]
  );
  for (const { tag_id } of rows) {
    await pool.query(
      `UPDATE abukonn.hashtags SET post_count = GREATEST(post_count - 1, 0) WHERE id = $1`,
      [tag_id]
    );
  }
}

/** Top-N trending hashtags by post_count */
async function getTrending(limit = 10) {
  const { rows } = await pool.query(
    `SELECT tag, post_count FROM abukonn.hashtags
     WHERE post_count > 0
     ORDER BY post_count DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

/** All posts tagged with a given hashtag (normalized lowercase) */
async function getPostsByTag(tag, currentUserId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0)   AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE)    AS is_repost,
            p.original_post_id, p.original_author_name,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author
     FROM abukonn.post_hashtags ph
     JOIN abukonn.hashtags      h  ON h.id = ph.tag_id AND h.tag = $1
     JOIN abukonn.posts         p  ON p.id = ph.post_id
     JOIN abukonn.users         u  ON u.id = p.user_id
     ORDER BY p.created_at DESC`,
    [tag.toLowerCase(), currentUserId]
  );
  return rows;
}

/** Search hashtags by prefix for the search page */
async function searchHashtags(query, limit = 20) {
  const { rows } = await pool.query(
    `SELECT tag, post_count FROM abukonn.hashtags
     WHERE tag ILIKE $1 AND post_count > 0
     ORDER BY post_count DESC
     LIMIT $2`,
    [`%${query.toLowerCase()}%`, limit]
  );
  return rows;
}

/** Get single hashtag meta (tag + post_count) */
async function getHashtagMeta(tag) {
  const { rows } = await pool.query(
    `SELECT tag, post_count FROM abukonn.hashtags WHERE tag = $1`,
    [tag.toLowerCase()]
  );
  return rows[0] || null;
}

module.exports = {
  createHashtagTables,
  extractTags,
  indexPostHashtags,
  removePostHashtags,
  getTrending,
  getPostsByTag,
  searchHashtags,
  getHashtagMeta,
};
