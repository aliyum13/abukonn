const pool = require('../config/db');

const CREATE_NEWS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.news (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('academic', 'sports', 'events', 'general')),
  image_url TEXT,
  created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createNewsTable() {
  await pool.query(CREATE_NEWS_TABLE);
  console.log('News table ready');
}

async function getAllNews() {
  const result = await pool.query(
    `SELECT n.*, u.full_name AS author_name
     FROM abukonn.news n
     LEFT JOIN abukonn.users u ON n.created_by = u.id
     ORDER BY n.created_at DESC`
  );
  return result.rows;
}

async function getNewsById(id) {
  const result = await pool.query(
    `SELECT n.*, u.full_name AS author_name
     FROM abukonn.news n
     LEFT JOIN abukonn.users u ON n.created_by = u.id
     WHERE n.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createNews({ title, content, category, imageUrl, createdBy }) {
  const result = await pool.query(
    `INSERT INTO abukonn.news (title, content, category, image_url, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [title, content, category, imageUrl || null, createdBy]
  );
  return result.rows[0];
}

module.exports = {
  CREATE_NEWS_TABLE,
  createNewsTable,
  getAllNews,
  getNewsById,
  createNews,
};
