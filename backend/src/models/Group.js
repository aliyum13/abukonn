const pool = require('../config/db');

const CREATE_GROUPS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  created_by INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`;

const CREATE_GROUP_MEMBERS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES abukonn.groups(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, user_id)
);`;

const CREATE_GROUP_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.group_messages (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES abukonn.groups(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gm_group ON abukonn.group_messages(group_id);`;

async function createGroupTables() {
  await pool.query(CREATE_GROUPS_TABLE);
  await pool.query(CREATE_GROUP_MEMBERS_TABLE);
  await pool.query(CREATE_GROUP_MESSAGES_TABLE);
  console.log('Group tables ready');
}

async function createGroup(name, createdBy) {
  const result = await pool.query(
    `INSERT INTO abukonn.groups (name, created_by) VALUES ($1, $2) RETURNING *`,
    [name, createdBy]
  );
  return result.rows[0];
}

async function addMember(groupId, userId) {
  await pool.query(
    `INSERT INTO abukonn.group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [groupId, userId]
  );
}

async function removeMember(groupId, userId) {
  await pool.query(
    `DELETE FROM abukonn.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
}

async function isMember(groupId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM abukonn.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  return result.rows.length > 0;
}

async function getMyGroups(userId) {
  const result = await pool.query(
    `SELECT g.id, g.name, g.avatar_url, g.created_by, g.created_at,
            COUNT(DISTINCT gm.user_id)::int AS member_count,
            (SELECT msg.content FROM abukonn.group_messages msg
             WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) AS last_message,
            (SELECT msg.created_at FROM abukonn.group_messages msg
             WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) AS last_message_at,
            (SELECT u2.full_name FROM abukonn.group_messages msg
             JOIN abukonn.users u2 ON msg.sender_id = u2.id
             WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) AS last_sender_name
     FROM abukonn.groups g
     JOIN abukonn.group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = $1
     GROUP BY g.id
     ORDER BY last_message_at DESC NULLS LAST`,
    [userId]
  );
  return result.rows;
}

async function getGroupById(groupId) {
  const result = await pool.query(
    `SELECT g.*, COUNT(gm.user_id)::int AS member_count
     FROM abukonn.groups g
     LEFT JOIN abukonn.group_members gm ON gm.group_id = g.id
     WHERE g.id = $1
     GROUP BY g.id`,
    [groupId]
  );
  return result.rows[0] || null;
}

async function getGroupMessages(groupId) {
  const result = await pool.query(
    `SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.created_at,
            u.full_name AS sender_name, u.profile_photo_url AS sender_photo
     FROM abukonn.group_messages gm
     JOIN abukonn.users u ON gm.sender_id = u.id
     WHERE gm.group_id = $1
     ORDER BY gm.created_at ASC`,
    [groupId]
  );
  return result.rows;
}

async function sendGroupMessage({ groupId, senderId, content }) {
  const result = await pool.query(
    `INSERT INTO abukonn.group_messages (group_id, sender_id, content)
     VALUES ($1, $2, $3) RETURNING *`,
    [groupId, senderId, content]
  );
  return result.rows[0];
}

async function getGroupMembers(groupId) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.profile_photo_url, u.department
     FROM abukonn.group_members gm
     JOIN abukonn.users u ON gm.user_id = u.id
     WHERE gm.group_id = $1
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  return result.rows;
}

module.exports = {
  createGroupTables,
  createGroup,
  addMember,
  removeMember,
  isMember,
  getMyGroups,
  getGroupById,
  getGroupMessages,
  sendGroupMessage,
  getGroupMembers,
};
