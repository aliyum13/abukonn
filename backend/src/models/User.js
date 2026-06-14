const pool = require('../config/db');

const CREATE_USERS_TABLE = `
CREATE SCHEMA IF NOT EXISTS abukonn;

CREATE TABLE IF NOT EXISTS abukonn.users (
  id SERIAL PRIMARY KEY,
  matric_number VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  department VARCHAR(100) NOT NULL,
  level VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  profile_photo_url TEXT,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createUsersTable() {
  await pool.query(CREATE_USERS_TABLE);
  console.log('Users table ready');
}

async function findByMatricNumber(matricNumber) {
  const result = await pool.query(
    'SELECT * FROM abukonn.users WHERE matric_number = $1',
    [matricNumber]
  );
  return result.rows[0] || null;
}

async function findByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM abukonn.users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT id, matric_number, full_name, email, department, level, profile_photo_url, bio, created_at
     FROM abukonn.users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateProfile(id, { bio, department, level }) {
  const result = await pool.query(
    `UPDATE abukonn.users
     SET bio = COALESCE($2, bio),
         department = COALESCE($3, department),
         level = COALESCE($4, level)
     WHERE id = $1
     RETURNING id, matric_number, full_name, email, department, level, profile_photo_url, bio, created_at`,
    [id, bio ?? null, department ?? null, level ?? null]
  );
  return result.rows[0] || null;
}

async function createUser({ matricNumber, fullName, email, department, level, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO abukonn.users (matric_number, full_name, email, department, level, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, matric_number, full_name, email, department, level, profile_photo_url, bio, created_at`,
    [matricNumber, fullName, email, department, level, passwordHash]
  );
  return result.rows[0];
}

function toPublicUser(user) {
  return {
    id: user.id,
    matric_number: user.matric_number,
    full_name: user.full_name,
    email: user.email,
    department: user.department,
    level: user.level,
    profile_photo_url: user.profile_photo_url,
    bio: user.bio,
    created_at: user.created_at,
  };
}

module.exports = {
  CREATE_USERS_TABLE,
  createUsersTable,
  findByMatricNumber,
  findByEmail,
  findById,
  updateProfile,
  createUser,
  toPublicUser,
};
