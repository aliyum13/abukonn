// Exercises the capability-role admin endpoints through the REAL admin router
// and the REAL adminAuth middleware, over HTTP, so "non-admins can't reach
// these" is demonstrated rather than assumed from the router.use(adminAuth)
// line. Only the database is faked: config/db is replaced in require.cache
// with a small in-memory interpreter for the handful of statements involved.
//
// Users: 1 = admin, 2 = ordinary student, 5 = ordinary student (role target).
// Anything else does not exist.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_CLOUD_NAME ||= 'x';
process.env.CLOUDINARY_API_KEY ||= 'x';
process.env.CLOUDINARY_API_SECRET ||= 'x';

const ADMIN_ID = 1;
const KNOWN_USERS = new Set([1, 2, 5]);
const roleRows = []; // { user_id, role_type, granted_by }
const listQueries = []; // captured getUsers statements

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) {
      return { rows: KNOWN_USERS.has(params[0]) ? [{ is_admin: params[0] === ADMIN_ID }] : [] };
    }
    if (/^SELECT 1 FROM abukonn\.users WHERE id/.test(s)) {
      return { rows: KNOWN_USERS.has(params[0]) ? [{}] : [] };
    }
    if (/^INSERT INTO abukonn\.user_roles/.test(s)) {
      const [user_id, role_type, granted_by] = params;
      if (roleRows.some(r => r.user_id === user_id && r.role_type === role_type)) return { rows: [] };
      const row = { user_id, role_type, granted_by };
      roleRows.push(row);
      return { rows: [row] };
    }
    if (/^DELETE FROM abukonn\.user_roles/.test(s)) {
      const i = roleRows.findIndex(r => r.user_id === params[0] && r.role_type === params[1]);
      return { rows: i === -1 ? [] : roleRows.splice(i, 1) };
    }
    if (/^SELECT role_type FROM abukonn\.user_roles/.test(s)) {
      return {
        rows: roleRows.filter(r => r.user_id === params[0]).map(r => ({ role_type: r.role_type }))
          .sort((a, b) => a.role_type.localeCompare(b.role_type)),
      };
    }
    if (/FROM abukonn\.users u/.test(s)) {
      listQueries.push({ sql: s, params });
      return { rows: /COUNT\(\*\) FROM/.test(s) && !/GROUP BY/.test(s) ? [{ count: '0' }] : [] };
    }
    throw new Error(`Unexpected query in test: ${s}`);
  },
};

const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'config', 'db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePool };

const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
app.use('/api/admin', require('../src/routes/admin'));

let server;
let base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api/admin`;
});
test.after(() => server.close());
test.beforeEach(() => { roleRows.length = 0; listQueries.length = 0; });

const tokenFor = id => jwt.sign({ id }, process.env.JWT_SECRET);
async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

const ENDPOINTS = [
  ['GET', '/users/5/roles', undefined],
  ['POST', '/users/5/roles', { role_type: 'media_team' }],
  ['DELETE', '/users/5/roles/media_team', undefined],
];

test('no token -> 401 on all three endpoints', async () => {
  for (const [method, url, body] of ENDPOINTS) {
    assert.equal((await call(method, url, { body })).status, 401, `${method} ${url}`);
  }
});

test('invalid token -> 401', async () => {
  const bad = jwt.sign({ id: ADMIN_ID }, 'wrong-secret');
  assert.equal((await call('GET', '/users/5/roles', { token: bad })).status, 401);
});

test('non-admin -> 403 on all three endpoints, and nothing is written', async () => {
  const token = tokenFor(2);
  for (const [method, url, body] of ENDPOINTS) {
    assert.equal((await call(method, url, { token, body })).status, 403, `${method} ${url}`);
  }
  assert.equal(roleRows.length, 0);
});

test('admin can grant both roles independently; granted_by is the acting admin', async () => {
  const token = tokenFor(ADMIN_ID);
  let r = await call('POST', '/users/5/roles', { token, body: { role_type: 'media_team' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.roles, ['media_team']);
  r = await call('POST', '/users/5/roles', { token, body: { role_type: 'library_contributor' } });
  assert.deepEqual(r.json.roles, ['library_contributor', 'media_team']);
  assert.ok(roleRows.every(row => row.granted_by === ADMIN_ID));

  r = await call('GET', '/users/5/roles', { token });
  assert.deepEqual(r.json.roles, ['library_contributor', 'media_team']);
});

test('revoking one role leaves the other; grant and revoke are idempotent', async () => {
  const token = tokenFor(ADMIN_ID);
  await call('POST', '/users/5/roles', { token, body: { role_type: 'media_team' } });
  await call('POST', '/users/5/roles', { token, body: { role_type: 'media_team' } });
  await call('POST', '/users/5/roles', { token, body: { role_type: 'library_contributor' } });
  assert.equal(roleRows.length, 2);

  let r = await call('DELETE', '/users/5/roles/media_team', { token });
  assert.deepEqual(r.json.roles, ['library_contributor']);
  r = await call('DELETE', '/users/5/roles/media_team', { token });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.roles, ['library_contributor']);
});

test('bad input: unknown role_type 400, non-numeric id 400, unknown user 404', async () => {
  const token = tokenFor(ADMIN_ID);
  assert.equal((await call('POST', '/users/5/roles', { token, body: { role_type: 'admin' } })).status, 400);
  assert.equal((await call('POST', '/users/5/roles', { token, body: {} })).status, 400);
  assert.equal((await call('DELETE', '/users/5/roles/nope', { token })).status, 400);
  assert.equal((await call('GET', '/users/abc/roles', { token })).status, 400);
  assert.equal((await call('POST', '/users/999/roles', { token, body: { role_type: 'media_team' } })).status, 404);
  assert.equal((await call('GET', '/users/999/roles', { token })).status, 404);
  assert.equal(roleRows.length, 0);
});

test('user list: holds_role filter combines with search and numbers params correctly', async () => {
  const token = tokenFor(ADMIN_ID);
  assert.equal((await call('GET', '/users?holds_role=bogus', { token })).status, 400);

  await call('GET', '/users?holds_role=media_team&search=ali', { token });
  const list = listQueries.find(q => /GROUP BY/.test(q.sql));
  assert.match(list.sql, /\(u\.full_name ILIKE \$1 OR u\.email ILIKE \$1\) AND EXISTS/);
  assert.match(list.sql, /ur\.role_type = \$2/);
  assert.match(list.sql, /LIMIT \$3 OFFSET \$4/);
  assert.deepEqual(list.params, ['%ali%', 'media_team', 20, 0]);
  assert.match(list.sql, /AS roles/);

  listQueries.length = 0;
  await call('GET', '/users', { token });
  const plain = listQueries.find(q => /GROUP BY/.test(q.sql));
  assert.match(plain.sql, /LIMIT \$1 OFFSET \$2/);
  assert.deepEqual(plain.params, [20, 0]);
});
