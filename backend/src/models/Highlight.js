const pool = require('../config/db');

const createHighlightsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.highlights (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL CHECK (type IN ('announcement', 'exam', 'deadline', 'event')),
      start_date TIMESTAMP WITH TIME ZONE,
      end_date TIMESTAMP WITH TIME ZONE,
      priority INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const getActiveHighlights = async () => {
  const result = await pool.query(`
    SELECT h.*, u.full_name AS creator_name
    FROM abukonn.highlights h
    LEFT JOIN abukonn.users u ON u.id = h.created_by
    WHERE h.is_active = TRUE
    ORDER BY h.priority DESC, h.created_at DESC
    LIMIT 5
  `);
  return result.rows;
};

const getAllHighlights = async () => {
  const result = await pool.query(`
    SELECT h.*, u.full_name AS creator_name
    FROM abukonn.highlights h
    LEFT JOIN abukonn.users u ON u.id = h.created_by
    ORDER BY h.priority DESC, h.created_at DESC
  `);
  return result.rows;
};

const createHighlight = async ({ title, description, type, startDate, endDate, priority, createdBy }) => {
  const result = await pool.query(
    `INSERT INTO abukonn.highlights (title, description, type, start_date, end_date, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [title, description || null, type, startDate || null, endDate || null, priority || 0, createdBy]
  );
  return result.rows[0];
};

const updateHighlight = async (id, fields) => {
  const cols = ['title', 'description', 'type', 'start_date', 'end_date', 'priority', 'is_active'];
  const keys = ['title', 'description', 'type', 'startDate', 'endDate', 'priority', 'isActive'];
  const setClauses = [];
  const values = [];
  let idx = 1;
  cols.forEach((col, i) => {
    const val = fields[keys[i]];
    if (val !== undefined) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(val);
    }
  });
  if (!setClauses.length) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE abukonn.highlights SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

const deleteHighlight = async (id) => {
  const result = await pool.query('DELETE FROM abukonn.highlights WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
};

module.exports = { createHighlightsTable, getActiveHighlights, getAllHighlights, createHighlight, updateHighlight, deleteHighlight };
