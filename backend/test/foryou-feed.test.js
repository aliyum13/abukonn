// The For You feed has no age window: it ranks the newest FORYOU.CANDIDATE_POOL_SIZE
// visible posts of ANY age, so it is never empty while a visible post exists.
//
// Runs the real getForYouFeed SQL on a real Postgres (PGlite) with a hand-written
// copy of the tables the query touches. The scenario that motivated this: the
// newest post before today is 30+ days old. Under the old 14-day window the
// candidate pool was EMPTY there, so the feed was blank for everyone.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const db = new PGlite();
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: {
    async query(sql, params) {
      if (!params || params.length === 0) {
        const r = await db.exec(sql);
        return r[r.length - 1] || { rows: [] };
      }
      return db.query(sql, params);
    },
    async end() {},
  },
};
const Post = require(path.join('..', 'src', 'models', 'Post'));
const { FORYOU } = Post;

// Only what getForYouFeed / getFollowingPosts / attachMedia read. Column lists
// mirror the models; the real DDL lives in src/models/*.js.
const DDL = `
CREATE SCHEMA abukonn;
CREATE TABLE abukonn.users (id SERIAL PRIMARY KEY, full_name TEXT, department TEXT, profile_photo_url TEXT, role TEXT, is_verified BOOLEAN, is_content_creator BOOLEAN);
CREATE TABLE abukonn.posts (
  id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES abukonn.users(id), content TEXT NOT NULL, image_url TEXT,
  likes_count INTEGER DEFAULT 0, comments_count INTEGER DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now(),
  category VARCHAR(50) DEFAULT 'GENERAL', repost_count INTEGER DEFAULT 0, view_count INTEGER DEFAULT 0,
  is_repost BOOLEAN DEFAULT FALSE, original_post_id INTEGER, original_author_name TEXT, post_subtype VARCHAR(20) DEFAULT 'post',
  discussion_title TEXT, poll_duration_hours INTEGER, poll_ends_at TIMESTAMPTZ, event_title TEXT, event_date TIMESTAMPTZ,
  event_location TEXT, event_rsvp_count INTEGER DEFAULT 0, edited_at TIMESTAMPTZ);
CREATE INDEX idx_posts_created_at ON abukonn.posts(created_at);
CREATE TABLE abukonn.post_likes (user_id INTEGER NOT NULL, post_id INTEGER NOT NULL, PRIMARY KEY (user_id, post_id));
CREATE TABLE abukonn.follows (id SERIAL PRIMARY KEY, follower_id INTEGER NOT NULL, following_id INTEGER NOT NULL, UNIQUE (follower_id, following_id));
CREATE TABLE abukonn.blocks (blocker_id INTEGER NOT NULL, blocked_id INTEGER NOT NULL, PRIMARY KEY (blocker_id, blocked_id));
CREATE TABLE abukonn.comments (id SERIAL PRIMARY KEY, post_id INTEGER NOT NULL, user_id INTEGER, content TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE abukonn.post_views (viewer_id INTEGER NOT NULL, post_id INTEGER NOT NULL, viewed_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (viewer_id, post_id));
CREATE TABLE abukonn.poll_options (id SERIAL PRIMARY KEY, post_id INTEGER NOT NULL, option_text TEXT, vote_count INTEGER DEFAULT 0);
CREATE TABLE abukonn.poll_votes (id SERIAL PRIMARY KEY, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL, option_id INTEGER NOT NULL);
CREATE TABLE abukonn.event_rsvps (id SERIAL PRIMARY KEY, post_id INTEGER NOT NULL, user_id INTEGER NOT NULL);
`;

const run = (sql, params) => db.query(sql, params);
const ME = 1, AUTHOR = 2, OTHER = 3;

test.before(async () => {
  await db.exec(DDL);
  await db.exec(`INSERT INTO abukonn.users (full_name) VALUES ('Me'), ('Author'), ('Other')`);
});
test.beforeEach(async () => {
  await db.exec(`TRUNCATE abukonn.posts, abukonn.blocks, abukonn.post_views, abukonn.follows, abukonn.post_likes RESTART IDENTITY`);
});

const addPost = (userId, daysAgo, { likes = 0, content } = {}) =>
  run(`INSERT INTO abukonn.posts (user_id, content, likes_count, created_at)
       VALUES ($1, $2, $3, now() - ($4 || ' days')::interval) RETURNING id`,
    [userId, content ?? `post ${daysAgo}d`, likes, String(daysAgo)]).then(r => r.rows[0].id);

// One scroll session uses ONE session_start across all its pages (the clients do), which also
// fixes the refresh jitter -- a fresh value per page would reshuffle between pages.
const SESSION = Date.now();
const feed = (userId = ME, limit = 50, offset = 0) => Post.getForYouFeed(userId, limit, offset, SESSION);

// ── the scenario that was broken ─────────────────────────────────────────

test('SCENARIO: the newest post is 30+ days old -- the feed still has posts', async () => {
  for (const d of [30, 31, 45, 60, 120, 400]) await addPost(AUTHOR, d);
  const { posts, exhausted } = await feed();
  assert.equal(posts.length, 6, 'every visible post, whatever its age');
  assert.equal(exhausted, false, 'unseen posts exist, so it is not "caught up"');
});

test('SCENARIO: one recent post the viewer has already seen -- still a full feed, seen demoted not hidden', async () => {
  // Production's shape: a single post in the last 14 days, the rest much older.
  const recent = await addPost(AUTHOR, 2, { content: 'the only recent post', likes: 20 });
  const twin = await addPost(OTHER, 2, { content: 'same age and engagement, unseen', likes: 20 });
  for (const d of [20, 33, 47, 90]) await addPost(AUTHOR, d, { likes: 1 });
  await run(`INSERT INTO abukonn.post_views (viewer_id, post_id, viewed_at) VALUES ($1, $2, now() - interval '1 hour')`, [ME, recent]);
  const { posts } = await Post.getForYouFeed(ME, 50, 0, Date.now());
  assert.equal(posts.length, 6);
  assert.equal(posts.find(p => p.id === recent).already_seen, true);
  assert.ok(posts.findIndex(p => p.id === twin) < posts.findIndex(p => p.id === recent), 'the seen post ranks below its unseen twin');
});

test('a database with no posts at all returns an empty page (and says caught up)', async () => {
  assert.deepEqual(await feed(), { posts: [], exhausted: true });
});

// ── nothing is hidden by age, and ranking is unchanged ───────────────────

test('there is no age filter in the query', async () => {
  const seen = [];
  const original = require.cache[dbPath].exports.query;
  require.cache[dbPath].exports.query = async (sql, params) => { seen.push({ sql, params }); return original(sql, params); };
  try { await feed(); } finally { require.cache[dbPath].exports.query = original; }
  const sql = seen[0].sql.replace(/\s+/g, ' ');
  // The candidate CTE (base) filters on blocks only: no created_at comparison, no interval.
  const base = sql.slice(sql.indexOf('FROM abukonn.posts p JOIN'), sql.indexOf('), scored AS'));
  assert.doesNotMatch(base, /created_at\s*>|interval/i);
  assert.match(base, /ORDER BY p\.created_at DESC, p\.id DESC LIMIT \$13::int/);
  assert.equal(seen[0].params[12], FORYOU.CANDIDATE_POOL_SIZE); // $13 is a count now
  assert.equal(FORYOU.CANDIDATE_MAX_AGE_HOURS, undefined);
});

test('every ranking knob still arrives in the slot the SQL reads, with the pool size in $13', async () => {
  const seen = [];
  const original = require.cache[dbPath].exports.query;
  require.cache[dbPath].exports.query = async (sql, params) => { seen.push(params); return original(sql, params); };
  try { await Post.getForYouFeed(7, 20, 40, 1700000000000); } finally { require.cache[dbPath].exports.query = original; }
  assert.deepEqual(seen[0], [
    7, 20, 40,
    FORYOU.FRESH_BOOST, FORYOU.FRESH_WINDOW_HOURS,
    FORYOU.FOLLOW_BOOST, FORYOU.FOLLOW_FRESH_BONUS,
    FORYOU.ENGAGEMENT_WEIGHT, FORYOU.ENGAGEMENT_CAP,
    String(FORYOU.OWN_POST_WINDOW_HOURS), FORYOU.OWN_POST_BOOST,
    FORYOU.SEEN_DEMOTE, FORYOU.CANDIDATE_POOL_SIZE,
    FORYOU.REFRESH_JITTER_MAGNITUDE, FORYOU.REFRESH_JITTER_BUCKET_SECONDS,
    1700000000000,
    FORYOU.ENGAGEMENT_HALF_LIFE_HOURS, // $17
  ]);
});

// ── engagement fades with age (so "no window" does not mean "old posts win") ──

// 120 ordinary-but-popular posts, 15..59 days old, raw engagement 200 each (= the cap, undecayed).
const addPopularOldPosts = () => run(
  `INSERT INTO abukonn.posts (user_id, content, likes_count, created_at)
   SELECT $1, 'old popular ' || g, 100, now() - ((15 + g % 45) || ' days')::interval FROM generate_series(1, 120) g`, [OTHER]);
const rankOf = (posts, id) => posts.findIndex(p => p.id === id) + 1;
const withHalfLife = async (hours, fn) => {
  const original = FORYOU.ENGAGEMENT_HALF_LIFE_HOURS;
  FORYOU.ENGAGEMENT_HALF_LIFE_HOURS = hours;
  try { return await fn(); } finally { FORYOU.ENGAGEMENT_HALF_LIFE_HOURS = original; }
};
const hoursOld = async (hours, content) => (await run(
  `INSERT INTO abukonn.posts (user_id, content, created_at) VALUES ($1, $2, now() - ($3 || ' hours')::interval) RETURNING id`,
  [AUTHOR, content, String(hours)])).rows[0].id;

test('DECAY: a 4-hour-old zero-engagement post is not buried by 120 old popular ones (it was rank ~81 before the change)', async () => {
  await addPopularOldPosts();
  const fresh4h = await hoursOld(4, 'four hours old');
  const { posts } = await feed(ME, 200);
  assert.ok(rankOf(posts, fresh4h) <= 81, `rank ${rankOf(posts, fresh4h)}`);
  assert.equal(rankOf(posts, fresh4h), 1); // old engagement has faded below its freshness floor (40)
  // Control: decay off reproduces the problem this fixes.
  const off = await withHalfLife(0, () => feed(ME, 200));
  assert.ok(rankOf(off.posts, fresh4h) > 120, `without decay it sits behind all 120 (rank ${rankOf(off.posts, fresh4h)})`);
});

test('DECAY: a 30-minute-old zero-engagement post stays at the very top', async () => {
  await addPopularOldPosts();
  const fresh = await hoursOld(0.5, 'thirty minutes old');
  const { posts } = await feed(ME, 200);
  assert.equal(rankOf(posts, fresh), 1);
});

test('DECAY: a post older than 14 days still surfaces when its engagement is high, an ordinary one does not', async () => {
  await addPopularOldPosts();
  const fresh4h = await hoursOld(4, 'four hours old');
  const viral = (await run(`INSERT INTO abukonn.posts (user_id, content, likes_count, created_at)
    VALUES ($1, 'viral 20 days ago', 2000, now() - interval '20 days') RETURNING id`, [OTHER])).rows[0].id; // raw engagement 4000
  const { posts } = await feed(ME, 200);
  assert.equal(rankOf(posts, viral), 1, 'raw 4000 x 0.5^(480/120) = 250, capped at 200: above even the fresh post');
  assert.ok(rankOf(posts, viral) < rankOf(posts, fresh4h));
  const ordinary = posts.filter(p => p.content.startsWith('old popular'));
  assert.ok(ordinary.every(p => rankOf(posts, p.id) > rankOf(posts, fresh4h)), 'ordinary old posts fade below a 4h-old post');
});

test('DECAY: half-life 0 switches it off exactly (scores as before)', async () => {
  const old = await addPost(AUTHOR, 60, { likes: 100 });          // engagement 200
  const fresh = await hoursOld(4, 'four hours old');              // floor 40
  const off = await withHalfLife(0, () => feed(ME, 50));
  assert.deepEqual(off.posts.map(p => p.id), [old, fresh]);
  const on = await feed(ME, 50);
  assert.deepEqual(on.posts.map(p => p.id), [fresh, old]);
});

test('a brand-new zero-engagement post still outranks a 30-day-old moderately engaged one', async () => {
  const old = await addPost(AUTHOR, 30, { likes: 10 });      // engagement 20
  const fresh = await addPost(OTHER, 0, { content: 'just now' }); // freshness floor ~120
  const { posts } = await feed();
  assert.deepEqual(posts.map(p => p.id), [fresh, old]);
});

test('a followed author and own recent posts keep their boosts', async () => {
  await run(`INSERT INTO abukonn.follows (follower_id, following_id) VALUES ($1, $2)`, [ME, AUTHOR]);
  const other = await addPost(OTHER, 40, { likes: 5 });
  const followed = await addPost(AUTHOR, 40, { likes: 5 });
  const mine = await addPost(ME, 0, { content: 'mine' });
  const { posts } = await feed();
  assert.deepEqual(posts.map(p => p.id), [mine, followed, other]);
});

// ── the pool is bounded by count, not age ────────────────────────────────

test('only the newest CANDIDATE_POOL_SIZE posts are ranked, and pages walk them to a real end', async () => {
  const original = FORYOU.CANDIDATE_POOL_SIZE;
  FORYOU.CANDIDATE_POOL_SIZE = 5;
  try {
    for (let d = 1; d <= 12; d++) await addPost(AUTHOR, d * 10);
    const all = [];
    for (let off = 0; off < 20; off += 2) {
      const { posts } = await feed(ME, 2, off);
      if (posts.length === 0) break;
      all.push(...posts.map(p => p.content));
    }
    assert.deepEqual(all.sort(), ['post 10d', 'post 20d', 'post 30d', 'post 40d', 'post 50d']); // the 5 newest
    assert.equal(new Set(all).size, 5, 'no duplicates across pages');
  } finally {
    FORYOU.CANDIDATE_POOL_SIZE = original;
  }
});

test('blocked authors are excluded BEFORE the count, so they never use up pool slots', async () => {
  const original = FORYOU.CANDIDATE_POOL_SIZE;
  FORYOU.CANDIDATE_POOL_SIZE = 3;
  try {
    await run(`INSERT INTO abukonn.blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [ME, AUTHOR]);
    for (let d = 1; d <= 5; d++) await addPost(AUTHOR, d);          // newest five are all blocked
    for (let d = 40; d <= 44; d++) await addPost(OTHER, d);         // older, visible
    const { posts } = await feed();
    assert.equal(posts.length, 3, 'a full pool of visible posts despite five newer blocked ones');
    assert.ok(posts.every(p => p.user_id === OTHER));
  } finally {
    FORYOU.CANDIDATE_POOL_SIZE = original;
  }
});

// ── account-specific filters: what can legitimately empty one user's feed ──

test('blocking is the only server-side exclusion: a viewer who blocked every author sees nothing, others are unaffected', async () => {
  await addPost(AUTHOR, 40); await addPost(OTHER, 41);
  await run(`INSERT INTO abukonn.blocks (blocker_id, blocked_id) VALUES ($1, $2), ($1, $3)`, [ME, AUTHOR, OTHER]);
  assert.equal((await feed(ME)).posts.length, 0);
  assert.equal((await feed(AUTHOR)).posts.length, 2, 'a different viewer is unaffected');
});

test('the block is one-directional: being blocked BY an author does not hide that author from you', async () => {
  await addPost(AUTHOR, 40);
  await run(`INSERT INTO abukonn.blocks (blocker_id, blocked_id) VALUES ($1, $2)`, [AUTHOR, ME]);
  assert.equal((await feed(ME)).posts.length, 1);
});

test('having seen every post only demotes them: the feed is full and reports caught up', async () => {
  const ids = [await addPost(AUTHOR, 40), await addPost(AUTHOR, 41), await addPost(OTHER, 42)];
  for (const id of ids) await run(`INSERT INTO abukonn.post_views (viewer_id, post_id, viewed_at) VALUES ($1, $2, now() - interval '1 hour')`, [ME, id]);
  const { posts, exhausted } = await Post.getForYouFeed(ME, 50, 0, Date.now());
  assert.equal(posts.length, 3);
  assert.equal(exhausted, true);
});

test('a viewer with only their own old posts still sees them', async () => {
  await addPost(ME, 90);
  assert.equal((await feed(ME)).posts.length, 1);
});

// ── the Following tab is untouched ──────────────────────────────────────

test('Following stays pure reverse-chronological and ignores the pool entirely', async () => {
  await run(`INSERT INTO abukonn.follows (follower_id, following_id) VALUES ($1, $2)`, [ME, AUTHOR]);
  const a = await addPost(AUTHOR, 500), b = await addPost(AUTHOR, 1), c = await addPost(OTHER, 2);
  const rows = await Post.getFollowingPosts(ME, 50, 0);
  assert.deepEqual(rows.map(r => r.id), [b, a]);
  assert.ok(!rows.some(r => r.id === c), 'only followed authors');
});
