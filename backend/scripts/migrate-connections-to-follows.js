'use strict';

/**
 * One-time migration for the switch from mutual "connect" to one-way "follow".
 *
 * - Every existing mutual connection (connections.user1_id <-> user2_id) becomes
 *   TWO follows, one each way, so nobody loses their network.
 * - Every still-pending connect request (sender -> receiver) becomes a single
 *   follow sender -> receiver: in a follow world, "I asked to connect" is just
 *   "I follow you". Declined/accepted requests are left alone (accepted ones are
 *   already represented in connections and handled above).
 *
 * Safe to run repeatedly — ON CONFLICT DO NOTHING skips follows that already
 * exist (e.g. a follow that was already created for a verified account).
 *
 *   node scripts/migrate-connections-to-follows.js          # dry run, counts only
 *   node scripts/migrate-connections-to-follows.js --apply  # write follows
 *
 * NON-DESTRUCTIVE: does not delete connections or connect_requests. The old
 * tables stay intact so the change is reversible; retiring them is a later step.
 */

require('dotenv').config();
const pool = require('../src/config/db');

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(APPLY ? 'APPLYING — writing follows\n' : 'DRY RUN — no writes (pass --apply to write)\n');

  const conns = await pool.query('SELECT user1_id, user2_id FROM abukonn.connections');
  const pendings = await pool.query(
    "SELECT sender_id, receiver_id FROM abukonn.connect_requests WHERE status = 'pending'"
  );

  // Build the set of follow rows we intend to have, deduped in JS so the report
  // is accurate before we touch the DB.
  const wanted = new Set();
  for (const { user1_id, user2_id } of conns.rows) {
    wanted.add(`${user1_id}:${user2_id}`);
    wanted.add(`${user2_id}:${user1_id}`);
  }
  for (const { sender_id, receiver_id } of pendings.rows) {
    wanted.add(`${sender_id}:${receiver_id}`);
  }

  console.log(`connections:        ${conns.rows.length} rows -> ${conns.rows.length * 2} directional follows`);
  console.log(`pending requests:   ${pendings.rows.length} rows -> ${pendings.rows.length} follows`);
  console.log(`total intended follow rows (deduped): ${wanted.size}\n`);

  // How many already exist, so the report shows the true number of NEW rows.
  const existing = await pool.query('SELECT follower_id, following_id FROM abukonn.follows');
  const have = new Set(existing.rows.map((r) => `${r.follower_id}:${r.following_id}`));
  let newRows = 0;
  for (const key of wanted) if (!have.has(key)) newRows++;
  console.log(`already present:    ${wanted.size - newRows}`);
  console.log(`would be inserted:  ${newRows}\n`);

  if (!APPLY) {
    console.log('Dry run complete. Re-run with --apply to write.');
    await pool.end();
    return;
  }

  let inserted = 0;
  for (const key of wanted) {
    const [follower, following] = key.split(':');
    const res = await pool.query(
      `INSERT INTO abukonn.follows (follower_id, following_id)
       VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [parseInt(follower, 10), parseInt(following, 10)]
    );
    inserted += res.rowCount;
  }
  console.log(`Done. Inserted ${inserted} new follow rows.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('Migration failed:', err.message);
  try { await pool.end(); } catch { /* ignore */ }
  process.exitCode = 1;
});
