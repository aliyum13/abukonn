const pool = require('../config/db');

const CREATE_REPLIES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.comment_replies (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES abukonn.comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_replies_comment ON abukonn.comment_replies(comment_id);`;

async function createRepliesTable() {
  await pool.query(CREATE_REPLIES_TABLE);
  console.log('Comment replies table ready');
}

async function createReply({ commentId, userId, content }) {
  const result = await pool.query(
    `INSERT INTO abukonn.comment_replies (comment_id, user_id, content)
     VALUES ($1, $2, $3) RETURNING *`,
    [commentId, userId, content]
  );
  return result.rows[0];
}

async function getRepliesByComment(commentId) {
  const result = await pool.query(
    `SELECT r.*, u.full_name AS author_name, u.profile_photo_url AS author_photo
     FROM abukonn.comment_replies r
     JOIN abukonn.users u ON r.user_id = u.id
     WHERE r.comment_id = $1
     ORDER BY r.created_at ASC`,
    [commentId]
  );
  return result.rows;
}

async function getReplyCountByComment(commentId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int FROM abukonn.comment_replies WHERE comment_id = $1`,
    [commentId]
  );
  return result.rows[0].count;
}

module.exports = { createRepliesTable, createReply, getRepliesByComment, getReplyCountByComment };
