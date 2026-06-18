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
  // Add new columns to existing tables (idempotent)
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'GENERAL'`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS is_repost BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS original_post_id INTEGER`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS original_author_name TEXT`);
  console.log('Posts table ready');
}

async function createPostLikesTable() {
  await pool.query(CREATE_POST_LIKES_TABLE);
  console.log('Post likes table ready');
}

async function createPost({ userId, content, imageUrl = null, category = 'GENERAL', isRepost = false, originalPostId = null, originalAuthorName = null }) {
  const result = await pool.query(
    `INSERT INTO abukonn.posts (user_id, content, image_url, category, is_repost, original_post_id, original_author_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [userId, content, imageUrl, category, isRepost, originalPostId, originalAuthorName]
  );
  return result.rows[0];
}

async function getAllPosts(currentUserId) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo, u.matric_number AS author_matric,
            COALESCE(u.role, 'user') AS author_role,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $1 AND f.following_id = p.user_id
            ) AS is_following_author
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

async function getPostByIdForUser(id, currentUserId) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo, u.matric_number AS author_matric,
            COALESCE(u.role, 'user') AS author_role,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [id, currentUserId]
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

async function repostPost(originalPostId, userId) {
  const original = await getPostById(originalPostId);
  if (!original) throw new Error('Post not found');
  const newPost = await pool.query(
    `INSERT INTO abukonn.posts
       (user_id, content, image_url, category, is_repost, original_post_id, original_author_name)
     VALUES ($1, $2, $3, $4, TRUE, $5, $6)
     RETURNING *`,
    [
      userId,
      original.content,
      original.image_url,
      original.category || 'GENERAL',
      originalPostId,
      original.author_name,
    ]
  );
  await pool.query(
    `UPDATE abukonn.posts SET repost_count = COALESCE(repost_count, 0) + 1 WHERE id = $1`,
    [originalPostId]
  );
  return newPost.rows[0];
}

async function incrementViewCount(postId) {
  await pool.query(
    `UPDATE abukonn.posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
    [postId]
  );
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
  getPostByIdForUser,
  toggleLike,
  incrementCommentsCount,
  repostPost,
  incrementViewCount,
  deletePost,
};
