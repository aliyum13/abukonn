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

const GROUPABLE = new Set(['like', 'comment', 'follow']);

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

async function getGroupedNotifications(userId) {
  const result = await pool.query(
    `SELECT n.id, n.type, n.post_id, n.is_read, n.created_at,
            u.id AS sender_id,
            u.full_name AS sender_name,
            u.profile_photo_url AS sender_photo
     FROM abukonn.notifications n
     JOIN abukonn.users u ON n.sender_id = u.id
     WHERE n.recipient_id = $1
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [userId]
  );

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const groupMap = new Map();
  const ordered = [];

  for (const row of result.rows) {
    const isRecent = new Date(row.created_at).getTime() > cutoff;
    const canGroup = GROUPABLE.has(row.type) && isRecent;

    if (canGroup) {
      const key = `${row.type}_${row.post_id ?? 'null'}`;
      if (!groupMap.has(key)) {
        const group = {
          id: `group_${key}`,
          notification_ids: [],
          type: row.type,
          post_id: row.post_id,
          actors: [],
          actor_count: 0,
          is_read: true,
          latest_at: row.created_at,
        };
        groupMap.set(key, group);
        ordered.push(group);
      }
      const g = groupMap.get(key);
      g.notification_ids.push(row.id);
      g.actor_count += 1;
      if (!row.is_read) g.is_read = false;
      if (g.actors.length < 3 && !g.actors.find(a => a.id === row.sender_id)) {
        g.actors.push({ id: row.sender_id, full_name: row.sender_name, profile_photo_url: row.sender_photo });
      }
    } else {
      ordered.push({
        id: `single_${row.id}`,
        notification_ids: [row.id],
        type: row.type,
        post_id: row.post_id,
        actors: [{ id: row.sender_id, full_name: row.sender_name, profile_photo_url: row.sender_photo }],
        actor_count: 1,
        is_read: row.is_read,
        latest_at: row.created_at,
      });
    }
  }

  return ordered.slice(0, 30);
}

async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*) FROM (
       SELECT CASE
         WHEN type IN ('like','comment','follow')
           AND created_at > NOW() - INTERVAL '24 hours'
         THEN type || '_' || COALESCE(post_id::text, 'null')
         ELSE 'single_' || id::text
       END AS group_key
       FROM abukonn.notifications
       WHERE recipient_id = $1 AND is_read = FALSE
       GROUP BY group_key
     ) t`,
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

async function markManyRead(ids, userId) {
  if (!ids.length) return;
  await pool.query(
    `UPDATE abukonn.notifications SET is_read = TRUE
     WHERE id = ANY($1) AND recipient_id = $2`,
    [ids, userId]
  );
}

module.exports = {
  createNotificationsTable,
  createNotification,
  getGroupedNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  markManyRead,
};
