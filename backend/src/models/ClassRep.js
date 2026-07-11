const pool = require('../config/db');

// Class representatives are scoped to a specific department + level. Unlike the
// admin-panel roles (which live on users.role), a rep's authority is tied to a
// (department, level) pair, so it needs its own table. A user could in theory
// rep more than one class, so the unique key is (user, department, level).

const CREATE_CLASS_REPS_TABLE = `
  CREATE TABLE IF NOT EXISTS abukonn.class_representatives (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
    department VARCHAR(200) NOT NULL,
    level VARCHAR(50) NOT NULL,
    assigned_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, department, level)
  )
`;

async function createClassRepsTable() {
  await pool.query(CREATE_CLASS_REPS_TABLE);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_class_reps_user ON abukonn.class_representatives(user_id)`
  );
  console.log('Class representatives table ready');
}

async function assignClassRep(userId, department, level, assignedBy) {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.class_representatives (user_id, department, level, assigned_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, department, level) DO NOTHING
     RETURNING *`,
    [userId, department, level, assignedBy]
  );
  return rows[0] || null;
}

async function removeClassRep(id) {
  const { rows } = await pool.query(
    `DELETE FROM abukonn.class_representatives WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function getClassRepsForUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, department, level FROM abukonn.class_representatives WHERE user_id = $1`,
    [userId]
  );
  return rows;
}

async function isClassRepFor(userId, department, level) {
  const { rows } = await pool.query(
    `SELECT 1 FROM abukonn.class_representatives
     WHERE user_id = $1 AND department = $2 AND level = $3
     LIMIT 1`,
    [userId, department, level]
  );
  return rows.length > 0;
}

async function getAllClassReps() {
  const { rows } = await pool.query(
    `SELECT cr.id, cr.department, cr.level, cr.created_at,
            u.id AS user_id, u.full_name, u.profile_photo_url, u.username
     FROM abukonn.class_representatives cr
     JOIN abukonn.users u ON cr.user_id = u.id
     ORDER BY cr.department, cr.level, u.full_name`
  );
  return rows;
}

module.exports = {
  CREATE_CLASS_REPS_TABLE,
  createClassRepsTable,
  assignClassRep,
  removeClassRep,
  getClassRepsForUser,
  isClassRepFor,
  getAllClassReps,
};
