const pool = require('../config/db');

const CREATE_POSTS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createPostsTable() {
  await pool.query(CREATE_POSTS_TABLE);
  console.log('Posts table ready');
}

async function createPost({ userId, content, imageUrl = null }) {
  const result = await pool.query(
    `INSERT INTO abukonn.posts (user_id, content, image_url)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, content, imageUrl]
  );
  return result.rows[0];
}

async function getAllPosts() {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count, p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo, u.matric_number AS author_matric
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     ORDER BY p.created_at DESC`
  );
  return result.rows;
}

async function getPostById(id) {
  const result = await pool.query(
    `SELECT p.*, u.full_name AS author_name, u.department AS author_department
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function likePost(id) {
  const result = await pool.query(
    `UPDATE abukonn.posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

async function incrementCommentsCount(id) {
  await pool.query(
    `UPDATE abukonn.posts SET comments_count = comments_count + 1 WHERE id = $1`,
    [id]
  );
}

async function getPostsByUserId(userId) {
  const result = await pool.query(
    `SELECT id, user_id, content, image_url, likes_count, comments_count, created_at
     FROM abukonn.posts WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function deletePost(id) {
  const result = await pool.query(
    'DELETE FROM abukonn.posts WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  CREATE_POSTS_TABLE,
  createPostsTable,
  createPost,
  getAllPosts,
  getPostsByUserId,
  getPostById,
  likePost,
  incrementCommentsCount,
  deletePost,
};
