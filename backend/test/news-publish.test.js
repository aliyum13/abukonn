// News publishing (Phase 3), over HTTP through the REAL news and admin routers
// and the real auth / adminAuth / requireMediaTeam / hasRole code. Only the
// database and the push sender are faked, so what's verified is the wiring:
//   - publishing needs the media_team role on BOTH publish endpoints (403
//     otherwise, nothing written, nothing pushed), read fresh on every request;
//   - a publish pushes exactly once, to everyone but the author;
//   - the unread-count / seen endpoints are authenticated and wired to the
//     right user (the SQL itself is exercised against real Postgres separately).
//
// Users: 1 = admin + media_team (Ali), 2 = ordinary student, 3 = media_team but
// not an admin, 4 = editor (is_admin, no media_team), 5 = another student.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_CLOUD_NAME ||= 'x';
process.env.CLOUDINARY_API_KEY ||= 'x';
process.env.CLOUDINARY_API_SECRET ||= 'x';

const ADMIN_ROLE = { 1: 'admin', 4: 'editor' };
const IS_ADMIN = new Set([1, 4]);
const ALL_USER_IDS = [1, 2, 3, 4, 5];
const mediaTeam = new Set();
const newsInserts = [];
const notified = new Set();
const userUpdates = []; // UPDATE abukonn.users (last_seen_news_at)
const unreadCalls = [];
let nextNewsId = 100;
const pushCalls = [];

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) {
      return { rows: ALL_USER_IDS.includes(params[0]) ? [{ is_admin: IS_ADMIN.has(params[0]) }] : [] };
    }
    if (/^SELECT role FROM abukonn\.users/.test(s)) {
      return { rows: [{ role: ADMIN_ROLE[params[0]] || 'user' }] };
    }
    if (/^SELECT 1 FROM abukonn\.user_roles WHERE user_id = \$1 AND role_type = \$2/.test(s)) {
      assert.equal(params[1], 'media_team');
      return { rows: mediaTeam.has(params[0]) ? [{}] : [] };
    }
    if (/^UPDATE abukonn\.users SET last_active/.test(s)) return { rows: [] };
    if (/^UPDATE abukonn\.users SET last_seen_news_at = NOW\(\)/.test(s)) {
      userUpdates.push(params[0]);
      return { rows: [] };
    }
    if (/^INSERT INTO abukonn\.news/.test(s)) {
      const [title, content, category, image_url, created_by] = params;
      newsInserts.push({ title, content, category, image_url, created_by });
      return { rows: [{ id: nextNewsId++, title, content, category, image_url, created_by }] };
    }
    if (/^UPDATE abukonn\.news SET notified_at = NOW\(\)/.test(s)) {
      if (notified.has(params[0])) return { rows: [] };
      notified.add(params[0]);
      return { rows: [{ id: params[0] }] };
    }
    if (/^SELECT id FROM abukonn\.users WHERE id <> \$1/.test(s)) {
      return { rows: ALL_USER_IDS.filter(id => id !== params[0]).map(id => ({ id })) };
    }
    if (/FROM abukonn\.news n WHERE n\.created_by IS DISTINCT FROM \$1/.test(s)) {
      unreadCalls.push(params[0]);
      return { rows: [{ count: 3 }] };
    }
    if (/^UPDATE abukonn\.news SET .* WHERE id = /.test(s)) {
      return { rows: [{ id: params[params.length - 1], title: 'edited' }] };
    }
    throw new Error(`Unexpected query in test: ${s}`);
  },
};

const stub = (rel, exports) => {
  const p = require.resolve(path.join(__dirname, '..', 'src', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
stub('config/db', fakePool);
stub('lib/push', { sendPushToUsers: async (userIds, payload) => { pushCalls.push({ userIds, payload }); } });

const express = require('express');
const jwt = require('jsonwebtoken');
const { announceNews } = require('../src/lib/newsPublish');
const app = express();
app.use(express.json());
app.use('/api/news', require('../src/routes/news'));
app.use('/api/admin', require('../src/routes/admin'));

let server;
let base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());
test.beforeEach(() => {
  mediaTeam.clear();
  newsInserts.length = 0;
  notified.clear();
  userUpdates.length = 0;
  unreadCalls.length = 0;
  pushCalls.length = 0;
});

const tokenFor = id => jwt.sign({ id }, process.env.JWT_SECRET);
async function call(method, url, { token, body } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}
const settle = () => new Promise(r => setTimeout(r, 60)); // announce runs after the response

const PUBLISH_ENDPOINTS = ['/news', '/admin/news'];
const ARTICLE = { title: 'Exam timetable released', content: 'The second semester timetable is out.' };

test('publishing without a token is 401 on both endpoints', async () => {
  for (const url of PUBLISH_ENDPOINTS) {
    assert.equal((await call('POST', url, { body: ARTICLE })).status, 401, url);
  }
});

test('a user without media_team gets 403 on both endpoints, nothing is written or pushed', async () => {
  for (const [id, url] of [[2, '/news'], [4, '/admin/news'], [1, '/admin/news']]) {
    const r = await call('POST', url, { token: tokenFor(id), body: ARTICLE });
    assert.equal(r.status, 403, `user ${id} -> ${url}`);
    assert.match(r.json.message, /Media Team/);
  }
  await settle();
  assert.equal(newsInserts.length, 0);
  assert.equal(pushCalls.length, 0);
});

test('Media Team members can publish (admin panel and API), each publish pushes exactly once to everyone but the author', async () => {
  mediaTeam.add(1);
  mediaTeam.add(3);

  let r = await call('POST', '/admin/news', { token: tokenFor(1), body: ARTICLE });
  assert.equal(r.status, 201);
  await settle();
  assert.equal(pushCalls.length, 1);
  assert.deepEqual(pushCalls[0].userIds, [2, 3, 4, 5]); // not the author (1)
  assert.equal(pushCalls[0].payload.body, ARTICLE.title);
  assert.deepEqual(pushCalls[0].payload.data, { type: 'news', newsId: r.json.article.id });

  // A non-admin media_team member publishes through POST /api/news.
  r = await call('POST', '/news', { token: tokenFor(3), body: ARTICLE });
  assert.equal(r.status, 201);
  await settle();
  assert.equal(pushCalls.length, 2);
  assert.deepEqual(pushCalls[1].userIds, [1, 2, 4, 5]);
  assert.equal(newsInserts.length, 2);
});

test('the push can never go out twice for one article, even if announce is invoked repeatedly', async () => {
  const article = { id: 777, title: 'T', created_by: 1 };
  const results = await Promise.all([announceNews(article), announceNews(article), announceNews(article)]);
  assert.deepEqual(results.filter(Boolean).length, 1);
  assert.equal(pushCalls.length, 1);
});

test('the role is read fresh: revoking media_team takes effect on the next request', async () => {
  mediaTeam.add(3);
  assert.equal((await call('POST', '/news', { token: tokenFor(3), body: ARTICLE })).status, 201);
  mediaTeam.delete(3);
  assert.equal((await call('POST', '/news', { token: tokenFor(3), body: ARTICLE })).status, 403);
});

test('categories are gone: a missing or bogus category is fine and every article is stored as general', async () => {
  mediaTeam.add(1);
  assert.equal((await call('POST', '/admin/news', { token: tokenFor(1), body: { ...ARTICLE, category: 'bogus' } })).status, 201);
  assert.equal((await call('POST', '/admin/news', { token: tokenFor(1), body: ARTICLE })).status, 201);
  assert.deepEqual(newsInserts.map(n => n.category), ['general', 'general']);
});

test('title and content are still required, and a rejected publish pushes nothing', async () => {
  mediaTeam.add(1);
  assert.equal((await call('POST', '/admin/news', { token: tokenFor(1), body: { title: 'x' } })).status, 400);
  assert.equal((await call('POST', '/news', { token: tokenFor(1), body: { content: 'x' } })).status, 400);
  await settle();
  assert.equal(pushCalls.length, 0);
});

test('editing an article never notifies', async () => {
  mediaTeam.add(1);
  const r = await call('PUT', '/admin/news/42', { token: tokenFor(1), body: { title: 'edited' } });
  assert.equal(r.status, 200);
  await settle();
  assert.equal(pushCalls.length, 0);
});

test('unread-count and seen need auth, are not swallowed by /:id, and act on the caller', async () => {
  assert.equal((await call('GET', '/news/unread-count')).status, 401);
  assert.equal((await call('POST', '/news/seen')).status, 401);

  const r = await call('GET', '/news/unread-count', { token: tokenFor(2) });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { count: 3 });
  assert.deepEqual(unreadCalls, [2]);

  const seen = await call('POST', '/news/seen', { token: tokenFor(5) });
  assert.equal(seen.status, 200);
  assert.deepEqual(seen.json, { count: 0 });
  assert.deepEqual(userUpdates, [5]);
});
