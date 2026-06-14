require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool
  .connect()
  .then((client) => {
    console.log('Successfully connected to PostgreSQL database');
    client.release();
  })
  .catch((err) => {
    console.error('Failed to connect to PostgreSQL database:', err.message);
  });

module.exports = pool;
