'use strict';

/**
 * Fake data for a DEVELOPMENT database: an admin, an editor, a Library
 * Contributor, a few students, posts, news, groups and library materials.
 *
 *   node scripts/seed-dev.js            # dry run: reports what it would create
 *   node scripts/seed-dev.js --apply    # write
 *
 * It can never run against production:
 *   1. The database host must be local (localhost / 127.0.0.1 / ::1 / a unix
 *      socket). Anything else is refused unless BOTH --allow-remote is passed AND
 *      SEED_DEV_CONFIRM_HOST is set to that exact host name (a dev database on
 *      Railway, say). Neither can be satisfied by accident.
 *   2. NODE_ENV=production is refused outright.
 *   3. A database that already holds more than MAX_REAL_USERS non-seed accounts
 *      is refused whatever the host says -- it looks like a real one.
 * The check runs BEFORE the database module is loaded (which connects on
 * require), so a refused run never opens a connection.
 *
 * Same pattern as seed-user-roles.js: dry run by default, --apply to write.
 * Idempotent: every row is looked up by a natural key (email, title, name,
 * file_url) and left alone if it exists, so re-running adds nothing.
 *
 * Every account uses the password in DEV_PASSWORD below (override with
 * SEED_DEV_PASSWORD). All seed emails end in @dev.abukonn.local, which is also
 * how the script recognises its own users.
 *
 * Boot the backend once first (npm run dev) so it creates the tables.
 */

const SEED_EMAIL_DOMAIN = '@dev.abukonn.local';
const DEV_PASSWORD = 'DevPass123!';
const MAX_REAL_USERS = 25;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

// ── Safety ────────────────────────────────────────────────────────────────

// Host of a postgres connection string; '' for a unix socket / no host.
function hostOf(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null; // unparseable: treat as unsafe
  }
}

// Returns { ok: true, host } or { ok: false, reason }. Pure, so it is testable.
function checkTarget({ databaseUrl, nodeEnv, args = [], env = {} }) {
  if (nodeEnv === 'production') {
    return { ok: false, reason: 'NODE_ENV is production.' };
  }
  if (!databaseUrl) {
    return { ok: false, reason: 'DATABASE_URL is not set (put it in backend/.env -- see .env.example).' };
  }
  const host = hostOf(databaseUrl);
  if (host === null) {
    return { ok: false, reason: 'DATABASE_URL could not be parsed.' };
  }
  if (host === '' || LOCAL_HOSTS.has(host)) {
    return { ok: true, host: host || '(unix socket)' };
  }
  if (!args.includes('--allow-remote')) {
    return { ok: false, reason: `database host "${host}" is not local. Seeding a non-local database needs --allow-remote and SEED_DEV_CONFIRM_HOST=${host}.` };
  }
  if (env.SEED_DEV_CONFIRM_HOST !== host) {
    return { ok: false, reason: `--allow-remote also needs SEED_DEV_CONFIRM_HOST set to exactly "${host}".` };
  }
  return { ok: true, host };
}

// ── The data ──────────────────────────────────────────────────────────────

const now = Date.now();
const ago = ms => new Date(now - ms).toISOString();
const H = 3600 * 1000;
const D = 24 * H;

const USERS = [
  { key: 'admin', name: 'Dev Admin', email: `dev.admin${SEED_EMAIL_DOMAIN}`, username: 'dev_admin', matric: 'DEV/0001', dept: 'Computer Science', level: '500 Level', role: 'admin', isAdmin: true, roles: ['media_team', 'library_contributor'] },
  { key: 'editor', name: 'Dev Editor', email: `dev.editor${SEED_EMAIL_DOMAIN}`, username: 'dev_editor', matric: 'DEV/0002', dept: 'Mass Communication', level: '400 Level', role: 'editor', isAdmin: true, roles: ['media_team'] },
  { key: 'librarian', name: 'Dev Librarian', email: `dev.librarian${SEED_EMAIL_DOMAIN}`, username: 'dev_librarian', matric: 'DEV/0003', dept: 'Library and Information Science Education', level: '300 Level', role: 'user', isAdmin: false, roles: ['library_contributor'] },
  { key: 'ada', name: 'Ada Okafor', email: `ada${SEED_EMAIL_DOMAIN}`, username: 'ada_dev', matric: 'DEV/1001', dept: 'Computer Science', level: '300 Level', role: 'user', isAdmin: false, roles: [] },
  { key: 'bala', name: 'Bala Musa', email: `bala${SEED_EMAIL_DOMAIN}`, username: 'bala_dev', matric: 'DEV/1002', dept: 'Mechanical Engineering', level: '200 Level', role: 'user', isAdmin: false, roles: [] },
  { key: 'chidi', name: 'Chidi Eze', email: `chidi${SEED_EMAIL_DOMAIN}`, username: 'chidi_dev', matric: 'DEV/1003', dept: 'Law', level: '400 Level', role: 'user', isAdmin: false, roles: [] },
  { key: 'dayo', name: 'Dayo Bello', email: `dayo${SEED_EMAIL_DOMAIN}`, username: 'dayo_dev', matric: 'DEV/1004', dept: 'Pharmacy', level: '100 Level', role: 'user', isAdmin: false, roles: [], pro: true },
];

const FOLLOWS = [
  ['ada', 'bala'], ['ada', 'chidi'], ['ada', 'admin'], ['bala', 'ada'],
  ['chidi', 'ada'], ['dayo', 'ada'], ['dayo', 'bala'], ['dayo', 'admin'],
];

const POSTS = [
  { by: 'ada', at: 20 * 60 * 1000, content: 'Anyone have the CSC 301 past questions? Exam is in two weeks.', likes: 4, comments: 2 },
  { by: 'bala', at: 2 * H, content: 'Workshop open till 6pm today if anyone needs the lathe.', likes: 1, comments: 0 },
  { by: 'chidi', at: 5 * H, content: 'Moot court tomorrow at 10am, come and support the 400L team.', likes: 9, comments: 3 },
  { by: 'dayo', at: 9 * H, content: 'First week at ABU done. The Samaru weather is something else.', likes: 2, comments: 1 },
  { by: 'ada', at: 1.5 * D, content: 'Study group for Data Structures: library, 4pm, bring your laptops.', likes: 7, comments: 4 },
  { by: 'admin', at: 2 * D, content: 'Welcome to the ABUkonn dev database. Everything in here is fake.', likes: 3, comments: 0 },
  { by: 'bala', at: 4 * D, content: 'Selling a barely used scientific calculator. DM me.', likes: 0, comments: 1 },
  { by: 'chidi', at: 6 * D, subtype: 'discussion', title: 'Is open-book exam fairer?', content: 'Thoughts? I think it tests understanding better than recall.', likes: 12, comments: 6 },
  { by: 'ada', at: 9 * D, content: 'Reminder: registration closes Friday.', likes: 5, comments: 0 },
];

const NEWS = [
  { title: 'Second semester timetable released', category: 'academic', content: 'The second semester timetable is now available on the portal. Check your department notice board.', at: 1 * D },
  { title: 'Inter-faculty football finals this Saturday', category: 'sports', content: 'Engineering meets Physical Sciences at the main pitch, kickoff 4pm.', at: 2 * D },
  { title: 'Career fair comes to campus', category: 'events', content: 'Over thirty employers will be at the Multipurpose Hall next week.', at: 3 * D },
  { title: 'Library opening hours extended for exams', category: 'general', content: 'The main library will stay open until 10pm during the exam period.', at: 5 * D },
];

const GROUPS = [
  { name: '[dev] CSC 300L Class', description: 'Course updates for 300 Level Computer Science.', isPublic: true, owner: 'ada', members: ['bala', 'chidi', 'dayo'], messages: [['ada', 'Lecture moved to 2pm tomorrow.'], ['bala', 'Thanks for the heads up.'], ['dayo', 'Which hall?']] },
  { name: '[dev] Chess Club', description: 'Weekly tournaments, all levels.', isPublic: false, owner: 'chidi', members: ['ada', 'dayo'], messages: [['chidi', 'Tournament starts Friday, 5pm.']] },
];

const MATERIALS = [
  { title: 'CSC 301 Past Questions 2023', type: 'past_question', dept: 'Computer Science', level: '300 Level', code: 'CSC 301', ctitle: 'Data Structures', file: 'csc301-past-questions-2023.pdf', size: 1843200 },
  { title: 'MTH 201 Lecture Notes', type: 'lecture_note', dept: 'Mathematics', level: '200 Level', code: 'MTH 201', ctitle: 'Linear Algebra', file: 'mth201-lecture-notes.pdf', size: 2621440 },
  { title: 'Engineering Mechanics Textbook', type: 'textbook', dept: 'Mechanical Engineering', level: '200 Level', code: 'MEE 201', ctitle: 'Engineering Mechanics', file: 'engineering-mechanics.pdf', size: 9437184 },
  { title: 'PHA 101 Course Outline', type: 'other', dept: 'Pharmacy', level: '100 Level', code: 'PHA 101', ctitle: 'Intro to Pharmacy', file: 'pha101-outline.docx', size: 204800 },
  { title: 'LAW 401 Case Digest', type: 'lecture_note', dept: 'Law', level: '400 Level', code: 'LAW 401', ctitle: 'Equity and Trusts', file: 'law401-digest.pptx', size: 5242880 },
];
// Placeholder URLs: they point at nothing, on purpose. Opening one in the app
// shows a broken-file state, which is fine for UI work.
const materialUrl = file => `https://example.com/dev-library/${file}`;

// ── Seeding ───────────────────────────────────────────────────────────────

// Runs the whole seed against `pool` (anything with .query). With apply=false it
// only SELECTs. Returns per-entity { created, existing } counts.
async function seed(pool, { apply = false, log = () => {}, password = DEV_PASSWORD, bcryptRounds = 10 } = {}) {
  const bcrypt = require('bcryptjs');
  const counts = {};
  const bump = (entity, created) => {
    counts[entity] = counts[entity] || { created: 0, existing: 0 };
    counts[entity][created ? 'created' : 'existing']++;
  };
  const q = async (sql, params) => (await pool.query(sql, params)).rows;
  const one = async (sql, params) => (await q(sql, params))[0];

  const { exists } = await one(`SELECT to_regclass('abukonn.users') IS NOT NULL AND to_regclass('abukonn.user_roles') IS NOT NULL AND to_regclass('abukonn.library_materials') IS NOT NULL AS exists`);
  if (!exists) {
    throw new Error('The tables do not exist yet. Start the backend once (npm run dev) so it creates them, then run this again.');
  }

  const { n: realUsers } = await one(`SELECT COUNT(*)::int AS n FROM abukonn.users WHERE email NOT LIKE $1`, [`%${SEED_EMAIL_DOMAIN}`]);
  if (realUsers > MAX_REAL_USERS) {
    throw new Error(`This database holds ${realUsers} non-seed accounts (limit ${MAX_REAL_USERS}). It looks like a real database; refusing.`);
  }

  const hash = apply ? await bcrypt.hash(password, bcryptRounds) : null;
  const ids = {};   // key -> user id (dry run: only for users that already exist)

  // users
  for (const u of USERS) {
    const found = await one(`SELECT id FROM abukonn.users WHERE LOWER(email) = $1`, [u.email]);
    if (found) { ids[u.key] = found.id; bump('users', false); continue; }
    bump('users', true);
    log(`  user  ${u.email} (${u.role}${u.roles.length ? ', ' + u.roles.join('+') : ''})`);
    if (!apply) continue;
    const row = await one(
      `INSERT INTO abukonn.users
         (matric_number, full_name, email, department, level, password_hash, username, role, is_admin, is_pro, pro_expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [u.matric, u.name, u.email, u.dept, u.level, hash, u.username, u.role, u.isAdmin, !!u.pro,
       u.pro ? new Date(now + 365 * D).toISOString() : null]
    );
    ids[u.key] = row.id;
  }

  // capability roles
  for (const u of USERS) {
    for (const role of u.roles) {
      const has = ids[u.key] && await one(`SELECT 1 AS x FROM abukonn.user_roles WHERE user_id = $1 AND role_type = $2`, [ids[u.key], role]);
      bump('roles', !has);
      if (!has && apply) {
        await q(`INSERT INTO abukonn.user_roles (user_id, role_type, granted_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [ids[u.key], role, ids.admin]);
      }
    }
  }

  // follows
  for (const [a, b] of FOLLOWS) {
    const has = ids[a] && ids[b] && await one(`SELECT 1 AS x FROM abukonn.follows WHERE follower_id = $1 AND following_id = $2`, [ids[a], ids[b]]);
    bump('follows', !has);
    if (!has && apply) await q(`INSERT INTO abukonn.follows (follower_id, following_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [ids[a], ids[b]]);
  }

  // posts
  for (const p of POSTS) {
    const has = ids[p.by] && await one(`SELECT 1 AS x FROM abukonn.posts WHERE user_id = $1 AND content = $2`, [ids[p.by], p.content]);
    bump('posts', !has);
    if (!has && apply) {
      await q(
        `INSERT INTO abukonn.posts (user_id, content, post_subtype, discussion_title, likes_count, comments_count, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ids[p.by], p.content, p.subtype || 'post', p.title || null, p.likes, p.comments, ago(p.at)]
      );
    }
  }

  // news
  for (const n of NEWS) {
    const has = await one(`SELECT 1 AS x FROM abukonn.news WHERE title = $1`, [n.title]);
    bump('news', !has);
    if (!has && apply) {
      await q(`INSERT INTO abukonn.news (title, content, category, created_by, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [n.title, n.content, n.category, ids.editor, ago(n.at)]);
    }
  }

  // groups, members, messages
  for (const g of GROUPS) {
    const existing = await one(`SELECT id FROM abukonn.groups WHERE name = $1`, [g.name]);
    bump('groups', !existing);
    let groupId = existing && existing.id;
    if (!existing && apply) {
      const code = require('crypto').randomBytes(4).toString('hex').toUpperCase();
      groupId = (await one(
        `INSERT INTO abukonn.groups (name, description, created_by, invite_code, is_public) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [g.name, g.description, ids[g.owner], code, g.isPublic]
      )).id;
      await q(`INSERT INTO abukonn.group_members (group_id, user_id, role, status) VALUES ($1,$2,'admin','active') ON CONFLICT DO NOTHING`, [groupId, ids[g.owner]]);
      for (const m of g.members) {
        await q(`INSERT INTO abukonn.group_members (group_id, user_id, role, status) VALUES ($1,$2,'member','active') ON CONFLICT DO NOTHING`, [groupId, ids[m]]);
      }
      let i = g.messages.length;
      for (const [by, text] of g.messages) {
        await q(`INSERT INTO abukonn.group_messages (group_id, sender_id, content, created_at) VALUES ($1,$2,$3,$4)`, [groupId, ids[by], text, ago(i-- * 10 * 60 * 1000)]);
      }
    }
  }

  // library materials (placeholder URLs)
  for (const m of MATERIALS) {
    const url = materialUrl(m.file);
    const has = await one(`SELECT 1 AS x FROM abukonn.library_materials WHERE file_url = $1`, [url]);
    bump('library materials', !has);
    if (!has && apply) {
      const group = require('../src/lib/departments').DEPARTMENT_GROUPS.find(gr => gr.departments.includes(m.dept));
      await q(
        `INSERT INTO abukonn.library_materials
           (title, description, type, faculty, department, level, course_code, course_title, file_url, file_name, file_size, file_type, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [m.title, 'Dev placeholder; the file does not exist.', m.type, group ? group.faculty : null, m.dept, m.level, m.code, m.ctitle,
         url, m.file, m.size, m.file.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream', ids.librarian]
      );
    }
  }

  return counts;
}

async function main() {
  require('dotenv').config();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  const verdict = checkTarget({ databaseUrl: process.env.DATABASE_URL, nodeEnv: process.env.NODE_ENV, args, env: process.env });
  if (!verdict.ok) {
    console.error(`REFUSING to seed: ${verdict.reason}`);
    process.exit(1);
  }

  // Loaded only now: config/db connects as soon as it is required.
  const pool = require('../src/config/db');
  try {
    console.log(`Database host: ${verdict.host}`);
    console.log(apply ? 'APPLYING:' : 'DRY RUN (pass --apply to write):');
    const counts = await seed(pool, {
      apply,
      log: console.log,
      password: process.env.SEED_DEV_PASSWORD || DEV_PASSWORD,
      bcryptRounds: require('../src/config/security').BCRYPT_ROUNDS,
    });
    console.log(apply ? '\nDone.' : '\nWould create:');
    for (const [entity, c] of Object.entries(counts)) {
      console.log(`  ${entity.padEnd(18)} ${apply ? 'created' : 'to create'} ${c.created}, already there ${c.existing}`);
    }
    if (apply) console.log(`\nLog in as any seed account (e.g. dev.admin${SEED_EMAIL_DOMAIN}) with password ${process.env.SEED_DEV_PASSWORD || DEV_PASSWORD}`);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('seed-dev failed:', err.message);
    process.exit(1);
  });
}

module.exports = { checkTarget, hostOf, seed, SEED_EMAIL_DOMAIN, DEV_PASSWORD, MAX_REAL_USERS, USERS, POSTS, NEWS, GROUPS, MATERIALS };
