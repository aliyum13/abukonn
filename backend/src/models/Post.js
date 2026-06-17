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

const CREATE_POST_LIKES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.post_likes (
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);
`;

async function createPostsTable() {
  await pool.query(CREATE_POSTS_TABLE);
  console.log('Posts table ready');
}

async function createPostLikesTable() {
  await pool.query(CREATE_POST_LIKES_TABLE);
  console.log('Post likes table ready');
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

async function getAllPosts(currentUserId) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count, p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo, u.matric_number AS author_matric,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     ORDER BY p.created_at DESC`,
    [currentUserId]
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

async function toggleLike(postId, userId) {
  const existing = await pool.query(
    `SELECT 1 FROM abukonn.post_likes WHERE post_id = $1 AND user_id = $2`,
    [postId, userId]
  );
  const alreadyLiked = existing.rows.length > 0;

  if (alreadyLiked) {
    await pool.query(
      `DELETE FROM abukonn.post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );
    await pool.query(
      `UPDATE abukonn.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
      [postId]
    );
  } else {
    await pool.query(
      `INSERT INTO abukonn.post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, userId]
    );
    await pool.query(
      `UPDATE abukonn.posts SET likes_count = likes_count + 1 WHERE id = $1`,
      [postId]
    );
  }

  const result = await pool.query(
    `SELECT * FROM abukonn.posts WHERE id = $1`,
    [postId]
  );
  return { post: result.rows[0], is_liked: !alreadyLiked };
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
  createPostLikesTable,
  createPost,
  getAllPosts,
  getPostsByUserId,
  getPostById,
  toggleLike,
  incrementCommentsCount,
  deletePost,
};
