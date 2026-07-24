'use strict';

/**
 * One-off: rewrite existing timetable + override times to 24-hour "HH:MM".
 *
 * Times were stored however they were typed ("2:00 PM", "10:00 AM"), which made
 * ordering wrong — "2:00 PM" sorted as 02:00, so afternoon classes appeared
 * before morning ones. New writes are normalised at the controller now; this
 * fixes what's already in the database.
 *
 * Safe to run more than once: already-normalised values parse to themselves.
 *
 *   node scripts/normalize-timetable-times.js          # report only
 *   node scripts/normalize-timetable-times.js --apply  # write changes
 */

require('dotenv').config();
const pool = require('../src/config/db');
const { normalizeTime } = require('../src/lib/time');

const APPLY = process.argv.includes('--apply');

async function normalizeTable(table, idCol = 'id') {
  const { rows } = await pool.query(
    `SELECT ${idCol} AS id, start_time, end_time FROM ${table}`
  );

  let changed = 0;
  let unparseable = 0;

  for (const row of rows) {
    const start = normalizeTime(row.start_time);
    const end = normalizeTime(row.end_time);

    // normalizeTime returns the original string when it can't parse it.
    const startBad = row.start_time && start === String(row.start_time).trim() && !/^\d{2}:\d{2}$/.test(start);
    const endBad = row.end_time && end === String(row.end_time).trim() && !/^\d{2}:\d{2}$/.test(end);
    if (startBad || endBad) {
      unparseable++;
      console.warn(`  ! ${table} id=${row.id}: could not parse ("${row.start_time}" / "${row.end_time}") — left as-is`);
      continue;
    }

    if (start === row.start_time && end === row.end_time) continue;

    changed++;
    console.log(`  ${table} id=${row.id}: "${row.start_time}"->"${start}"  "${row.end_time}"->"${end}"`);
    if (APPLY) {
      await pool.query(
        `UPDATE ${table} SET start_time=$1, end_time=$2 WHERE ${idCol}=$3`,
        [start, end, row.id]
      );
    }
  }

  console.log(`${table}: ${rows.length} rows, ${changed} ${APPLY ? 'updated' : 'would change'}, ${unparseable} unparseable\n`);
}

(async () => {
  try {
    console.log(APPLY ? 'APPLYING changes\n' : 'DRY RUN — no changes written (pass --apply to write)\n');
    await normalizeTable('abukonn.timetables');
    await normalizeTable('abukonn.timetable_overrides');
    console.log(APPLY ? 'Done.' : 'Dry run complete. Re-run with --apply to write.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
