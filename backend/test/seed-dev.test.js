// scripts/seed-dev.js: the guard that keeps it away from production, and the
// seed itself (dry run by default, idempotent) on a real Postgres (PGlite).

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { installPgliteDb } = require('../test-support/pglite-db');

const pool = installPgliteDb();
const { initDatabase } = require('../src/lib/initDatabase');
const {
  checkTarget, hostOf, seed, SEED_EMAIL_DOMAIN, DEV_PASSWORD, MAX_REAL_USERS, USERS, POSTS, NEWS, GROUPS, MATERIALS,
} = require('../scripts/seed-dev');

const local = 'postgres://postgres:pw@localhost:5432/abukonn_dev';
const remote = 'postgres://u:p@viaduct.proxy.rlwy.net:5432/railway';

// ── the guard ─────────────────────────────────────────────────────────────

test('local hosts are accepted', () => {
  for (const url of [local, 'postgres://u@127.0.0.1/db', 'postgres://u@[::1]:5432/db', 'postgres:///db?host=/var/run/postgresql']) {
    assert.equal(checkTarget({ databaseUrl: url }).ok, true, url);
  }
});

test('a remote host is refused by default, and names what it would take', () => {
  const r = checkTarget({ databaseUrl: remote });
  assert.equal(r.ok, false);
  assert.match(r.reason, /viaduct\.proxy\.rlwy\.net/);
  assert.match(r.reason, /--allow-remote/);
});

test('a remote host needs BOTH --allow-remote and the exact host in SEED_DEV_CONFIRM_HOST', () => {
  assert.equal(checkTarget({ databaseUrl: remote, args: ['--allow-remote'] }).ok, false);
  assert.equal(checkTarget({ databaseUrl: remote, env: { SEED_DEV_CONFIRM_HOST: 'viaduct.proxy.rlwy.net' } }).ok, false);
  assert.equal(checkTarget({ databaseUrl: remote, args: ['--allow-remote'], env: { SEED_DEV_CONFIRM_HOST: 'other.example.com' } }).ok, false);
  assert.deepEqual(
    checkTarget({ databaseUrl: remote, args: ['--allow-remote'], env: { SEED_DEV_CONFIRM_HOST: 'viaduct.proxy.rlwy.net' } }),
    { ok: true, host: 'viaduct.proxy.rlwy.net' }
  );
});

test('production, a missing URL and an unparseable URL are refused even for a local host', () => {
  assert.equal(checkTarget({ databaseUrl: local, nodeEnv: 'production' }).ok, false);
  assert.equal(checkTarget({ databaseUrl: undefined }).ok, false);
  assert.equal(checkTarget({ databaseUrl: 'not a url' }).ok, false);
  assert.equal(checkTarget({ databaseUrl: local, nodeEnv: 'production', args: ['--allow-remote'] }).ok, false);
});

test('look-alike hosts are not local', () => {
  assert.equal(hostOf('postgres://u@localhost.evil.com/db'), 'localhost.evil.com');
  assert.equal(checkTarget({ databaseUrl: 'postgres://u@localhost.evil.com/db' }).ok, false);
  assert.equal(checkTarget({ databaseUrl: 'postgres://u@127.0.0.1.nip.io/db' }).ok, false);
});

test('a refused run never loads the database module (which would connect)', () => {
  const { spawnSync } = require('node:child_process');
  const r = spawnSync(process.execPath, [require.resolve('../scripts/seed-dev')], {
    env: { ...process.env, DATABASE_URL: remote, NODE_ENV: '' }, encoding: 'utf8', timeout: 20000,
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /REFUSING to seed/);
  assert.doesNotMatch(r.stdout + r.stderr, /Successfully connected|Failed to connect/);
});

// ── the seed ──────────────────────────────────────────────────────────────

const count = async table => (await pool.query(`SELECT COUNT(*)::int AS n FROM abukonn.${table}`)).rows[0].n;
const opts = { bcryptRounds: 4 };

test('before the backend has created its tables, the seed says so', async () => {
  await assert.rejects(() => seed(pool, opts), /tables do not exist yet/);
});

test('dry run reports what it would create and writes nothing', async () => {
  await initDatabase();
  const counts = await seed(pool, { ...opts, apply: false });
  assert.equal(counts.users.created, USERS.length);
  assert.equal(counts.posts.created, POSTS.length);
  assert.equal(counts.news.created, NEWS.length);
  assert.equal(counts.groups.created, GROUPS.length);
  assert.equal(counts['library materials'].created, MATERIALS.length);
  for (const t of ['users', 'posts', 'news', 'groups', 'library_materials', 'user_roles', 'follows']) {
    assert.equal(await count(t), 0, `${t} must be untouched by a dry run`);
  }
});

test('apply creates the accounts, roles, content and placeholder library files', async () => {
  await seed(pool, { ...opts, apply: true });
  assert.equal(await count('users'), USERS.length);
  assert.equal(await count('posts'), POSTS.length);
  assert.equal(await count('news'), NEWS.length);
  assert.equal(await count('groups'), GROUPS.length);
  assert.equal(await count('library_materials'), MATERIALS.length);

  const role = async email => (await pool.query(`SELECT role, is_admin FROM abukonn.users WHERE email = $1`, [email])).rows[0];
  assert.deepEqual(await role(`dev.admin${SEED_EMAIL_DOMAIN}`), { role: 'admin', is_admin: true });
  assert.deepEqual(await role(`dev.editor${SEED_EMAIL_DOMAIN}`), { role: 'editor', is_admin: true });
  assert.deepEqual(await role(`ada${SEED_EMAIL_DOMAIN}`), { role: 'user', is_admin: false });

  const caps = (await pool.query(
    `SELECT u.email, r.role_type FROM abukonn.user_roles r JOIN abukonn.users u ON u.id = r.user_id ORDER BY 1, 2`
  )).rows.map(r => `${r.email.split('@')[0]}:${r.role_type}`);
  assert.deepEqual(caps, [
    'dev.admin:library_contributor', 'dev.admin:media_team',
    'dev.editor:media_team', 'dev.librarian:library_contributor',
  ]);

  const urls = (await pool.query(`SELECT file_url FROM abukonn.library_materials`)).rows.map(r => r.file_url);
  assert.ok(urls.every(u => u.startsWith('https://example.com/dev-library/')), 'placeholder URLs only');
  assert.ok((await pool.query(`SELECT 1 FROM abukonn.groups WHERE invite_code IS NOT NULL`)).rows.length === GROUPS.length);
});

test('seed accounts can log in with the documented dev password', async () => {
  const { rows } = await pool.query(`SELECT password_hash FROM abukonn.users WHERE email = $1`, [`ada${SEED_EMAIL_DOMAIN}`]);
  assert.equal(await bcrypt.compare(DEV_PASSWORD, rows[0].password_hash), true);
});

test('running it again adds nothing', async () => {
  const before = { users: await count('users'), posts: await count('posts'), roles: await count('user_roles'), mats: await count('library_materials') };
  const counts = await seed(pool, { ...opts, apply: true });
  assert.equal(await count('users'), before.users);
  assert.equal(await count('posts'), before.posts);
  assert.equal(await count('user_roles'), before.roles);
  assert.equal(await count('library_materials'), before.mats);
  assert.ok(Object.values(counts).every(c => c.created === 0), JSON.stringify(counts));
});

test('a database that already holds real-looking data is refused whatever the host', async () => {
  for (let i = 0; i < MAX_REAL_USERS + 1; i++) {
    await pool.query(
      `INSERT INTO abukonn.users (matric_number, full_name, email, department, level, password_hash)
       VALUES ($1, 'Real Student', $2, 'Law', '100 Level', 'x')`,
      [`R${i}`, `real${i}@example.com`]
    );
  }
  await assert.rejects(() => seed(pool, { ...opts, apply: true }), /looks like a real database/);
});
