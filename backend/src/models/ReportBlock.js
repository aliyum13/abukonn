const pool = require('../config/db');

// ── Schema ────────────────────────────────────────────────────────────────────

const CREATE_REPORTS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.reports (
  id SERIAL PRIMARY KEY,
  reporter_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  reported_user_id INTEGER REFERENCES abukonn.users(id) ON DELETE CASCADE,
  reported_post_id INTEGER REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  details TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by INTEGER REFERENCES abukonn.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT report_has_target CHECK (
    reported_user_id IS NOT NULL OR reported_post_id IS NOT NULL
  )
);`;

const CREATE_BLOCKS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.blocks (
  blocker_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (blocker_id, blocked_id)
);`;

async function createReportBlockTables() {
  await pool.query(CREATE_REPORTS_TABLE);
  await pool.query(CREATE_BLOCKS_TABLE);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reports_status ON abukonn.reports(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON abukonn.blocks(blocker_id)`);
  console.log('Report/Block tables ready');
}

// ── Reports ───────────────────────────────────────────────────────────────────

async function createReport({ reporterId, reportedUserId = null, reportedPostId = null, reason, details = null }) {
  // Prevent duplicate pending reports from the same user on the same target
  const exists = await pool.query(
    `SELECT id FROM abukonn.reports
     WHERE reporter_id = $1
       AND status = 'pending'
       AND (reported_user_id = $2 OR reported_post_id = $3)`,
    [reporterId, reportedUserId, reportedPostId]
  );
  if (exists.rows.length > 0) return { duplicate: true };

  const { rows } = await pool.query(
    `INSERT INTO abukonn.reports (reporter_id, reported_user_id, reported_post_id, reason, details)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [reporterId, reportedUserId, reportedPostId, reason, details || null]
  );
  return { report: rows[0] };
}

async function getReports({ status = 'pending', limit = 50, offset = 0 }) {
  const { rows } = await pool.query(
    `SELECT
       r.id, r.reason, r.details, r.status, r.created_at, r.reviewed_at,
       reporter.full_name AS reporter_name, reporter.username AS reporter_username,
       ru.full_name AS reported_user_name, ru.username AS reported_user_username, ru.id AS reported_user_id,
       p.content AS reported_post_content, p.id AS reported_post_id,
       admin.full_name AS reviewed_by_name
     FROM abukonn.reports r
     LEFT JOIN abukonn.users reporter ON r.reporter_id = reporter.id
     LEFT JOIN abukonn.users ru ON r.reported_user_id = ru.id
     LEFT JOIN abukonn.posts p ON r.reported_post_id = p.id
     LEFT JOIN abukonn.users admin ON r.reviewed_by = admin.id
     WHERE ($1::text = 'all' OR r.status = $1)
     ORDER BY r.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset]
  );
  return rows;
}

async function resolveReport({ reportId, adminId, status }) {
  const { rows } = await pool.query(
    `UPDATE abukonn.reports
     SET status = $1, reviewed_by = $2, reviewed_at = NOW()
     WHERE id = $3 RETURNING *`,
    [status, adminId, reportId]
  );
  return rows[0] || null;
}

// ── Blocks ───────────────────────────────────────────────────────────────────

async function blockUser(blockerId, blockedId) {
  await pool.query(
    `INSERT INTO abukonn.blocks (blocker_id, blocked_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [blockerId, blockedId]
  );
}

async function unblockUser(blockerId, blockedId) {
  await pool.query(
    `DELETE FROM abukonn.blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
}

async function getBlockList(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.profile_photo_url
     FROM abukonn.blocks b
     JOIN abukonn.users u ON b.blocked_id = u.id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return rows;
}

async function isBlocked(blockerId, blockedId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abukonn.blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId]
  );
  return rows.length > 0;
}

// Used in feed/profile queries to filter out blocked users' content
async function getBlockedUserIds(userId) {
  const { rows } = await pool.query(
    `SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1`,
    [userId]
  );
  return rows.map(r => r.blocked_id);
}

module.exports = {
  createReportBlockTables,
  createReport,
  getReports,
  resolveReport,
  blockUser,
  unblockUser,
  getBlockList,
  isBlocked,
  getBlockedUserIds,
};
