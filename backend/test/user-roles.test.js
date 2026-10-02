// Guards the roles foundation (models/UserRole.js).
//
// Runs with the Node built-in test runner and no database: `../src/config/db`
// is replaced in require.cache before the model loads, and the fake pool just
// records the SQL it was given. What's worth locking down is the shape of the
// statements, not Postgres itself:
//   - hasRole must hit the DB on EVERY call (no caching / JWT shortcut),
//   - an unknown role must throw rather than quietly read as "doesn't have it",
//   - grant must be idempotent (ON CONFLICT DO NOTHING) and revoke scoped to
//     exactly one (user, role) pair.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const calls = [];
let nextRows = [];
const fakePool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: nextRows }; } };

const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'config', 'db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };
const { hasRole, grantRole, revokeRole, createUserRolesTable, CREATE_USER_ROLES_TABLE } =
  require('../src/models/UserRole');

test.beforeEach(() => { calls.length = 0; nextRows = []; });

test('hasRole reads from the DB on every call', async () => {
  nextRows = [{ '?column?': 1 }];
  assert.equal(await hasRole(7, 'media_team'), true);
  nextRows = [];
  assert.equal(await hasRole(7, 'media_team'), false);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].params, [7, 'media_team']);
});

test('unknown role types throw instead of returning false', async () => {
  await assert.rejects(() => hasRole(7, 'admin'), /Unknown role type/);
  await assert.rejects(() => grantRole(7, 'nope', 1), /Unknown role type/);
  await assert.rejects(() => revokeRole(7, 'nope'), /Unknown role type/);
  assert.equal(calls.length, 0);
});

test('grantRole is idempotent and returns null when already held', async () => {
  nextRows = [];
  assert.equal(await grantRole(7, 'library_contributor', 1), null);
  assert.match(calls[0].sql, /ON CONFLICT \(user_id, role_type\) DO NOTHING/);
  assert.deepEqual(calls[0].params, [7, 'library_contributor', 1]);
  nextRows = [{ id: 1, user_id: 7, role_type: 'library_contributor' }];
  assert.equal((await grantRole(7, 'library_contributor')).id, 1);
  assert.equal(calls[1].params[2], null);
});

test('revokeRole is scoped to one (user, role) pair', async () => {
  await revokeRole(7, 'media_team');
  assert.match(calls[0].sql, /WHERE user_id = \$1 AND role_type = \$2/);
  assert.deepEqual(calls[0].params, [7, 'media_team']);
});

test('table definition is additive and allows both roles independently', async () => {
  assert.match(CREATE_USER_ROLES_TABLE, /CREATE TABLE IF NOT EXISTS abukonn\.user_roles/);
  assert.match(CREATE_USER_ROLES_TABLE, /UNIQUE \(user_id, role_type\)/);
  assert.match(CREATE_USER_ROLES_TABLE, /role_type IN \('media_team', 'library_contributor'\)/);
  await createUserRolesTable();
  for (const { sql } of calls) assert.doesNotMatch(sql, /^\s*(ALTER|DROP|DELETE|UPDATE|TRUNCATE)\b/i);
});
