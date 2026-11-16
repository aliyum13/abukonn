// Who may edit or delete a News article, over HTTP through the REAL news and admin routers and
// the real auth / adminAuth / requireNewsManage / hasRole code. Only the database and
// Cloudinary are faked.
//
// Rule: a FULL admin (users.role === 'admin') may change any article; a Media Team member may
// change only the articles they published; nobody else (editors and class coordinators carry
// is_admin but, before this, could edit and delete ANY article).
//
// Users: 1 = full admin (no media_team), 2 = ordinary student, 3 = media_team (non-admin) who
// published article 10, 4 = editor (is_admin, no media_team), 5 = media_team (non-admin) who
// published nothing, 6 = editor who ALSO holds media_team and published article 11.
// Articles: 10 by user 3 (has a cover), 11 by user 6, 12 by user 1, 13 with created_by NULL.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';

const ROLE = { 1: 'admin', 4: 'editor', 6: 'editor' };
const IS_ADMIN = new Set([1, 4, 6]);
const ALL_USERS = [1, 2, 3, 4, 5, 6];
const mediaTeam = new Set();
const COVER = 'https://res.cloudinary.com/demo/image/upload/v1700000000/abukonn/news/cover10.jpg';
let articles;
const updates = [];
const destroyed = [];
const pushes = [];
let destroyShouldThrow = false;

const resetArticles = () => {
  articles = new Map([
    [10, { id: 10, title: 'T10', created_by: 3, image_url: COVER }],
    [11, { id: 11, title: 'T11', created_by: 6, image_url: null }],
    [12, { id: 12, title: 'T12', created_by: 1, image_url: null }],
    [13, { id: 13, title: 'T13', created_by: null, image_url: null }],
  ]);
};

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) {
      return { rows: ALL_USERS.includes(params[0]) ? [{ is_admin: IS_ADMIN.has(params[0]) }] : [] };
    }
    if (/^SELECT role FROM abukonn\.users/.test(s)) return { rows: [{ role: ROLE[params[0]] || 'user' }] };
    if (/^SELECT 1 FROM abukonn\.user_roles WHERE user_id = \$1 AND role_type = \$2/.test(s)) {
      assert.equal(params[1], 'media_team');
      return { rows: mediaTeam.has(params[0]) ? [{}] : [] };
    }
    if (/^UPDATE abukonn\.users SET last_active/.test(s)) return { rows: [] };
    if (/^SELECT id, created_by, image_url FROM abukonn\.news WHERE id = \$1/.test(s)) {
      const a = articles.get(params[0]);
      return { rows: a ? [{ id: a.id, created_by: a.created_by, image_url: a.image_url }] : [] };
    }
    if (/^UPDATE abukonn\.news SET .* WHERE id = \$\d+ RETURNING \*/.test(s)) {
      const id = params[params.length - 1];
      updates.push({ sql: s, params });
      const a = articles.get(id);
      return { rows: a ? [{ ...a, title: 'edited' }] : [] };
    }
    if (/^DELETE FROM abukonn\.news WHERE id = \$1 RETURNING id, title, image_url/.test(s)) {
      const a = articles.get(params[0]);
      if (!a) return { rows: [] };
      articles.delete(params[0]);
      return { rows: [{ id: a.id, title: a.title, image_url: a.image_url }] };
    }
    throw new Error(`Unexpected query in test: ${s}`);
  },
};

const stub = (rel, exports) => {
  const p = require.resolve(path.join(__dirname, '..', 'src', rel));
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
stub('config/db', fakePool);
stub('lib/push', { sendPushToUsers: async (...a) => { pushes.push(a); } });
stub('config/cloudinary', {
  config() {},
  uploader: {
    async destroy(publicId, opts) {
      destroyed.push({ publicId, opts });
      if (destroyShouldThrow) throw new Error('cloudinary down');
      return { result: 'ok' };
    },
    async upload() { return { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/abukonn/news/new.jpg' }; },
  },
});

const express = require('express');
const jwt = require('jsonwebtoken');
const { mayManageNews } = require('../src/middleware/requireNewsManage');
const { newsCoverPublicIdFromUrl, deleteNewsCover } = require('../src/lib/newsAsset');
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
  resetArticles();
  mediaTeam.clear();
  updates.length = 0;
  destroyed.length = 0;
  pushes.length = 0;
  destroyShouldThrow = false;
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
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const settle = () => new Promise(r => setTimeout(r, 60)); // cover cleanup runs after the response

// ── the rule itself ──────────────────────────────────────────────────────

test('mayManageNews: full admin any article; media team own only; nobody else', () => {
  const art = { created_by: 3 };
  assert.equal(mayManageNews({ isFullAdmin: true, isMediaTeam: false, userId: 1 }, art), true);
  assert.equal(mayManageNews({ isFullAdmin: false, isMediaTeam: true, userId: 3 }, art), true);
  assert.equal(mayManageNews({ isFullAdmin: false, isMediaTeam: true, userId: 5 }, art), false);
  assert.equal(mayManageNews({ isFullAdmin: false, isMediaTeam: false, userId: 3 }, art), false); // author whose role was revoked
  assert.equal(mayManageNews({ isFullAdmin: false, isMediaTeam: true, userId: 3 }, { created_by: null }), false);
  assert.equal(mayManageNews({ isFullAdmin: true, isMediaTeam: false, userId: 1 }, { created_by: null }), true);
});

// ── over HTTP, on both route sets ────────────────────────────────────────

const ROUTES = [['/news', 'api'], ['/admin/news', 'admin']];

test('logged out is 401 on edit and delete, on both route sets', async () => {
  for (const [prefix] of ROUTES) {
    assert.equal((await call('PUT', `${prefix}/10`, { body: { title: 'x' } })).status, 401, prefix);
    assert.equal((await call('DELETE', `${prefix}/10`)).status, 401, prefix);
  }
});

test('a full admin can edit and delete any article, including one with no author, without media_team', async () => {
  for (const [prefix] of ROUTES) {
    resetArticles();
    for (const id of [10, 11, 13]) {
      const put = await call('PUT', `${prefix}/${id}`, { token: tokenFor(1), body: { title: 'New title' } });
      assert.equal(put.status, 200, `${prefix} PUT ${id}`);
      assert.equal(put.json.article.id, id);
    }
    assert.equal((await call('DELETE', `${prefix}/12`, { token: tokenFor(1) })).status, 200, `${prefix} DELETE 12`);
    assert.equal(articles.has(12), false);
  }
});

test('a Media Team member can edit and delete their OWN article through /api/news', async () => {
  mediaTeam.add(3);
  const put = await call('PUT', '/news/10', { token: tokenFor(3), body: { title: 'Corrected headline', content: 'Corrected body' } });
  assert.equal(put.status, 200);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].params, ['Corrected headline', 'Corrected body', 10]);
  const del = await call('DELETE', '/news/10', { token: tokenFor(3) });
  assert.equal(del.status, 200);
  assert.match(del.json.message, /T10/);
  assert.equal(articles.has(10), false);
});

test("a Media Team member cannot touch someone else's article (nothing changes)", async () => {
  mediaTeam.add(5);
  for (const [prefix] of [['/news']]) {
    const put = await call('PUT', `${prefix}/10`, { token: tokenFor(5), body: { title: 'hijack' } });
    assert.equal(put.status, 403);
    assert.match(put.json.message, /you published/);
    assert.equal((await call('DELETE', `${prefix}/10`, { token: tokenFor(5) })).status, 403);
    assert.equal((await call('PUT', `${prefix}/13`, { token: tokenFor(5), body: { title: 'x' } })).status, 403); // no author: admins only
  }
  assert.equal(updates.length, 0);
  assert.equal(articles.has(10), true);
  await settle();
  assert.equal(destroyed.length, 0);
});

test('an ordinary user and an editor WITHOUT media_team are refused on every route', async () => {
  for (const id of [2, 4]) {
    for (const [prefix] of ROUTES) {
      // /admin is refused earlier for the student (not is_admin); the editor reaches requireNewsManage.
      for (const r of [await call('PUT', `${prefix}/12`, { token: tokenFor(id), body: { title: 'x' } }),
        await call('DELETE', `${prefix}/12`, { token: tokenFor(id) })]) {
        assert.equal(r.status, 403, `user ${id} ${prefix}`);
      }
    }
  }
  assert.equal(updates.length, 0);
  assert.equal(articles.size, 4);
});

test('an editor who also holds media_team can change only their own article (admin panel route)', async () => {
  mediaTeam.add(6);
  assert.equal((await call('PUT', '/admin/news/11', { token: tokenFor(6), body: { title: 'mine' } })).status, 200);
  assert.equal((await call('PUT', '/admin/news/12', { token: tokenFor(6), body: { title: 'not mine' } })).status, 403);
  assert.equal((await call('DELETE', '/admin/news/11', { token: tokenFor(6) })).status, 200);
});

test('a non-admin Media Team member cannot use the admin panel route at all (they use /api/news)', async () => {
  mediaTeam.add(3);
  assert.equal((await call('PUT', '/admin/news/10', { token: tokenFor(3), body: { title: 'x' } })).status, 403);
  assert.equal((await call('DELETE', '/admin/news/10', { token: tokenFor(3) })).status, 403);
});

test('the role is read fresh: a revoked Media Team author is refused on the next request', async () => {
  mediaTeam.add(3);
  assert.equal((await call('PUT', '/news/10', { token: tokenFor(3), body: { title: 'ok' } })).status, 200);
  mediaTeam.delete(3);
  assert.equal((await call('PUT', '/news/10', { token: tokenFor(3), body: { title: 'again' } })).status, 403);
  assert.equal((await call('DELETE', '/news/10', { token: tokenFor(3) })).status, 403);
  assert.equal(articles.has(10), true);
});

test('a user with no rights cannot probe which ids exist (403 before the lookup); an allowed user gets 404', async () => {
  assert.equal((await call('DELETE', '/news/999', { token: tokenFor(2) })).status, 403);
  assert.equal((await call('DELETE', '/news/12', { token: tokenFor(2) })).status, 403); // same answer as for a missing id
  assert.equal((await call('DELETE', '/news/999', { token: tokenFor(1) })).status, 404);
  assert.equal((await call('PUT', '/news/999', { token: tokenFor(1), body: { title: 'x' } })).status, 404);
  assert.equal((await call('DELETE', '/news/abc', { token: tokenFor(1) })).status, 404);
});

// ── edit behaviour ───────────────────────────────────────────────────────

test('edit: category is gone -- ignored if sent, never written, never rejected', async () => {
  const bogus = await call('PUT', '/admin/news/12', { token: tokenFor(1), body: { title: 'x', category: 'not-a-category' } });
  assert.equal(bogus.status, 200);
  const only = await call('PUT', '/news/12', { token: tokenFor(1), body: { category: 'sports' } });
  assert.equal(only.status, 400); // category alone is "nothing to update"
  for (const u of updates) assert.doesNotMatch(u.sql, /category/);
});

test('edit: validation and a changed cover URL', async () => {
  assert.equal((await call('PUT', '/news/12', { token: tokenFor(1), body: {} })).status, 400);
  assert.equal((await call('PUT', '/news/12', { token: tokenFor(1), body: { title: 123 } })).status, 400);
  const img = await call('PUT', '/news/12', { token: tokenFor(1), body: { image_url: 'https://res.cloudinary.com/demo/image/upload/v2/abukonn/news/b.jpg' } });
  assert.equal(img.status, 200);
  assert.deepEqual(updates.at(-1).params, ['https://res.cloudinary.com/demo/image/upload/v2/abukonn/news/b.jpg', 12]);
  await call('PUT', '/news/12', { token: tokenFor(1), body: { image_url: '' } }); // clears the cover
  assert.deepEqual(updates.at(-1).params, [null, 12]);
});

test('editing never notifies anyone', async () => {
  await call('PUT', '/news/12', { token: tokenFor(1), body: { title: 'again' } });
  await call('PUT', '/admin/news/12', { token: tokenFor(1), body: { title: 'again' } });
  await settle();
  assert.equal(pushes.length, 0);
});

// ── delete removes the cover image ───────────────────────────────────────

test('delete: the article goes, then its Cloudinary cover is destroyed exactly once', async () => {
  const r = await call('DELETE', '/admin/news/10', { token: tokenFor(1) });
  assert.equal(r.status, 200);
  await settle();
  assert.deepEqual(destroyed, [{ publicId: 'abukonn/news/cover10', opts: { resource_type: 'image', invalidate: true } }]);
});

test('delete: a Cloudinary failure never fails the delete', async () => {
  destroyShouldThrow = true;
  const r = await call('DELETE', '/news/10', { token: tokenFor(1) });
  assert.equal(r.status, 200);
  await settle();
  assert.equal(articles.has(10), false);
});

test('delete: an article with no cover, or a cover we do not own, destroys nothing', async () => {
  assert.equal((await call('DELETE', '/news/12', { token: tokenFor(1) })).status, 200); // no cover
  articles.set(20, { id: 20, title: 'T20', created_by: 1, image_url: 'https://res.cloudinary.com/someone-else/image/upload/v1/abukonn/news/x.jpg' });
  articles.set(21, { id: 21, title: 'T21', created_by: 1, image_url: 'https://res.cloudinary.com/demo/image/upload/v1/abukonn/posts/x.jpg' });
  articles.set(22, { id: 22, title: 'T22', created_by: 1, image_url: 'https://example.com/a.jpg' });
  for (const id of [20, 21, 22]) assert.equal((await call('DELETE', `/news/${id}`, { token: tokenFor(1) })).status, 200);
  await settle();
  assert.equal(destroyed.length, 0);
});

test('newsCoverPublicIdFromUrl: strict about cloud, resource type, folder and traversal', () => {
  assert.equal(newsCoverPublicIdFromUrl(COVER, 'demo'), 'abukonn/news/cover10');
  assert.equal(newsCoverPublicIdFromUrl('https://res.cloudinary.com/demo/image/upload/abukonn/news/no-version.png', 'demo'), 'abukonn/news/no-version');
  for (const bad of [
    'https://res.cloudinary.com/other/image/upload/v1/abukonn/news/a.jpg',
    'https://res.cloudinary.com/demo/raw/upload/v1/abukonn/news/a.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1/abukonn/library/a.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1/abukonn/news/../posts/a.jpg',
    'https://res.cloudinary.com/demo/image/upload/v1/abukonn/news/',
    'https://res.cloudinary.com/demo/image/upload/f_auto/v1/abukonn/news/a.jpg',
    'http://res.cloudinary.com/demo/image/upload/v1/abukonn/news/a.jpg',
    'not a url', '',
  ]) assert.equal(newsCoverPublicIdFromUrl(bad, 'demo'), null, bad);
});

test('deleteNewsCover never throws and reports whether Cloudinary confirmed', async () => {
  assert.equal(await deleteNewsCover(null), false);
  assert.equal(await deleteNewsCover(COVER), true);
  destroyShouldThrow = true;
  assert.equal(await deleteNewsCover(COVER), false);
});
