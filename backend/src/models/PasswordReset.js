const pool = require('../config/db');

const createPasswordResetsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.password_resets (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      otp VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Password resets table ready');
};

const createReset = async (email, otp) => {
  // Invalidate any existing unused resets for this email
  await pool.query(
    `UPDATE abukonn.password_resets SET used = TRUE WHERE email = $1 AND used = FALSE`,
    [email]
  );
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  const { rows } = await pool.query(
    `INSERT INTO abukonn.password_resets (email, otp, expires_at) VALUES ($1, $2, $3) RETURNING *`,
    [email, otp, expiresAt]
  );
  return rows[0];
};

const findValidReset = async (email, otp) => {
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.password_resets
     WHERE email = $1 AND otp = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, otp]
  );
  return rows[0] || null;
};

const markUsed = async (id) => {
  await pool.query(`UPDATE abukonn.password_resets SET used = TRUE WHERE id = $1`, [id]);
};

module.exports = { createPasswordResetsTable, createReset, findValidReset, markUsed };
