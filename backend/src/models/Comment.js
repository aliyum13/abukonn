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
  console.log('Comments table ready');
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

async function getCommentsByPost(postId) {
  const result = await pool.query(
    `SELECT c.*, u.full_name AS author_name, u.profile_photo_url AS author_photo
     FROM abukonn.comments c
     JOIN abukonn.users u ON c.user_id = u.id
     WHERE c.post_id = $1
     ORDER BY c.created_at ASC`,
    [postId]
  );
  return result.rows;
}

module.exports = {
  CREATE_COMMENTS_TABLE,
  createCommentsTable,
  createComment,
  getCommentsByPost,
};
