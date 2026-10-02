const pool = require('../config/db');

// Capability roles that gate publishing features (News, Library uploads).
//
// Deliberately separate from users.role (the admin-panel role) and
// users.is_content_creator: those describe who a person IS in the admin
// hierarchy, whereas these are independent capabilities -- a user can hold
// media_team, library_contributor, both, or neither. Hence a join table with
// one row per (user, role) rather than another column on users.
const ROLE_TYPES = Object.freeze({
  MEDIA_TEAM: 'media_team',
  LIBRARY_CONTRIBUTOR: 'library_contributor',
});
const VALID_ROLE_TYPES = Object.values(ROLE_TYPES);

// Adding a role later means replacing user_roles_role_type_check in a new
// migration; that is the cost of a CHECK over an enum, whose values are
// harder to alter in place.
const CREATE_USER_ROLES_TABLE = `
  CREATE TABLE IF NOT EXISTS abukonn.user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
    CONSTRAINT user_roles_role_type_check CHECK (role_type IN ('media_team', 'library_contributor')),
    CONSTRAINT user_roles_user_role_unique UNIQUE (user_id, role_type)
  )
`;

async function createUserRolesTable() {
  await pool.query(CREATE_USER_ROLES_TABLE);
  // (user_id, role_type) is already indexed by the unique constraint; this
  // covers the reverse lookup "who holds role X" (admin dashboard listing).
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_roles_role_type ON abukonn.user_roles(role_type)`
  );
  console.log('User roles table ready');
}

// An unknown role is a programmer error, not "user lacks the role". Returning
// false from hasRole for a typo'd role would silently lock everyone out of
// whatever it gates, so fail loudly instead.
function assertValidRole(roleType) {
  if (!VALID_ROLE_TYPES.includes(roleType)) {
    throw new Error(`Unknown role type: ${roleType}`);
  }
}

// Reads fresh from the DB on every call -- no caching, nothing taken from the
// JWT -- so a grant or revoke takes effect on the very next request (same
// approach as isUserPro).
async function hasRole(userId, roleType) {
  assertValidRole(roleType);
  const { rows } = await pool.query(
    `SELECT 1 FROM abukonn.user_roles WHERE user_id = $1 AND role_type = $2`,
    [userId, roleType]
  );
  return rows.length > 0;
}

// All capability roles a user currently holds, as role_type strings.
async function getRolesForUser(userId) {
  const { rows } = await pool.query(
    `SELECT role_type FROM abukonn.user_roles WHERE user_id = $1 ORDER BY role_type`,
    [userId]
  );
  return rows.map(r => r.role_type);
}

// Returns the new row, or null if the user already held the role.
async function grantRole(userId, roleType, grantedBy = null) {
  assertValidRole(roleType);
  const { rows } = await pool.query(
    `INSERT INTO abukonn.user_roles (user_id, role_type, granted_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, role_type) DO NOTHING
     RETURNING *`,
    [userId, roleType, grantedBy]
  );
  return rows[0] || null;
}

// Returns the removed row, or null if the user didn't hold the role.
async function revokeRole(userId, roleType) {
  assertValidRole(roleType);
  const { rows } = await pool.query(
    `DELETE FROM abukonn.user_roles WHERE user_id = $1 AND role_type = $2 RETURNING *`,
    [userId, roleType]
  );
  return rows[0] || null;
}

module.exports = {
  ROLE_TYPES,
  VALID_ROLE_TYPES,
  CREATE_USER_ROLES_TABLE,
  createUserRolesTable,
  hasRole,
  getRolesForUser,
  grantRole,
  revokeRole,
};
