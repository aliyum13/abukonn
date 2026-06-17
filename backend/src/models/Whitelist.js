const pool = require('../config/db');

const CREATE_WHITELIST_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.matric_whitelist (
  id SERIAL PRIMARY KEY,
  matric_number VARCHAR(50) UNIQUE NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createWhitelistTable() {
  await pool.query(CREATE_WHITELIST_TABLE);
  console.log('Whitelist table ready');
}

async function getCount() {
  const result = await pool.query('SELECT COUNT(*) AS count FROM abukonn.matric_whitelist');
  return parseInt(result.rows[0].count, 10);
}

async function getAll({ page = 1, limit = 50 } = {}) {
  const offset = (page - 1) * limit;
  const result = await pool.query(
    'SELECT matric_number, added_at FROM abukonn.matric_whitelist ORDER BY added_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
}

async function bulkInsert(matricNumbers) {
  if (!matricNumbers.length) return 0;
  const values = matricNumbers
    .map((_, i) => `($${i + 1})`)
    .join(', ');
  const result = await pool.query(
    `INSERT INTO abukonn.matric_whitelist (matric_number)
     VALUES ${values}
     ON CONFLICT (matric_number) DO NOTHING
     RETURNING id`,
    matricNumbers
  );
  return result.rowCount;
}

async function clearAll() {
  await pool.query('DELETE FROM abukonn.matric_whitelist');
}

async function isWhitelisted(matricNumber) {
  const result = await pool.query(
    'SELECT 1 FROM abukonn.matric_whitelist WHERE LOWER(matric_number) = LOWER($1)',
    [matricNumber]
  );
  return result.rows.length > 0;
}

module.exports = { createWhitelistTable, getCount, getAll, bulkInsert, clearAll, isWhitelisted };
