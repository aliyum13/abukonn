const pool = require('../config/db');

// One row per (viewer, post) pair -- gives a REAL unique-viewer count,
// distinct from posts.view_count (a raw increment-on-every-view counter that
// already exists and feeds engagement_score/trending -- deliberately left
// untouched by this table, not replaced). Same upsert shape as
// ProfileView.js: re-viewing the same post just bumps viewed_at rather than
// inserting a new row, so COUNT(*) always reflects unique people, not raw
// visits.
const CREATE_POST_VIEWS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.post_views (
  viewer_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (viewer_id, post_id)
);
`;

async function createPostViewsTable() {
  await pool.query(CREATE_POST_VIEWS_TABLE);
  // Read pattern is "unique viewer count for post X" -- post_id alone
  // already covers that via the primary key's leading... actually the PK is
  // (viewer_id, post_id), so a lookup by post_id needs its own index.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_post_views_post ON abukonn.post_views(post_id)`);
  console.log('Post views table ready');
}

// Records that viewerId viewed postId. Fire-and-forget from the existing
// viewPost endpoint, alongside (not instead of) the existing raw
// incrementViewCount call. No self-view guard needed the way ProfileView has
// one -- viewing your own post is a normal, meaningful thing to count as a
// unique viewer of it (unlike a profile "view" of yourself, which is never
// a real signal).
async function recordView(viewerId, postId) {
  await pool.query(
    `INSERT INTO abukonn.post_views (viewer_id, post_id, viewed_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (viewer_id, post_id) DO UPDATE SET viewed_at = CURRENT_TIMESTAMP`,
    [viewerId, postId]
  );
}

// Unique viewer count for one post -- the number analytics actually wants,
// as opposed to posts.view_count's raw increment-per-view.
async function getUniqueViewerCount(postId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM abukonn.post_views WHERE post_id = $1`,
    [postId]
  );
  return result.rows[0].count;
}

// Batch version for a whole page of a user's posts (analytics screen) --
// one query instead of N, same batching discipline as getMediaForPosts.
async function getUniqueViewerCounts(postIds) {
  if (!postIds || postIds.length === 0) return {};
  const result = await pool.query(
    `SELECT post_id, COUNT(*)::int AS count
     FROM abukonn.post_views WHERE post_id = ANY($1::int[])
     GROUP BY post_id`,
    [postIds]
  );
  const byPost = {};
  for (const row of result.rows) byPost[row.post_id] = row.count;
  return byPost;
}

module.exports = { createPostViewsTable, recordView, getUniqueViewerCount, getUniqueViewerCounts };
