const pool = require('../config/db');

async function createConnectTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.connect_requests (
      id          SERIAL PRIMARY KEY,
      sender_id   INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      receiver_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      status      VARCHAR(10) NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(sender_id, receiver_id)
    );
    CREATE INDEX IF NOT EXISTS cr_receiver_idx ON abukonn.connect_requests(receiver_id);
    CREATE INDEX IF NOT EXISTS cr_sender_idx   ON abukonn.connect_requests(sender_id);

    CREATE TABLE IF NOT EXISTS abukonn.connections (
      id       SERIAL PRIMARY KEY,
      user1_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      user2_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user1_id, user2_id),
      CHECK (user1_id < user2_id)
    );
    CREATE INDEX IF NOT EXISTS conn_user1_idx ON abukonn.connections(user1_id);
    CREATE INDEX IF NOT EXISTS conn_user2_idx ON abukonn.connections(user2_id);
  `);
  console.log('Connect tables ready');
}

// ── helpers ────────────────────────────────────────────────────────────────

// ordered pair so user1 < user2
function ordered(a, b) {
  return a < b ? [a, b] : [b, a];
}

async function sendRequest(senderId, receiverId) {
  const result = await pool.query(
    `INSERT INTO abukonn.connect_requests (sender_id, receiver_id)
     VALUES ($1, $2)
     ON CONFLICT (sender_id, receiver_id) DO UPDATE
       SET status = 'pending', updated_at = NOW()
     RETURNING *`,
    [senderId, receiverId]
  );
  return result.rows[0];
}

async function cancelRequest(senderId, receiverId) {
  await pool.query(
    `DELETE FROM abukonn.connect_requests
     WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
    [senderId, receiverId]
  );
}

async function acceptRequest(requestId, receiverId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE abukonn.connect_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
      [requestId, receiverId]
    );
    if (!rows[0]) { await client.query('ROLLBACK'); return null; }
    const { sender_id } = rows[0];
    const [u1, u2] = ordered(sender_id, receiverId);
    await client.query(
      `INSERT INTO abukonn.connections (user1_id, user2_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [u1, u2]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function declineRequest(requestId, receiverId) {
  const result = await pool.query(
    `UPDATE abukonn.connect_requests
     SET status = 'declined', updated_at = NOW()
     WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
     RETURNING *`,
    [requestId, receiverId]
  );
  return result.rows[0] || null;
}

async function getIncomingRequests(userId) {
  const result = await pool.query(
    `SELECT cr.id, cr.sender_id, cr.created_at,
            u.full_name AS sender_name,
            u.username  AS sender_username,
            u.department AS sender_department,
            u.level AS sender_level,
            u.profile_photo_url AS sender_photo,
            u.role AS sender_role,
            (SELECT COUNT(*) FROM abukonn.connections c2
             WHERE (c2.user1_id = cr.sender_id OR c2.user2_id = cr.sender_id)
             AND (
               (c2.user1_id = $1 OR c2.user2_id = $1)
             )) AS mutual_count
     FROM abukonn.connect_requests cr
     JOIN abukonn.users u ON u.id = cr.sender_id
     WHERE cr.receiver_id = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getOutgoingRequests(userId) {
  const result = await pool.query(
    `SELECT cr.id, cr.receiver_id, cr.status, cr.created_at,
            u.full_name AS receiver_name,
            u.username  AS receiver_username,
            u.department AS receiver_department,
            u.profile_photo_url AS receiver_photo
     FROM abukonn.connect_requests cr
     JOIN abukonn.users u ON u.id = cr.receiver_id
     WHERE cr.sender_id = $1 AND cr.status = 'pending'
     ORDER BY cr.created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function getConnections(userId) {
  const result = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.department, u.level,
            u.profile_photo_url, u.role, c.created_at AS connected_at
     FROM abukonn.connections c
     JOIN abukonn.users u ON u.id = CASE
       WHEN c.user1_id = $1 THEN c.user2_id
       ELSE c.user1_id
     END
     WHERE c.user1_id = $1 OR c.user2_id = $1
     ORDER BY c.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// Returns null | { status, request_id, initiated_by_me }
async function getConnectionStatus(viewerId, targetId) {
  // Check if already connected
  const [u1, u2] = ordered(viewerId, targetId);
  const conn = await pool.query(
    `SELECT id FROM abukonn.connections WHERE user1_id = $1 AND user2_id = $2`,
    [u1, u2]
  );
  if (conn.rows.length > 0) return { status: 'connected' };

  // Check for pending request in either direction
  const req = await pool.query(
    `SELECT id, sender_id, status FROM abukonn.connect_requests
     WHERE ((sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1))
       AND status = 'pending'
     LIMIT 1`,
    [viewerId, targetId]
  );
  if (req.rows.length > 0) {
    const r = req.rows[0];
    return {
      status: 'pending',
      request_id: r.id,
      initiated_by_me: r.sender_id === viewerId,
    };
  }

  return { status: 'none' };
}

async function removeConnection(userId, targetId) {
  const [u1, u2] = ordered(userId, targetId);
  await pool.query(
    `DELETE FROM abukonn.connections WHERE user1_id = $1 AND user2_id = $2`,
    [u1, u2]
  );
}

module.exports = {
  createConnectTables,
  sendRequest,
  cancelRequest,
  acceptRequest,
  declineRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getConnections,
  getConnectionStatus,
  removeConnection,
};
