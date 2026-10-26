// The startup schema sequence (src/lib/initDatabase.js) on a real, EMPTY Postgres
// (PGlite). Production already has every table, so an ALTER that runs before its
// table is created only ever fails on a fresh database -- exactly how
// `ALTER TABLE abukonn.post_media` ran inside createPostsTable and stopped an
// empty dev database booting. This runs the same sequence index.js runs.

const test = require('node:test');
const assert = require('node:assert/strict');
const { installPgliteDb, schemaSnapshot } = require('../test-support/pglite-db');

const pool = installPgliteDb();
const { initDatabase } = require('../src/lib/initDatabase');

const tableExists = async name =>
  (await pool.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`abukonn.${name}`])).rows[0].ok;

test('an empty database boots: every startup step runs in dependency order', async () => {
  await initDatabase(); // would reject with 'relation "abukonn.post_media" does not exist'
  for (const t of ['users', 'posts', 'post_media', 'post_likes', 'comments', 'news', 'groups',
    'group_members', 'group_messages', 'follows', 'library_materials', 'user_roles', 'stories']) {
    assert.equal(await tableExists(t), true, `${t} should exist`);
  }
});

test('post_media gets its bytes column on a fresh database', async () => {
  const { rows } = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'abukonn' AND table_name = 'post_media' AND column_name = 'bytes'`
  );
  assert.deepEqual(rows, [{ data_type: 'integer' }]);
});

test('running the sequence again changes nothing (the no-op production gets on every deploy)', async () => {
  const before = await schemaSnapshot(pool);
  await initDatabase();
  assert.equal(await schemaSnapshot(pool), before);
});

test('a database that predates the bytes column is topped up, with its rows untouched', async () => {
  // How production looked before that column existed: drop it and add a row.
  await pool.query(`ALTER TABLE abukonn.post_media DROP COLUMN bytes`);
  await pool.query(`INSERT INTO abukonn.users (matric_number, full_name, email, department, level, password_hash)
                    VALUES ('M1', 'U', 'u@example.com', 'Law', '100 Level', 'x')`);
  await pool.query(`INSERT INTO abukonn.posts (user_id, content) SELECT id, 'hello' FROM abukonn.users LIMIT 1`);
  await pool.query(`INSERT INTO abukonn.post_media (post_id, media_url, media_type) SELECT id, 'u', 'image' FROM abukonn.posts LIMIT 1`);

  await initDatabase();

  const { rows } = await pool.query(`SELECT media_url, bytes FROM abukonn.post_media`);
  assert.deepEqual(rows, [{ media_url: 'u', bytes: null }]);
});
