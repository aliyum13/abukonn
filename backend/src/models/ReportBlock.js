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
  // Reporting a comment was never possible -- the table only ever had columns
  // (and a CHECK constraint) for a reported user or post. Add the column, and
  // widen the named CHECK constraint (report_has_target) to also accept it --
  // CREATE TABLE IF NOT EXISTS won't retroactively apply a constraint change
  // to an existing table, so this has to happen as an explicit ALTER. Purely
  // additive: the new constraint is a strict superset of the old one (adds an
  // OR branch), so no existing row can ever violate it.
  await pool.query(`ALTER TABLE abukonn.reports ADD COLUMN IF NOT EXISTS reported_comment_id INTEGER REFERENCES abukonn.comments(id) ON DELETE CASCADE`);
  await pool.query(`ALTER TABLE abukonn.reports DROP CONSTRAINT IF EXISTS report_has_target`);
  await pool.query(`
    ALTER TABLE abukonn.reports ADD CONSTRAINT report_has_target CHECK (
      reported_user_id IS NOT NULL OR reported_post_id IS NOT NULL OR reported_comment_id IS NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reports_status ON abukonn.reports(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON abukonn.blocks(blocker_id)`);
  console.log('Report/Block tables ready');
}

// ── Reports ───────────────────────────────────────────────────────────────────

async function createReport({ reporterId, reportedUserId = null, reportedPostId = null, reportedCommentId = null, reason, details = null }) {
  // Prevent duplicate pending reports from the same user on the same target.
  // Matches on the exact (user, post, comment) shape rather than "any field
  // matches" -- a comment report also carries its parent post_id (for admin
  // context, see reportComment), so an OR-based match would have wrongly
  // flagged "already reported" if the same post had a separate, unrelated
  // pending post-level report, or treated two different comments on the same
  // post as the same target. IS NOT DISTINCT FROM treats NULL = NULL as a
  // match (unlike plain =), which plain equality doesn't.
  const exists = await pool.query(
    `SELECT id FROM abukonn.reports
     WHERE reporter_id = $1
       AND status = 'pending'
       AND reported_user_id IS NOT DISTINCT FROM $2
       AND reported_post_id IS NOT DISTINCT FROM $3
       AND reported_comment_id IS NOT DISTINCT FROM $4`,
    [reporterId, reportedUserId, reportedPostId, reportedCommentId]
  );
  if (exists.rows.length > 0) return { duplicate: true };

  const { rows } = await pool.query(
    `INSERT INTO abukonn.reports (reporter_id, reported_user_id, reported_post_id, reported_comment_id, reason, details)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [reporterId, reportedUserId, reportedPostId, reportedCommentId, reason, details || null]
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
       c.content AS reported_comment_content, c.id AS reported_comment_id,
       cu.full_name AS reported_comment_author_name,
       admin.full_name AS reviewed_by_name
     FROM abukonn.reports r
     LEFT JOIN abukonn.users reporter ON r.reporter_id = reporter.id
     LEFT JOIN abukonn.users ru ON r.reported_user_id = ru.id
     LEFT JOIN abukonn.posts p ON r.reported_post_id = p.id
     LEFT JOIN abukonn.comments c ON r.reported_comment_id = c.id
     LEFT JOIN abukonn.users cu ON c.user_id = cu.id
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
