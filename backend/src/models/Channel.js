const pool = require('../config/db');

const DEFAULT_CHANNELS = [
  { name: 'General', slug: 'general', description: 'General campus discussions for all ABU students', icon: '📚', category: 'interest' },
  { name: 'Final Year', slug: 'final-year', description: 'Resources, tips, and support for final year students', icon: '🎓', category: 'year' },
  { name: 'Freshers', slug: 'freshers', description: 'New to ABU? Connect with other freshers here', icon: '🆕', category: 'year' },
  { name: 'Sports', slug: 'sports', description: 'All things sports, fitness, and competitions at ABU', icon: '⚽', category: 'interest' },
  { name: 'Jobs & Internships', slug: 'jobs-internships', description: 'Career opportunities, internship listings, and advice', icon: '💼', category: 'interest' },
  { name: 'Hostels & Accommodation', slug: 'hostels', description: 'Housing tips, hostel discussions, and roommate searches', icon: '🏠', category: 'interest' },
  { name: 'Study Groups', slug: 'study-groups', description: 'Find study partners and share academic resources', icon: '📖', category: 'interest' },
  { name: 'Events & Entertainment', slug: 'events', description: 'Campus events, concerts, shows, and entertainment', icon: '🎭', category: 'interest' },
  { name: 'Technology', slug: 'technology', description: 'Tech, coding, innovation, and digital skills', icon: '💻', category: 'department' },
  { name: 'Student Union', slug: 'student-union', description: 'SUG news, student government, and campus politics', icon: '🏛️', category: 'interest' },
];

const createChannelTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.channels (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      description TEXT,
      icon VARCHAR(10) DEFAULT '📌',
      category VARCHAR(50) NOT NULL DEFAULT 'interest',
      member_count INTEGER DEFAULT 0,
      is_official BOOLEAN DEFAULT FALSE,
      created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.channel_members (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL REFERENCES abukonn.channels(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.channel_posts (
      id SERIAL PRIMARY KEY,
      channel_id INTEGER NOT NULL REFERENCES abukonn.channels(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      pinned BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(channel_id, post_id)
    )
  `);

  for (const ch of DEFAULT_CHANNELS) {
    await pool.query(
      `INSERT INTO abukonn.channels (name, slug, description, icon, category, is_official)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (slug) DO NOTHING`,
      [ch.name, ch.slug, ch.description, ch.icon, ch.category]
    );
  }
  console.log('Channel tables ready');
};

const getAllChannels = async (userId) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.icon, c.category,
            c.member_count, c.is_official, c.created_at,
            EXISTS(
              SELECT 1 FROM abukonn.channel_members cm
              WHERE cm.channel_id = c.id AND cm.user_id = $1
            ) AS is_member
     FROM abukonn.channels c
     ORDER BY c.is_official DESC, c.member_count DESC, c.created_at ASC`,
    [userId]
  );
  return rows;
};

const getMyChannels = async (userId) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.icon, c.category,
            c.member_count, c.is_official
     FROM abukonn.channels c
     JOIN abukonn.channel_members cm ON cm.channel_id = c.id
     WHERE cm.user_id = $1
     ORDER BY cm.joined_at DESC`,
    [userId]
  );
  return rows;
};

const getChannelBySlug = async (slug, userId) => {
  const { rows } = await pool.query(
    `SELECT c.id, c.name, c.slug, c.description, c.icon, c.category,
            c.member_count, c.is_official, c.created_at,
            EXISTS(
              SELECT 1 FROM abukonn.channel_members cm
              WHERE cm.channel_id = c.id AND cm.user_id = $2
            ) AS is_member
     FROM abukonn.channels c
     WHERE c.slug = $1`,
    [slug, userId]
  );
  return rows[0] || null;
};

const createChannel = async ({ name, slug, description, icon, category, createdBy, isOfficial = false }) => {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.channels (name, slug, description, icon, category, created_by, is_official)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [name, slug, description || null, icon || '📌', category, createdBy, isOfficial]
  );
  return rows[0];
};

const joinChannel = async (channelId, userId) => {
  await pool.query(
    `INSERT INTO abukonn.channel_members (channel_id, user_id)
     VALUES ($1, $2) ON CONFLICT (channel_id, user_id) DO NOTHING`,
    [channelId, userId]
  );
  await pool.query(
    `UPDATE abukonn.channels SET member_count = (
       SELECT COUNT(*) FROM abukonn.channel_members WHERE channel_id = $1
     ) WHERE id = $1`,
    [channelId]
  );
};

const leaveChannel = async (channelId, userId) => {
  await pool.query(
    `DELETE FROM abukonn.channel_members WHERE channel_id = $1 AND user_id = $2`,
    [channelId, userId]
  );
  await pool.query(
    `UPDATE abukonn.channels SET member_count = (
       SELECT COUNT(*) FROM abukonn.channel_members WHERE channel_id = $1
     ) WHERE id = $1`,
    [channelId]
  );
};

const getChannelPosts = async (channelId, userId) => {
  const { rows } = await pool.query(
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
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author,
            cp.pinned
     FROM abukonn.channel_posts cp
     JOIN abukonn.posts p ON p.id = cp.post_id
     JOIN abukonn.users u ON u.id = p.user_id
     WHERE cp.channel_id = $1
     ORDER BY cp.pinned DESC, cp.created_at DESC`,
    [channelId, userId]
  );
  return rows;
};

const addPostToChannel = async (channelId, postId) => {
  await pool.query(
    `INSERT INTO abukonn.channel_posts (channel_id, post_id)
     VALUES ($1, $2) ON CONFLICT (channel_id, post_id) DO NOTHING`,
    [channelId, postId]
  );
};

const getAllChannelsAdmin = async () => {
  const { rows } = await pool.query(
    `SELECT id, name, slug, description, icon, category, member_count, is_official, created_at
     FROM abukonn.channels
     ORDER BY is_official DESC, member_count DESC, created_at ASC`
  );
  return rows;
};

const deleteChannel = async (id) => {
  const { rowCount } = await pool.query(
    'DELETE FROM abukonn.channels WHERE id = $1',
    [id]
  );
  return rowCount > 0;
};

module.exports = {
  createChannelTables, getAllChannels, getMyChannels, getChannelBySlug,
  createChannel, joinChannel, leaveChannel, getChannelPosts, addPostToChannel,
  getAllChannelsAdmin, deleteChannel,
};
