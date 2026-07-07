const pool = require('../config/db');

const CREATE_COMMENTS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createCommentsTable() {
  await pool.query(CREATE_COMMENTS_TABLE);
  await pool.query(`ALTER TABLE abukonn.comments ADD COLUMN IF NOT EXISTS is_best_answer BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.comments ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.comment_likes (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES abukonn.comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comment_id, user_id)
    )
  `);
  console.log('Comments table ready');
}

// Toggle a like on a comment. Returns { liked, likes_count }.
async function toggleCommentLike(commentId, userId) {
  const existing = await pool.query(
    'SELECT id FROM abukonn.comment_likes WHERE comment_id = $1 AND user_id = $2',
    [commentId, userId]
  );
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM abukonn.comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
    const { rows } = await pool.query(
      'UPDATE abukonn.comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1 RETURNING likes_count',
      [commentId]
    );
    return { liked: false, likes_count: rows[0]?.likes_count ?? 0 };
  }
  await pool.query('INSERT INTO abukonn.comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, userId]);
  const { rows } = await pool.query(
    'UPDATE abukonn.comments SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
    [commentId]
  );
  return { liked: true, likes_count: rows[0]?.likes_count ?? 0 };
}

// Delete a comment — only by its author. Returns the deleted row (or null).
async function deleteComment(commentId, userId) {
  const { rows } = await pool.query(
    'DELETE FROM abukonn.comments WHERE id = $1 AND user_id = $2 RETURNING post_id',
    [commentId, userId]
  );
  return rows[0] || null;
}

async function createComment({ postId, userId, content }) {
  const result = await pool.query(
    `INSERT INTO abukonn.comments (post_id, user_id, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [postId, userId, content]
  );
  return result.rows[0];
}

async function getCommentsByPost(postId, currentUserId = null) {
  const result = await pool.query(
    `SELECT c.*, u.full_name AS author_name, u.profile_photo_url AS author_photo,
            COALESCE(c.is_best_answer, FALSE) AS is_best_answer,
            COALESCE(c.likes_count, 0) AS likes_count,
            EXISTS(SELECT 1 FROM abukonn.comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2) AS is_liked,
            (SELECT COUNT(*) FROM abukonn.comment_replies cr WHERE cr.comment_id = c.id)::int AS reply_count
     FROM abukonn.comments c
     JOIN abukonn.users u ON c.user_id = u.id
     WHERE c.post_id = $1
     ORDER BY c.is_best_answer DESC, c.created_at ASC`,
    [postId, currentUserId]
  );
  return result.rows;
}

async function getCommentsByUser(userId) {
  // A user's replies (comments), each with a snippet of the post they replied to,
  // so the profile Replies tab can show context. Excludes comments on posts by
  // blocked users in either direction.
  const result = await pool.query(
    `SELECT c.id, c.content, c.created_at, c.post_id,
            p.content AS post_content,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title AS post_title,
            pu.full_name AS post_author_name
     FROM abukonn.comments c
     JOIN abukonn.posts p ON c.post_id = p.id
     JOIN abukonn.users pu ON p.user_id = pu.id
     WHERE c.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function markBestAnswer(commentId, postId, ownerId) {
  const { rows: postRows } = await pool.query(
    'SELECT user_id FROM abukonn.posts WHERE id = $1',
    [postId]
  );
  if (!postRows[0] || postRows[0].user_id !== ownerId) throw new Error('Unauthorized');
  await pool.query(
    'UPDATE abukonn.comments SET is_best_answer = FALSE WHERE post_id = $1',
    [postId]
  );
  await pool.query(
    'UPDATE abukonn.comments SET is_best_answer = TRUE WHERE id = $1 AND post_id = $2',
    [commentId, postId]
  );
}

module.exports = {
  CREATE_COMMENTS_TABLE,
  createCommentsTable,
  createComment,
  getCommentsByPost,
  getCommentsByUser,
  toggleCommentLike,
  deleteComment,
  markBestAnswer,
};
