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
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS post_subtype VARCHAR(20) DEFAULT 'post'`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS discussion_title TEXT`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS poll_duration_hours INTEGER`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS poll_ends_at TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_title VARCHAR(200)`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_date TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_location VARCHAR(200)`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_rsvp_count INTEGER DEFAULT 0`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.poll_options (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      option_text VARCHAR(200) NOT NULL,
      vote_count INTEGER DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.poll_votes (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL REFERENCES abukonn.poll_options(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.event_rsvps (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )
  `);
  console.log('Posts table ready');
}

async function createPostLikesTable() {
  await pool.query(CREATE_POST_LIKES_TABLE);
  console.log('Post likes table ready');
}

async function createPost({ userId, content, imageUrl = null, category = 'GENERAL', isRepost = false, originalPostId = null, originalAuthorName = null, postSubtype = 'post', discussionTitle = null, pollOptions = null, pollDurationHours = null, eventTitle = null, eventDate = null, eventLocation = null }) {
  const pollEndsAt = (postSubtype === 'poll' && pollDurationHours)
    ? new Date(Date.now() + pollDurationHours * 3600000).toISOString()
    : null;

  const result = await pool.query(
    `INSERT INTO abukonn.posts (user_id, content, image_url, category, is_repost, original_post_id, original_author_name, post_subtype, discussion_title, poll_duration_hours, poll_ends_at, event_title, event_date, event_location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [userId, content, imageUrl, category, isRepost, originalPostId, originalAuthorName, postSubtype, discussionTitle, pollDurationHours || null, pollEndsAt, eventTitle || null, eventDate || null, eventLocation || null]
  );
  const post = result.rows[0];

  if (postSubtype === 'poll' && Array.isArray(pollOptions)) {
    for (const text of pollOptions.filter(t => t?.trim())) {
      await pool.query(
        'INSERT INTO abukonn.poll_options (post_id, option_text) VALUES ($1, $2)',
        [post.id, text.trim()]
      );
    }
  }

  return post;
}

async function getFollowingPosts(currentUserId) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked,
            TRUE AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $1) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $1) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     WHERE p.user_id IN (
       SELECT following_id FROM abukonn.follows WHERE follower_id = $1
     )
     AND p.user_id NOT IN (
       SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1
     )
     ORDER BY p.created_at DESC`,
    [currentUserId]
  );
  return result.rows;
}

async function getAllPosts(currentUserId) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            orig_u.full_name AS original_author_full_name,
            orig_u.profile_photo_url AS original_author_photo,
            orig_u.id AS original_author_id,
            COALESCE(orig.likes_count, 0) AS original_likes_count,
            COALESCE(orig.comments_count, 0) AS original_comments_count,
            COALESCE(orig.repost_count, 0) AS original_repost_count,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $1 AND f.following_id = p.user_id
            ) AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $1) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $1) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     LEFT JOIN abukonn.posts orig ON p.is_repost = TRUE AND orig.id = p.original_post_id
     LEFT JOIN abukonn.users orig_u ON orig.user_id = orig_u.id
     WHERE p.user_id NOT IN (
       SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1
     )
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
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $2) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $2) AS is_attending
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

async function decrementCommentsCount(id) {
  await pool.query(
    `UPDATE abukonn.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1`,
    [id]
  );
}

async function getPostsByUserId(userId, currentUserId = null) {
  // Use the viewer's id for is_liked/voted/attending flags; fall back to the
  // profile owner when no viewer is passed. Returns the same rich shape as the
  // feed so the profile can render polls, events, questions, etc. fully.
  const viewerId = currentUserId || userId;
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $2) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $2) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId, viewerId]
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

async function votePoll(postId, userId, optionId) {
  const { rows } = await pool.query('SELECT poll_ends_at FROM abukonn.posts WHERE id = $1', [postId]);
  if (!rows[0]) throw new Error('Post not found');
  if (rows[0].poll_ends_at && new Date(rows[0].poll_ends_at) < new Date()) {
    throw new Error('Poll has ended');
  }
  await pool.query(
    'INSERT INTO abukonn.poll_votes (post_id, user_id, option_id) VALUES ($1, $2, $3)',
    [postId, userId, optionId]
  );
  await pool.query('UPDATE abukonn.poll_options SET vote_count = vote_count + 1 WHERE id = $1', [optionId]);
}

// Who voted for what on a poll — grouped by option. Owner-only (enforced in
// the controller). Returns each option with the list of voters.
async function getPollVoters(postId) {
  const { rows } = await pool.query(
    `SELECT po.id AS option_id, po.option_text,
            COALESCE(
              json_agg(
                json_build_object('user_id', u.id, 'full_name', u.full_name,
                                  'profile_photo_url', u.profile_photo_url,
                                  'department', u.department)
                ORDER BY u.full_name
              ) FILTER (WHERE u.id IS NOT NULL),
              '[]'
            ) AS voters
     FROM abukonn.poll_options po
     LEFT JOIN abukonn.poll_votes pv ON pv.option_id = po.id
     LEFT JOIN abukonn.users u ON pv.user_id = u.id
     WHERE po.post_id = $1
     GROUP BY po.id, po.option_text
     ORDER BY po.id`,
    [postId]
  );
  return rows;
}

async function toggleEventRSVP(postId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM abukonn.event_rsvps WHERE post_id = $1 AND user_id = $2',
    [postId, userId]
  );
  if (rows.length > 0) {
    await pool.query('DELETE FROM abukonn.event_rsvps WHERE post_id = $1 AND user_id = $2', [postId, userId]);
    await pool.query('UPDATE abukonn.posts SET event_rsvp_count = GREATEST(COALESCE(event_rsvp_count,0) - 1, 0) WHERE id = $1', [postId]);
    return { attending: false };
  }
  await pool.query('INSERT INTO abukonn.event_rsvps (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
  await pool.query('UPDATE abukonn.posts SET event_rsvp_count = COALESCE(event_rsvp_count, 0) + 1 WHERE id = $1', [postId]);
  return { attending: true };
}

module.exports = {
  CREATE_POSTS_TABLE,
  createPostsTable,
  createPostLikesTable,
  createPost,
  getAllPosts,
  getFollowingPosts,
  getPostsByUserId,
  getPostById,
  getPostByIdForUser,
  toggleLike,
  incrementCommentsCount,
  decrementCommentsCount,
  repostPost,
  incrementViewCount,
  deletePost,
  votePoll,
  getPollVoters,
  toggleEventRSVP,
};
