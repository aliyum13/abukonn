const pool = require('../config/db');

const CREATE_NOTIFICATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.notifications (
  id SERIAL PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  sender_id   INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'connect_request', 'connect_accepted')),
  post_id     INTEGER REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx
  ON abukonn.notifications(recipient_id);

-- Widen type constraint to include connect notifications
DO $$
BEGIN
  ALTER TABLE abukonn.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE abukonn.notifications ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like','comment','follow','connect_request','connect_accepted'));
EXCEPTION WHEN others THEN NULL;
END $$;
`;

async function createNotificationsTable() {
  await pool.query(CREATE_NOTIFICATIONS_TABLE);
  console.log('Notifications table ready');
}

async function createNotification({ recipientId, senderId, type, postId = null }) {
  if (recipientId === senderId) return null;
  const result = await pool.query(
    `INSERT INTO abukonn.notifications (recipient_id, sender_id, type, post_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [recipientId, senderId, type, postId]
  );
  return result.rows[0];
}

async function getMyNotifications(userId) {
  const result = await pool.query(
    `SELECT n.id, n.type, n.post_id, n.is_read, n.created_at,
            u.id AS sender_id,
            u.full_name AS sender_name,
            u.profile_photo_url AS sender_photo
     FROM abukonn.notifications n
     JOIN abukonn.users u ON n.sender_id = u.id
     WHERE n.recipient_id = $1
     ORDER BY n.created_at DESC
     LIMIT 20`,
    [userId]
  );
  return result.rows;
}

async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) FROM abukonn.notifications
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [userId]
  );
  return parseInt(result.rows[0].count, 10);
}

async function markAllRead(userId) {
  await pool.query(
    `UPDATE abukonn.notifications SET is_read = TRUE
     WHERE recipient_id = $1 AND is_read = FALSE`,
    [userId]
  );
}

async function markOneRead(id, userId) {
  await pool.query(
    `UPDATE abukonn.notifications SET is_read = TRUE
     WHERE id = $1 AND recipient_id = $2`,
    [id, userId]
  );
}

module.exports = {
  createNotificationsTable,
  createNotification,
  getMyNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
};
