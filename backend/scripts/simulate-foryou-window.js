#!/usr/bin/env node
// Simulates how the For You candidate window (FORYOU.CANDIDATE_MAX_AGE_HOURS)
// changes the feed, WITHOUT a database: it ports ranking_score from
// Post.getForYouFeed into plain JS and ranks a synthetic campus under two windows.
//
//   node scripts/simulate-foryou-window.js [--windows=168,336] [--posts-per-day=60] [--trials=300]
//
// Read this first -- what this is and is not:
//  * The FORMULA is real: constants come from the live FORYOU object, and the
//    arithmetic mirrors the SQL in getForYouFeed (kept honest by
//    test/foryou-window.test.js, which pins the SQL's shape).
//  * The POPULATION is invented. We have no production data here, so post rate,
//    engagement and what a viewer has already seen are ASSUMPTIONS, set below and
//    swept across "quiet / typical / busy" levels so you can see how much the
//    conclusion depends on them. Treat the output as a sensitivity analysis, not
//    a forecast. Get the real engagement distribution from prod with the SQL in
//    the PR description and compare.
//  * The window changes WHICH posts are candidates, never how a given post scores.

const path = require('node:path');

// Post.js requires config/db, which opens a real connection on require. Stub it.
const dbPath = require.resolve(path.join(__dirname, '..', 'src', 'config', 'db'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async () => ({ rows: [] }) } };
const { FORYOU: F } = require('../src/models/Post');

// ---- args ---------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map(a => a.replace(/^--/, '').split('=')));
const WINDOWS = (args.windows || `168,${F.CANDIDATE_MAX_AGE_HOURS}`).split(',').map(Number);
const POSTS_PER_DAY = Number(args['posts-per-day'] || 60);
const TRIALS = Number(args.trials || 300);
const MAX_WINDOW = Math.max(...WINDOWS);
const PAGE = 50; // the feed's page size (getFeed default limit)

// ---- seeded RNG so a run is reproducible --------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = rnd => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

// ---- the ranking formula, ported from getForYouFeed's `scored` CTE -------
function rankingScore(p, jitter) {
  const freshFloor = Math.max(0, F.FRESH_BOOST * (1 - p.ageH / F.FRESH_WINDOW_HOURS));
  const follow = p.following ? F.FOLLOW_BOOST + (p.ageH < F.FRESH_WINDOW_HOURS ? F.FOLLOW_FRESH_BONUS : 0) : 0;
  const engagement = Math.min(F.ENGAGEMENT_CAP, F.ENGAGEMENT_WEIGHT * p.engagement);
  const own = p.own && p.ageH < F.OWN_POST_WINDOW_HOURS ? F.OWN_POST_BOOST : 0;
  return (freshFloor + follow + engagement + own) * (p.seen ? F.SEEN_DEMOTE : 1) + jitter * F.REFRESH_JITTER_MAGNITUDE;
}

// ---- assumptions (sweep these) --------------------------------------------
// Final engagement score of a post (likes*2 + comments*3 + reposts*2 + views*0.1)
// is lognormal. `median` is the knob: how engaged is this campus?
const ENGAGEMENT_LEVELS = { quiet: 5, typical: 15, busy: 40 };
const SIGMA = 1.5;
const ACCRUAL_TAU_H = 24; // engagement accrues as 1 - exp(-age/24h): most of it in the first couple of days
// How much of the pool the viewer has already seen: P(seen | age) = 1 - exp(-age/tau).
const VIEWERS = { 'daily user': 36, 'occasional user': 120 };
const FOLLOW_SHARE = 0.15;

const BANDS = [['<6h', 0, 6], ['6-24h', 6, 24], ['1-3d', 24, 72], ['3-7d', 72, 168], ['7-14d', 168, Infinity]];
const bandOf = ageH => BANDS.find(([, lo, hi]) => ageH >= lo && ageH < hi)[0];

function makePool(rnd, median) {
  const n = Math.round(POSTS_PER_DAY * MAX_WINDOW / 24);
  const mu = Math.log(median);
  return Array.from({ length: n }, () => {
    const ageH = rnd() * MAX_WINDOW;
    const finalEng = Math.exp(mu + SIGMA * normal(rnd));
    return { ageH, engagement: finalEng * (1 - Math.exp(-ageH / ACCRUAL_TAU_H)), following: rnd() < FOLLOW_SHARE, own: false, seenDraw: rnd() };
  });
}

function rankPool(pool, windowH, viewerTau, rnd, probes) {
  const rows = pool.filter(p => p.ageH < windowH).map(p => ({ ...p, seen: p.seenDraw < 1 - Math.exp(-p.ageH / viewerTau) }));
  for (const pr of probes) rows.push({ ...pr, seen: false });
  for (const r of rows) r.score = rankingScore(r, rnd());
  rows.sort((a, b) => b.score - a.score || a.ageH - b.ageH); // ORDER BY ranking_score DESC, created_at DESC
  return rows;
}

// ---- run -------------------------------------------------------------------
const fmt = (x, d = 0) => x.toFixed(d);
const pct = x => `${fmt(100 * x, 0)}%`.padStart(4);
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const PROBES = [0.5, 2, 4].map(ageH => ({ ageH, engagement: 0, following: false, own: false, label: `${ageH}h` }));

console.log(`For You candidate window simulation   (live constants; ${POSTS_PER_DAY} posts/day, ${TRIALS} trials, page=${PAGE})`);
console.log(`Windows compared: ${WINDOWS.join('h vs ')}h.   Config now: CANDIDATE_MAX_AGE_HOURS=${F.CANDIDATE_MAX_AGE_HOURS}`);
console.log(`Score = (fresh floor<=${F.FRESH_BOOST} for ${F.FRESH_WINDOW_HOURS}h + follow + engagement<=${F.ENGAGEMENT_CAP}) x ${F.SEEN_DEMOTE} if seen.  No age decay after ${F.FRESH_WINDOW_HOURS}h.\n`);

console.log('DETERMINISTIC SCORECARD (same under any window; unseen, jitter excluded)');
const card = [
  ['brand-new, unfollowed, 0 engagement (0h)', { ageH: 0, engagement: 0 }],
  ['brand-new, unfollowed, 0 engagement (1h)', { ageH: 1, engagement: 0 }],
  ['brand-new, unfollowed, 0 engagement (3h)', { ageH: 3, engagement: 0 }],
  ['brand-new, FOLLOWED author, 0 engagement (0h)', { ageH: 0, engagement: 0, following: true }],
  ['your own post (1h)', { ageH: 1, engagement: 0, own: true }],
  ['3-day-old, engagement 60', { ageH: 72, engagement: 60 }],
  ['10-day-old, engagement 60  [only a 14d window sees it]', { ageH: 240, engagement: 60 }],
  ['10-day-old, engagement 250 (capped at 200)  [14d only]', { ageH: 240, engagement: 250 }],
  ['10-day-old, engagement 250, already seen  [14d only]', { ageH: 240, engagement: 250, seen: true }],
  ['10-day-old, followed author, engagement 0  [14d only]', { ageH: 240, engagement: 0, following: true }],
];
for (const [label, p] of card) console.log(`  ${label.padEnd(58)} ${fmt(rankingScore(p, 0), 1).padStart(7)}`);
const cap = F.ENGAGEMENT_CAP;
console.log(`\n  -> A post at the engagement cap (${cap}) outscores the best possible unfollowed brand-new post (${F.FRESH_BOOST}),`);
console.log(`     and a ${F.FRESH_BOOST}-engagement post (~60 likes, or ~1200 views) ties it. That is existing behaviour for 1-7 day posts;`);
console.log(`     a longer window just admits more such posts.\n`);

for (const [levelName, med] of Object.entries(ENGAGEMENT_LEVELS)) {
  for (const [viewerName, tau] of Object.entries(VIEWERS)) {
    console.log(`=== ${levelName} campus (median final engagement ${med}) / ${viewerName} (seen-rate tau ${tau}h) ===`);
    const out = {};
    for (const w of WINDOWS) out[w] = { cand: [], comp: Object.fromEntries(BANDS.map(([b]) => [b, 0])), probeRank: PROBES.map(() => []), outr: [], outrOld: [], capped: [] };
    for (let t = 0; t < TRIALS; t++) {
      const rnd = mulberry32(1000 + t * 7919 + Math.round(med * 13) + tau);
      const pool = makePool(rnd, med);
      for (const w of WINDOWS) {
        const rows = rankPool(pool, w, tau, mulberry32(t + 1), PROBES.map(p => ({ ...p })));
        const o = out[w];
        o.cand.push(rows.length - PROBES.length);
        for (const r of rows.slice(0, PAGE)) if (!r.label) o.comp[bandOf(r.ageH)]++;
        PROBES.forEach((p, i) => o.probeRank[i].push(rows.findIndex(r => r.label === p.label) + 1));
        const probe = rows.find(r => r.label === '0.5h');
        const beat = rows.filter(r => !r.label && r.score > probe.score);
        o.outr.push(beat.length);
        o.outrOld.push(beat.filter(r => r.ageH >= 168).length);
        o.capped.push(rows.slice(0, PAGE).filter(r => !r.label && r.engagement >= cap).length);
      }
    }
    const hdr = ['window'.padEnd(8), 'cands'.padStart(6), ...BANDS.map(([b]) => b.padStart(6))];
    console.log('  Share of the first page (top 50) by post age:');
    console.log('   ' + hdr.join(' '));
    for (const w of WINDOWS) {
      const o = out[w], slots = TRIALS * PAGE;
      console.log('   ' + [`${w}h`.padEnd(8), fmt(o.cand.reduce((a, b) => a + b, 0) / TRIALS).padStart(6), ...BANDS.map(([b]) => pct(o.comp[b] / slots).padStart(6))].join(' '));
    }
    console.log('  A brand-new post with ZERO engagement and an unfollowed author -- where does it land?');
    for (const w of WINDOWS) {
      const o = out[w];
      const cells = PROBES.map((p, i) => {
        const r = o.probeRank[i];
        return `${p.label}: median #${median(r)}, top-10 ${pct(r.filter(x => x <= 10).length / TRIALS).trim()}, top-50 ${pct(r.filter(x => x <= PAGE).length / TRIALS).trim()}`;
      });
      console.log(`   ${`${w}h`.padEnd(6)} ${cells.join('   |   ')}`);
    }
    console.log('  Posts that outscore that 0.5h-old zero-engagement post (the ones that sit above it):');
    for (const w of WINDOWS) {
      const o = out[w];
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      console.log(`   ${`${w}h`.padEnd(6)} avg ${fmt(avg(o.outr), 1)} posts, of which ${fmt(avg(o.outrOld), 1)} are 7-14 days old;  avg ${fmt(avg(o.capped), 1)}/50 top slots are at the engagement cap`);
    }
    console.log('');
  }
}
console.log('Engagement here is an assumed lognormal, not production data. Run the age-band SQL from the PR on Railway and re-run with matching numbers.');
