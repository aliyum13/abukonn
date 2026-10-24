// The For You candidate window (FORYOU.CANDIDATE_MAX_AGE_HOURS) is a config
// knob, so what needs pinning is the plumbing: the number reaches the SQL as the
// hours bound on posts.created_at, the ranking arithmetic still reads its other
// knobs from FORYOU, and the Following tab -- the pure reverse-chronological
// escape hatch -- stays free of any candidate window. The database is stubbed, so
// these assert on the query text and parameters, not on the ranked output (the
// ranking itself is explored by scripts/simulate-foryou-window.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const calls = [];
const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = {
  id: dbPath, filename: dbPath, loaded: true,
  exports: { async query(sql, params) { calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), params }); return { rows: [] }; } },
};
const Post = require(path.join('..', 'src', 'models', 'Post'));
const { FORYOU } = Post;

test.beforeEach(() => { calls.length = 0; });

test('the candidate window is 14 days', () => {
  assert.equal(FORYOU.CANDIDATE_MAX_AGE_HOURS, 336);
});

test('getForYouFeed bounds posts.created_at by the window, passed as hours in $13', async () => {
  await Post.getForYouFeed(7, 50, 0, 1700000000000);
  const { sql, params } = calls[0];
  assert.match(sql, /p\.created_at > NOW\(\) - \(\$13 \|\| ' hours'\)::interval/);
  assert.equal(params[12], '336'); // $13, a string because it is concatenated into the interval
});

test('the window is read from FORYOU on every call, not captured at load', async () => {
  const original = FORYOU.CANDIDATE_MAX_AGE_HOURS;
  try {
    FORYOU.CANDIDATE_MAX_AGE_HOURS = 168;
    await Post.getForYouFeed(7);
    assert.equal(calls[0].params[12], '168');
  } finally {
    FORYOU.CANDIDATE_MAX_AGE_HOURS = original;
  }
});

test('every other ranking knob still arrives in the slot the SQL expects', async () => {
  await Post.getForYouFeed(7, 20, 40, 1700000000000);
  const { sql, params } = calls[0];
  assert.deepEqual(params, [
    7, 20, 40,
    FORYOU.FRESH_BOOST, FORYOU.FRESH_WINDOW_HOURS,
    FORYOU.FOLLOW_BOOST, FORYOU.FOLLOW_FRESH_BONUS,
    FORYOU.ENGAGEMENT_WEIGHT, FORYOU.ENGAGEMENT_CAP,
    String(FORYOU.OWN_POST_WINDOW_HOURS), FORYOU.OWN_POST_BOOST,
    FORYOU.SEEN_DEMOTE, '336',
    FORYOU.REFRESH_JITTER_MAGNITUDE, FORYOU.REFRESH_JITTER_BUCKET_SECONDS,
    1700000000000,
  ]);
  // The placeholders the simulation's port of ranking_score mirrors.
  assert.match(sql, /GREATEST\(0, \$4::float \* \(1 - \(EXTRACT\(EPOCH FROM \(NOW\(\) - created_at\)\) \/ 3600\.0\) \/ \$5::float\)\)/);
  assert.match(sql, /LEAST\(\$9::float, \$8::float \* engagement_score\)/);
  assert.match(sql, /CASE WHEN already_seen THEN \$12::float ELSE 1 END/);
  assert.match(sql, /ORDER BY ranking_score DESC, created_at DESC LIMIT \$2 OFFSET \$3/);
});

test('the window adds no age decay: the score never reads a post age beyond the freshness ramp', async () => {
  await Post.getForYouFeed(7);
  const { sql } = calls[0];
  // Age enters the score only through the freshness floor ($4/$5) and the
  // follow/own-post "is it fresh" checks -- there is no term that keeps
  // shrinking an old post's score, which is why widening the window admits
  // old popular posts at full strength. If a decay term is ever added, the
  // simulation and the 14-day rationale need revisiting.
  const scoreBlock = sql.slice(sql.indexOf('AS ranking_score') - 1400, sql.indexOf('AS ranking_score'));
  const ageReads = scoreBlock.match(/NOW\(\) - created_at|created_at > NOW\(\)/g) || [];
  assert.equal(ageReads.length, 3); // freshness ramp, follow-fresh bonus, own-post window
});

test('Following stays pure reverse-chronological with no candidate window', async () => {
  await Post.getFollowingPosts(7, 50, 0);
  const { sql, params } = calls[0];
  assert.match(sql, /ORDER BY p\.created_at DESC LIMIT \$2 OFFSET \$3/);
  assert.doesNotMatch(sql, /\|\| ' hours'\)::interval/);
  assert.doesNotMatch(sql, /p\.created_at > NOW\(\) - \(/);
  assert.deepEqual(params, [7, 50, 0]);
});
