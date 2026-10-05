// The remaining destructive / authority-granting admin endpoints must need
// role === 'admin' (requireFullAdmin), not just is_admin, which editors and
// class coordinators also carry. Driven over HTTP through the REAL admin router
// and the REAL adminAuth / requireFullAdmin; only the database is faked, so even
// the "wipe everything" endpoint can only ever hit a recording stub here.
//
// Users: 4 and 5 = full admins (Ali, Ahman), 10 = editor, 11 = class_coordinator,
// 12 = is_admin with role 'user', 13 = ordinary student.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_CLOUD_NAME ||= 'x';
process.env.CLOUDINARY_API_KEY ||= 'x';
process.env.CLOUDINARY_API_SECRET ||= 'x';

const ALI = 4;
const AHMAN = 5;
const EDITOR = 10;
const COORDINATOR = 11;
const LEGACY_ADMIN = 12;
const STUDENT = 13;
const USERS = {
  [ALI]: { is_admin: true, role: 'admin' },
  [AHMAN]: { is_admin: true, role: 'admin' },
  [EDITOR]: { is_admin: true, role: 'editor' },
  [COORDINATOR]: { is_admin: true, role: 'class_coordinator' },
  [LEGACY_ADMIN]: { is_admin: true, role: 'user' },
  [STUDENT]: { is_admin: false, role: 'user' },
};

// Every statement that is NOT one of the two auth lookups. For a request that
// is refused at the gate this must stay empty: nothing reached the database.
const executed = [];

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) {
      return { rows: USERS[params[0]] ? [{ is_admin: USERS[params[0]].is_admin }] : [] };
    }
    if (/^SELECT role FROM abukonn\.users/.test(s)) {
      return { rows: USERS[params[0]] ? [{ role: USERS[params[0]].role }] : [] };
    }
    executed.push(s);
    // Generic row so controllers that read a result don't throw.
    return { rows: [{ id: 1, full_name: 'Test', count: '0', n: 0 }], rowCount: 1 };
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
test.beforeEach(() => { executed.length = 0; });

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
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

// The confirmation phrase is included on purpose: a refusal must come from the
// role gate, not from the phrase check.
const WIPE = { confirm: 'WIPE ABUKONN TEST DATA' };
const GATED = [
  ['POST', '/reset-launch-data', WIPE],
  ['DELETE', '/users/99', undefined],
  ['GET', '/whitelist', undefined],
  ['POST', '/whitelist/upload', undefined],
  ['DELETE', '/whitelist', undefined],
  ['GET', '/class-reps', undefined],
  ['POST', '/class-reps', { user_id: 1, department: 'CS', level: '300 Level' }],
  ['DELETE', '/class-reps/1', undefined],
];

test('no token is 401 on every gated endpoint', async () => {
  for (const [method, url, body] of GATED) {
    assert.equal((await call(method, url, { body })).status, 401, `${method} ${url}`);
  }
});

for (const [label, id] of [
  ['editor', EDITOR],
  ['class_coordinator', COORDINATOR],
  ['is_admin account with role "user"', LEGACY_ADMIN],
  ['non-admin student', STUDENT],
]) {
  test(`${label} is refused 403 on every gated endpoint and nothing reaches the database`, async () => {
    for (const [method, url, body] of GATED) {
      const r = await call(method, url, { token: tokenFor(id), body });
      assert.equal(r.status, 403, `${method} ${url}`);
    }
    assert.deepEqual(executed, [], 'no statement should have run');
  });
}

for (const [label, id] of [['Ali (id 4)', ALI], ['Ahman (id 5)', AHMAN]]) {
  test(`${label} passes the gate on every gated endpoint`, async () => {
    const token = tokenFor(id);
    for (const [method, url, body] of GATED) {
      const r = await call(method, url, { token, body });
      assert.ok(![401, 403].includes(r.status), `${method} ${url} -> ${r.status}`);
    }
  });
}

test('full admin can still run the reset (it reaches the TRUNCATE) but only with the confirmation phrase', async () => {
  let r = await call('POST', '/reset-launch-data', { token: tokenFor(ALI), body: {} });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /Confirmation required/);
  assert.deepEqual(executed, []);

  r = await call('POST', '/reset-launch-data', { token: tokenFor(ALI), body: WIPE });
  assert.equal(r.status, 200);
  assert.ok(executed.some(s => /^TRUNCATE .*RESTART IDENTITY CASCADE/.test(s)));
});

test('endpoints the scoped roles legitimately use are unchanged (still pass adminAuth alone)', async () => {
  for (const id of [EDITOR, COORDINATOR]) {
    for (const url of ['/users/recent', '/stats']) {
      const r = await call('GET', url, { token: tokenFor(id) });
      assert.notEqual(r.status, 403, `user ${id} GET ${url}`);
      assert.notEqual(r.status, 401, `user ${id} GET ${url}`);
    }
  }
});
