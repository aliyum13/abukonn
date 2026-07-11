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

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function createGroupTables() {
  await pool.query(CREATE_GROUPS_TABLE);
  await pool.query(CREATE_GROUP_MEMBERS_TABLE);
  await pool.query(CREATE_GROUP_MESSAGES_TABLE);

  await pool.query(`ALTER TABLE abukonn.group_members ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member'`);
  await pool.query(`ALTER TABLE abukonn.group_members ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'`);
  await pool.query(`ALTER TABLE abukonn.groups ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20)`);
  await pool.query(`ALTER TABLE abukonn.groups ADD COLUMN IF NOT EXISTS invite_enabled BOOLEAN DEFAULT TRUE`);
  await pool.query(`ALTER TABLE abukonn.groups ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.groups ADD COLUMN IF NOT EXISTS only_admins_can_add BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.groups ADD COLUMN IF NOT EXISTS description TEXT`);
  // Visibility: public groups appear in the browsable groups list and can be
  // joined (or requested) by anyone. Private groups stay invite-only and never
  // appear in discovery. Default FALSE so existing groups stay private.
  await pool.query(`ALTER TABLE abukonn.groups ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.group_messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.group_messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await pool.query(`ALTER TABLE abukonn.group_messages ADD COLUMN IF NOT EXISTS file_url TEXT`);
  await pool.query(`ALTER TABLE abukonn.group_messages ADD COLUMN IF NOT EXISTS file_name TEXT`);
  await pool.query(`ALTER TABLE abukonn.group_messages ADD COLUMN IF NOT EXISTS file_size INTEGER`);

  // Backfill invite codes
  await pool.query(`
    UPDATE abukonn.groups SET invite_code = UPPER(SUBSTR(MD5(id::TEXT || RANDOM()::TEXT), 1, 8))
    WHERE invite_code IS NULL
  `);
  try {
    await pool.query(`ALTER TABLE abukonn.groups ADD CONSTRAINT groups_invite_code_unique UNIQUE (invite_code)`);
  } catch { /* already exists */ }
  // Backfill creators as admin
  await pool.query(`
    UPDATE abukonn.group_members gm SET role = 'admin'
    FROM abukonn.groups g
    WHERE gm.group_id = g.id AND gm.user_id = g.created_by AND gm.role = 'member'
  `);

  console.log('Group tables ready');
}

async function createGroup(name, createdBy, description = null, isPublic = false, requireApproval = false) {
  for (let i = 0; i < 10; i++) {
    const inviteCode = generateInviteCode();
    try {
      const { rows } = await pool.query(
        `INSERT INTO abukonn.groups (name, created_by, description, invite_code, is_public, require_approval)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, createdBy, description, inviteCode, !!isPublic, !!requireApproval]
      );
      return rows[0];
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('Could not generate unique invite code');
}

// Browsable list of PUBLIC groups only. Private groups never appear here.
// Returns each group with its member count and the viewer's relationship to it
// ('none' | 'pending' | 'member') so the UI can show Join / Requested / Open.
async function discoverPublicGroups(userId, query = null) {
  const params = [userId];
  let where = 'g.is_public = TRUE';
  if (query && query.trim()) {
    params.push(`%${query.trim()}%`);
    where += ` AND (g.name ILIKE $${params.length} OR g.description ILIKE $${params.length})`;
  }
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.description, g.avatar_url, g.require_approval, g.created_at,
            (SELECT COUNT(*) FROM abukonn.group_members m
              WHERE m.group_id = g.id AND m.status = 'active')::int AS member_count,
            COALESCE(
              (SELECT me.status FROM abukonn.group_members me
                WHERE me.group_id = g.id AND me.user_id = $1),
              'none'
            ) AS my_status
     FROM abukonn.groups g
     WHERE ${where}
     ORDER BY member_count DESC, g.created_at DESC
     LIMIT 50`,
    params
  );
  return rows;
}

// Join a public group. If the group requires approval, the member is added as
// 'pending' and must be approved by an admin; otherwise they join immediately.
// Private groups cannot be joined this way — they remain invite-only.
async function joinPublicGroup(groupId, userId) {
  const group = await getGroupById(groupId);
  if (!group) return { ok: false, reason: 'not_found' };
  if (!group.is_public) return { ok: false, reason: 'private' };

  const { rows: existing } = await pool.query(
    `SELECT status FROM abukonn.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
  if (existing[0]) {
    return { ok: true, status: existing[0].status, already: true };
  }

  const status = group.require_approval ? 'pending' : 'active';
  await addMember(groupId, userId, 'member', status);
  return { ok: true, status, already: false };
}

async function addMember(groupId, userId, role = 'member', status = 'active') {
  await pool.query(
    `INSERT INTO abukonn.group_members (group_id, user_id, role, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (group_id, user_id) DO UPDATE SET role = $3, status = $4`,
    [groupId, userId, role, status]
  );
}

async function removeMember(groupId, userId) {
  await pool.query(
    `DELETE FROM abukonn.group_members WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId]
  );
}

async function isMember(groupId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abukonn.group_members WHERE group_id = $1 AND user_id = $2 AND status = 'active'`,
    [groupId, userId]
  );
  return rows.length > 0;
}

async function isAdmin(groupId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abukonn.group_members
     WHERE group_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'`,
    [groupId, userId]
  );
  return rows.length > 0;
}

async function countAdmins(groupId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM abukonn.group_members
     WHERE group_id = $1 AND role = 'admin' AND status = 'active'`,
    [groupId]
  );
  return parseInt(rows[0].count, 10);
}

async function setMemberRole(groupId, userId, role) {
  await pool.query(
    `UPDATE abukonn.group_members SET role = $3 WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId, role]
  );
}

async function setMemberStatus(groupId, userId, status) {
  await pool.query(
    `UPDATE abukonn.group_members SET status = $3 WHERE group_id = $1 AND user_id = $2`,
    [groupId, userId, status]
  );
}

async function getMyGroups(userId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.avatar_url, g.created_by, g.created_at, g.description,
            g.invite_code, g.invite_enabled, g.require_approval, g.only_admins_can_add,
            COUNT(DISTINCT CASE WHEN gm.status = 'active' THEN gm.user_id END)::int AS member_count,
            COUNT(DISTINCT CASE WHEN gm.status = 'pending' THEN gm.user_id END)::int AS pending_count,
            (SELECT
               CASE
                 WHEN msg.content IS NOT NULL AND msg.content != '' THEN msg.content
                 WHEN msg.file_name IS NOT NULL THEN '📎 ' || msg.file_name
                 WHEN msg.image_url IS NOT NULL THEN '📷 Image'
                 ELSE msg.content
               END
             FROM abukonn.group_messages msg
             WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) AS last_message,
            (SELECT msg.created_at FROM abukonn.group_messages msg
             WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) AS last_message_at,
            (SELECT u2.full_name FROM abukonn.group_messages msg
             JOIN abukonn.users u2 ON msg.sender_id = u2.id
             WHERE msg.group_id = g.id ORDER BY msg.created_at DESC LIMIT 1) AS last_sender_name,
            me.role AS my_role
     FROM abukonn.groups g
     JOIN abukonn.group_members gm ON gm.group_id = g.id
     JOIN abukonn.group_members me ON me.group_id = g.id AND me.user_id = $1 AND me.status = 'active'
     WHERE me.user_id = $1
     GROUP BY g.id, me.role
     ORDER BY last_message_at DESC NULLS LAST`,
    [userId]
  );
  return rows;
}

async function getGroupById(groupId) {
  const { rows } = await pool.query(
    `SELECT g.*, COUNT(CASE WHEN gm.status = 'active' THEN 1 END)::int AS member_count
     FROM abukonn.groups g
     LEFT JOIN abukonn.group_members gm ON gm.group_id = g.id
     WHERE g.id = $1
     GROUP BY g.id`,
    [groupId]
  );
  return rows[0] || null;
}

async function getGroupByInviteCode(inviteCode) {
  const { rows } = await pool.query(
    `SELECT g.*, COUNT(CASE WHEN gm.status = 'active' THEN 1 END)::int AS member_count
     FROM abukonn.groups g
     LEFT JOIN abukonn.group_members gm ON gm.group_id = g.id
     WHERE g.invite_code = $1 AND g.invite_enabled = TRUE
     GROUP BY g.id`,
    [inviteCode.toUpperCase()]
  );
  return rows[0] || null;
}

async function resetInviteCode(groupId) {
  for (let i = 0; i < 10; i++) {
    const code = generateInviteCode();
    try {
      const { rows } = await pool.query(
        `UPDATE abukonn.groups SET invite_code = $2 WHERE id = $1 RETURNING invite_code`,
        [groupId, code]
      );
      return rows[0]?.invite_code;
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
}

async function updateGroupSettings(groupId, { name, description, requireApproval, onlyAdminsCanAdd, inviteEnabled, avatarUrl, isPublic }) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); vals.push(name); }
  if (description !== undefined) { sets.push(`description = $${i++}`); vals.push(description); }
  if (requireApproval !== undefined) { sets.push(`require_approval = $${i++}`); vals.push(requireApproval); }
  if (onlyAdminsCanAdd !== undefined) { sets.push(`only_admins_can_add = $${i++}`); vals.push(onlyAdminsCanAdd); }
  if (inviteEnabled !== undefined) { sets.push(`invite_enabled = $${i++}`); vals.push(inviteEnabled); }
  if (avatarUrl !== undefined) { sets.push(`avatar_url = $${i++}`); vals.push(avatarUrl); }
  if (isPublic !== undefined) { sets.push(`is_public = $${i++}`); vals.push(!!isPublic); }
  if (!sets.length) return getGroupById(groupId);
  vals.push(groupId);
  const { rows } = await pool.query(
    `UPDATE abukonn.groups SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals
  );
  return rows[0];
}

async function deleteGroup(groupId) {
  await pool.query(`DELETE FROM abukonn.groups WHERE id = $1`, [groupId]);
}

async function getGroupMessages(groupId) {
  const { rows } = await pool.query(
    `SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.image_url, gm.file_url, gm.file_name, gm.file_size, gm.created_at, gm.is_deleted,
            u.full_name AS sender_name, u.profile_photo_url AS sender_photo
     FROM abukonn.group_messages gm
     JOIN abukonn.users u ON gm.sender_id = u.id
     WHERE gm.group_id = $1
     ORDER BY gm.created_at ASC`,
    [groupId]
  );
  return rows;
}

async function sendGroupMessage({ groupId, senderId, content, imageUrl, fileUrl = null, fileName = null, fileSize = null }) {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.group_messages (group_id, sender_id, content, image_url, file_url, file_name, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [groupId, senderId, content || '', imageUrl || null, fileUrl, fileName, fileSize]
  );
  return rows[0];
}

async function deleteGroupMessage(messageId, userId) {
  const existing = await pool.query(
    'SELECT * FROM abukonn.group_messages WHERE id = $1',
    [messageId]
  );
  const msg = existing.rows[0];
  if (!msg) return { error: 'not_found' };
  if (msg.sender_id !== userId) return { error: 'forbidden' };
  if (msg.is_deleted) return { error: 'already_deleted', message: msg };

  const result = await pool.query(
    `UPDATE abukonn.group_messages
     SET is_deleted = TRUE, content = '', image_url = NULL, file_url = NULL, file_name = NULL, file_size = NULL
     WHERE id = $1
     RETURNING *`,
    [messageId]
  );
  return { message: result.rows[0] };
}

async function getGroupMembers(groupId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.profile_photo_url, u.department, gm.role, gm.status, gm.joined_at
     FROM abukonn.group_members gm
     JOIN abukonn.users u ON gm.user_id = u.id
     WHERE gm.group_id = $1 AND gm.status = 'active'
     ORDER BY (gm.role = 'admin') DESC, gm.joined_at ASC`,
    [groupId]
  );
  return rows;
}

async function getPendingMembers(groupId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.profile_photo_url, u.department, gm.joined_at
     FROM abukonn.group_members gm
     JOIN abukonn.users u ON gm.user_id = u.id
     WHERE gm.group_id = $1 AND gm.status = 'pending'
     ORDER BY gm.joined_at ASC`,
    [groupId]
  );
  return rows;
}

module.exports = {
  discoverPublicGroups,
  joinPublicGroup,
  createGroupTables, createGroup, addMember, removeMember, isMember, isAdmin,
  countAdmins, setMemberRole, setMemberStatus, getMyGroups, getGroupById,
  getGroupByInviteCode, resetInviteCode, updateGroupSettings, deleteGroup,
  getGroupMessages, sendGroupMessage, getGroupMembers, getPendingMembers,
  deleteGroupMessage,
};
