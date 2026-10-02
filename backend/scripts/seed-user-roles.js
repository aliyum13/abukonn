'use strict';

/**
 * One-time seed: grant BOTH capability roles (media_team, library_contributor)
 * to the named accounts, so they are not locked out when News publishing and
 * Library uploads are gated behind these roles in later phases.
 *
 *   node scripts/seed-user-roles.js a@x.com b@y.com            # dry run
 *   node scripts/seed-user-roles.js a@x.com b@y.com --apply    # write
 *
 * Emails are passed on the command line rather than hardcoded or read at
 * server startup, on purpose:
 *   - the dry run resolves each email to a user id and prints it, so you can
 *     confirm the right accounts BEFORE anything is written to production;
 *   - a startup seed would re-grant on every deploy and silently undo a
 *     later revoke made from the admin dashboard.
 *
 * Aborts without writing if any email doesn't match exactly one account, or
 * if the user_roles table doesn't exist yet (deploy the backend first).
 * Idempotent: roles a user already holds are reported and left alone.
 */

const pool = require('../src/config/db');
const { VALID_ROLE_TYPES, grantRole } = require('../src/models/UserRole');

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const emails = args.filter(a => !a.startsWith('--')).map(e => e.trim().toLowerCase());

  if (emails.length === 0) {
    console.error('Usage: node scripts/seed-user-roles.js <email> [<email> ...] [--apply]');
    process.exit(1);
  }

  const { rows: [{ exists }] } = await pool.query(
    `SELECT to_regclass('abukonn.user_roles') IS NOT NULL AS exists`
  );
  if (!exists) {
    console.error('abukonn.user_roles does not exist yet -- deploy the backend first.');
    process.exit(1);
  }

  const users = [];
  for (const email of emails) {
    const { rows } = await pool.query(
      `SELECT id, email, full_name FROM abukonn.users WHERE LOWER(email) = $1`,
      [email]
    );
    if (rows.length !== 1) {
      console.error(`Expected exactly 1 account for ${email}, found ${rows.length}. Aborting, nothing written.`);
      process.exit(1);
    }
    users.push(rows[0]);
  }

  console.log(apply ? 'APPLYING:' : 'DRY RUN (pass --apply to write):');
  for (const u of users) {
    for (const role of VALID_ROLE_TYPES) {
      if (apply) {
        const row = await grantRole(u.id, role, null);
        console.log(`  #${u.id} ${u.email} (${u.full_name}) -> ${role}: ${row ? 'granted' : 'already held'}`);
      } else {
        const { rows } = await pool.query(
          `SELECT 1 FROM abukonn.user_roles WHERE user_id = $1 AND role_type = $2`,
          [u.id, role]
        );
        console.log(`  #${u.id} ${u.email} (${u.full_name}) -> ${role}: ${rows.length ? 'already held' : 'would grant'}`);
      }
    }
  }
}

main()
  .catch(err => {
    console.error('seed-user-roles failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
