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
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE abukonn.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE abukonn.users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE abukonn.users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE abukonn.users ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Backfill: pre-existing admin accounts may have is_admin=true but role='user'
-- (the two were managed separately historically). Sync them so role-based admin
-- scoping works. Only touches accounts that are admin but not already a scoped
-- admin-panel role.
UPDATE abukonn.users
SET role = 'admin'
WHERE is_admin = TRUE
  AND role NOT IN ('admin', 'class_coordinator', 'editor');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_email_unique' AND conrelid = 'abukonn.users'::regclass
  ) THEN
    ALTER TABLE abukonn.users ADD CONSTRAINT users_email_unique UNIQUE (email);
  END IF;
END $$;

-- Back-fill step 1: set base username where it's unique
UPDATE abukonn.users u
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'))
WHERE username IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM abukonn.users other
    WHERE other.id <> u.id
      AND other.username = LOWER(REGEXP_REPLACE(SPLIT_PART(u.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'))
  );

-- Back-fill step 2: for any remaining conflicts, append the row id
UPDATE abukonn.users
SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || id::text
WHERE username IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_username_unique' AND conrelid = 'abukonn.users'::regclass
  ) THEN
    ALTER TABLE abukonn.users ADD CONSTRAINT users_username_unique UNIQUE (username);
  END IF;
END $$;
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

async function findByUsername(username) {
  const result = await pool.query(
    'SELECT id FROM abukonn.users WHERE username = $1',
    [username]
  );
  return result.rows[0] || null;
}

const COLS = 'id, username, full_name, email, department, level, profile_photo_url, bio, is_admin, role, date_of_birth, created_at';

async function findById(id) {
  const result = await pool.query(
    `SELECT ${COLS} FROM abukonn.users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function findByIdWithPassword(id) {
  const result = await pool.query(
    `SELECT id, email, password_hash, full_name FROM abukonn.users WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateEmail(id, email) {
  const result = await pool.query(
    `UPDATE abukonn.users SET email = $2 WHERE id = $1 RETURNING ${COLS}`,
    [id, email]
  );
  return result.rows[0] || null;
}

async function updatePassword(id, passwordHash) {
  await pool.query(
    `UPDATE abukonn.users SET password_hash = $2 WHERE id = $1`,
    [id, passwordHash]
  );
}

async function deleteById(id) {
  await pool.query('DELETE FROM abukonn.users WHERE id = $1', [id]);
}

async function updateRole(id, role) {
  const result = await pool.query(
    `UPDATE abukonn.users SET role = $2 WHERE id = $1 RETURNING ${COLS}`,
    [id, role]
  );
  return result.rows[0] || null;
}

async function updateProfile(id, { bio, department, level, username, full_name, dateOfBirth }) {
  const result = await pool.query(
    `UPDATE abukonn.users
     SET bio           = COALESCE($2, bio),
         department    = COALESCE($3, department),
         level         = COALESCE($4, level),
         username      = COALESCE($5, username),
         full_name     = COALESCE($6, full_name),
         date_of_birth = COALESCE($7, date_of_birth)
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, bio ?? null, department ?? null, level ?? null, username ?? null, full_name ?? null, dateOfBirth ?? null]
  );
  return result.rows[0] || null;
}

async function getBirthdayUsers(excludeUserId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name, u.username, u.profile_photo_url, u.department
     FROM abukonn.users u
     LEFT JOIN abukonn.user_settings s ON s.user_id = u.id
     WHERE u.date_of_birth IS NOT NULL
       AND EXTRACT(MONTH FROM u.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE AT TIME ZONE 'Africa/Lagos')
       AND EXTRACT(DAY   FROM u.date_of_birth) = EXTRACT(DAY   FROM CURRENT_DATE AT TIME ZONE 'Africa/Lagos')
       AND (s.show_birthday IS NULL OR s.show_birthday = TRUE)
       AND u.id != $1
     LIMIT 20`,
    [excludeUserId]
  );
  return rows;
}

async function updateProfilePhoto(id, photoUrl) {
  const result = await pool.query(
    `UPDATE abukonn.users SET profile_photo_url = $2
     WHERE id = $1
     RETURNING ${COLS}`,
    [id, photoUrl]
  );
  return result.rows[0] || null;
}

async function createUser({ fullName, email, department, level, passwordHash, username }) {
  const result = await pool.query(
    `INSERT INTO abukonn.users (full_name, email, department, level, password_hash, username)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLS}`,
    [fullName, email, department, level, passwordHash, username ?? null]
  );
  return result.rows[0];
}

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    department: user.department,
    level: user.level,
    profile_photo_url: user.profile_photo_url,
    bio: user.bio,
    is_admin: user.is_admin || false,
    role: user.role || 'user',
    created_at: user.created_at,
  };
}

function toPrivateUser(user) {
  return {
    ...toPublicUser(user),
    email: user.email,
    date_of_birth: user.date_of_birth ?? null,
  };
}

module.exports = {
  CREATE_USERS_TABLE,
  createUsersTable,
  findByMatricNumber,
  findByEmail,
  findByUsername,
  findById,
  findByIdWithPassword,
  updateProfile,
  updateRole,
  updateProfilePhoto,
  updateEmail,
  updatePassword,
  deleteById,
  createUser,
  getBirthdayUsers,
  toPublicUser,
  toPrivateUser,
};
