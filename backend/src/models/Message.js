const pool = require('../config/db');

const CREATE_CONVERSATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.conversations (
  id SERIAL PRIMARY KEY,
  user1_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);
`;

const CREATE_MESSAGES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES abukonn.conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createMessagesTables() {
  await pool.query(CREATE_CONVERSATIONS_TABLE);
  await pool.query(CREATE_MESSAGES_TABLE);
  await pool.query(`ALTER TABLE abukonn.messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
  console.log('Messages tables ready');
}

async function findOrCreateConversation(userId1, userId2) {
  const [user1, user2] = userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];

  let result = await pool.query(
    'SELECT * FROM abukonn.conversations WHERE user1_id = $1 AND user2_id = $2',
    [user1, user2]
  );

  if (result.rows[0]) return result.rows[0];

  result = await pool.query(
    'INSERT INTO abukonn.conversations (user1_id, user2_id) VALUES ($1, $2) RETURNING *',
    [user1, user2]
  );
  return result.rows[0];
}

async function getConversations(userId) {
  const result = await pool.query(
    `SELECT c.id,
            CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END AS other_user_id,
            u.full_name AS other_user_name,
            u.department AS other_user_department,
            u.profile_photo_url AS other_user_photo,
            (SELECT m.content FROM abukonn.messages m
             WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
            (SELECT m.created_at FROM abukonn.messages m
             WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_at,
            (SELECT COUNT(*) FROM abukonn.messages m
             WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.is_read = FALSE
            )::int AS unread_count
     FROM abukonn.conversations c
     JOIN abukonn.users u ON u.id = CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
     WHERE c.user1_id = $1 OR c.user2_id = $1
     ORDER BY last_message_at DESC NULLS LAST`,
    [userId]
  );
  return result.rows;
}

async function markConversationRead(conversationId, userId) {
  await pool.query(
    `UPDATE abukonn.messages SET is_read = TRUE
     WHERE conversation_id = $1 AND sender_id != $2 AND is_read = FALSE`,
    [conversationId, userId]
  );
}

async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) FROM abukonn.messages m
     JOIN abukonn.conversations c ON m.conversation_id = c.id
     WHERE (c.user1_id = $1 OR c.user2_id = $1)
       AND m.sender_id != $1
       AND m.is_read = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

async function getMessages(conversationId, userId) {
  const conv = await pool.query(
    'SELECT * FROM abukonn.conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [conversationId, userId]
  );

  if (!conv.rows[0]) return null;

  const result = await pool.query(
    `SELECT m.*, u.full_name AS sender_name
     FROM abukonn.messages m
     JOIN abukonn.users u ON m.sender_id = u.id
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [conversationId]
  );

  return { conversation: conv.rows[0], messages: result.rows };
}

async function sendMessage({ conversationId, senderId, content, imageUrl = null }) {
  const result = await pool.query(
    `INSERT INTO abukonn.messages (conversation_id, sender_id, content, image_url)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [conversationId, senderId, content, imageUrl]
  );
  return result.rows[0];
}

async function getConversationById(conversationId, userId) {
  const result = await pool.query(
    'SELECT * FROM abukonn.conversations WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
    [conversationId, userId]
  );
  return result.rows[0] || null;
}

module.exports = {
  CREATE_CONVERSATIONS_TABLE,
  CREATE_MESSAGES_TABLE,
  createMessagesTables,
  findOrCreateConversation,
  getConversations,
  getMessages,
  sendMessage,
  getConversationById,
  markConversationRead,
  getUnreadCount,
};
