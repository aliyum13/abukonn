// A real Postgres (PGlite, in-process WebAssembly) standing in for config/db, so
// tests can run the backend's actual DDL and SQL instead of a hand-written fake.
// Install it BEFORE requiring any model: config/db opens a real connection the
// moment it is required.
//
// pg's pool.query() takes a multi-statement string when there are no parameters
// (several models do that: CREATE TABLE + CREATE INDEX in one call), PGlite's
// query() does not, so parameterless calls go through exec().
const path = require('node:path');

function installPgliteDb() {
  const { PGlite } = require('@electric-sql/pglite');
  const db = new PGlite();
  const pool = {
    async query(sql, params) {
      if (params === undefined || params.length === 0) {
        const results = await db.exec(sql);
        return results[results.length - 1] || { rows: [] };
      }
      return db.query(sql, params);
    },
    async end() {},
    raw: db,
  };
  const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'config', 'db'));
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
  return pool;
}

// Every column of every abukonn table plus index names: what "the schema" is,
// for comparing before and after a boot.
async function schemaSnapshot(pool) {
  const cols = await pool.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default
     FROM information_schema.columns WHERE table_schema = 'abukonn' ORDER BY 1, 2`
  );
  const idx = await pool.query(
    `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'abukonn' ORDER BY 1, 2`
  );
  return JSON.stringify({ cols: cols.rows, idx: idx.rows });
}

module.exports = { installPgliteDb, schemaSnapshot };
