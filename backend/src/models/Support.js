const pool = require('../config/db');

const createSupportTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.support_tickets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      email VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      category VARCHAR(50) NOT NULL,
      subject VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      status VARCHAR(20) DEFAULT 'open',
      admin_notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Support tickets table ready');
};

const createTicket = async ({ userId, email, fullName, category, subject, message }) => {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.support_tickets (user_id, email, full_name, category, subject, message)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId || null, email, fullName || null, category, subject, message]
  );
  return rows[0];
};

const getAllTickets = async () => {
  const { rows } = await pool.query(
    `SELECT st.*, u.full_name AS user_name, u.email AS user_email
     FROM abukonn.support_tickets st
     LEFT JOIN abukonn.users u ON st.user_id = u.id
     ORDER BY st.created_at DESC`
  );
  return rows;
};

const updateTicketStatus = async (id, status, adminNotes) => {
  const { rows } = await pool.query(
    `UPDATE abukonn.support_tickets
     SET status=$1, admin_notes=$2, updated_at=NOW()
     WHERE id=$3 RETURNING *`,
    [status, adminNotes || null, id]
  );
  return rows[0];
};

const getTicketById = async (id) => {
  const { rows } = await pool.query(
    `SELECT st.*, u.full_name AS user_name
     FROM abukonn.support_tickets st
     LEFT JOIN abukonn.users u ON st.user_id = u.id
     WHERE st.id=$1`,
    [id]
  );
  return rows[0];
};

module.exports = { createSupportTable, createTicket, getAllTickets, updateTicketStatus, getTicketById };
