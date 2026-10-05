// Library delete rules, over HTTP through the REAL library router, the real
// auth / adminAuth / requireFullAdmin, the real access rules and the real
// controller. Only the database and Cloudinary are stubbed.
//
// Rule: a full admin may delete any material; a Library Contributor may delete
// only materials they uploaded (uploaded_by === their id); nobody else may.
// Roles are read fresh every request.
//
// Users: 1 = full admin, 2 and 3 = Library Contributors (not admins),
// 4 = ordinary student, 5 = editor (is_admin, role 'editor', no contributor role).
// Materials: 10 uploaded by 2, 11 uploaded by 3, 12 uploaded_by NULL (uploader's
// account was deleted).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';

const USERS = {
  1: { is_admin: true, role: 'admin' },
  2: { is_admin: false, role: 'user' },
  3: { is_admin: false, role: 'user' },
  4: { is_admin: false, role: 'user' },
  5: { is_admin: true, role: 'editor' },
};
const contributors = new Set();
let materials = new Map();
const destroyCalls = [];
let destroyMode = 'ok'; // 'ok' | 'throw' | 'not_found'

const url = name => `https://res.cloudinary.com/demo/raw/upload/v1700000000/abukonn/library/${name}`;
const freshMaterials = () => new Map([
  [10, { id: 10, title: 'Mine', uploaded_by: 2, file_url: url('own_abc123.pdf') }],
  [11, { id: 11, title: 'Theirs', uploaded_by: 3, file_url: url('other_def456.pdf') }],
  [12, { id: 12, title: 'Orphan', uploaded_by: null, file_url: url('orphan_ghi789.pdf') }],
]);

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT role FROM abukonn\.users/.test(s)) return { rows: USERS[params[0]] ? [{ role: USERS[params[0]].role }] : [] };
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) return { rows: USERS[params[0]] ? [{ is_admin: USERS[params[0]].is_admin }] : [] };
    if (/^SELECT 1 FROM abukonn\.user_roles/.test(s)) return { rows: contributors.has(params[0]) ? [{}] : [] };
    if (/^UPDATE abukonn\.users SET last_active/.test(s)) return { rows: [] };
    if (/WHERE lm\.id = \$1/.test(s)) return { rows: materials.has(params[0]) ? [materials.get(Number(params[0]))] : [] };
    if (/^DELETE FROM abukonn\.library_materials WHERE id = \$1/.test(s)) {
      materials.delete(Number(params[0]));
      return { rows: [] };
    }
    if (/^SELECT COUNT\(\*\) FROM abukonn\.library_materials/.test(s)) return { rows: [{ count: String(materials.size) }] };
    if (/^SELECT lm\.\*, u\.full_name AS uploader_name FROM abukonn\.library_materials lm/.test(s)) return { rows: [...materials.values()] };
    throw new Error(`Unexpected query in test: ${s}`);
  },
};

const stub = (id, exports) => {
  const p = require.resolve(id.startsWith('.') ? path.join(__dirname, id) : id);
  require.cache[p] = { id: p, filename: p, loaded: true, exports };
};
stub('../src/config/db', fakePool);
stub('cloudinary', {
  v2: {
    config() {},
    uploader: {
      async destroy(publicId, opts) {
        destroyCalls.push({ publicId, opts });
        if (destroyMode === 'throw') throw new Error('cloudinary is down');
        return { result: destroyMode === 'not_found' ? 'not found' : 'ok' };
      },
    },
  },
});

const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
app.use('/api/library', require('../src/routes/library'));

let server;
let base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}/api/library`;
});
test.after(() => server.close());
test.beforeEach(() => {
  contributors.clear();
  contributors.add(2);
  contributors.add(3);
  materials = freshMaterials();
  destroyCalls.length = 0;
  destroyMode = 'ok';
});

const tokenFor = id => jwt.sign({ id }, process.env.JWT_SECRET);
async function del(urlPath, userId) {
  const res = await fetch(base + urlPath, { method: 'DELETE', headers: userId ? { Authorization: `Bearer ${tokenFor(userId)}` } : {} });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const settle = () => new Promise(r => setTimeout(r, 60)); // storage cleanup runs after the response

test('no token is 401', async () => {
  assert.equal((await del('/10')).status, 401);
  assert.equal((await del('/admin/10')).status, 401);
  assert.equal(materials.size, 3);
});

test('a contributor can delete their own upload, and its file is removed from Cloudinary', async () => {
  const r = await del('/10', 2);
  assert.equal(r.status, 200);
  assert.equal(materials.has(10), false);
  await settle();
  assert.deepEqual(destroyCalls, [{ publicId: 'abukonn/library/own_abc123.pdf', opts: { resource_type: 'raw', invalidate: true } }]);
});

test("a contributor cannot delete someone else's upload (403) and nothing is touched", async () => {
  const r = await del('/11', 2);
  assert.equal(r.status, 403);
  assert.match(r.json.message, /only delete materials you uploaded/);
  assert.equal(materials.has(11), true);
  await settle();
  assert.equal(destroyCalls.length, 0);
});

test('a revoked contributor is refused immediately, even for their own upload', async () => {
  assert.equal((await del('/10', 2)).status, 200); // allowed while they hold the role
  materials = freshMaterials();
  contributors.delete(2);
  const r = await del('/10', 2);
  assert.equal(r.status, 403);
  assert.equal(materials.has(10), true);
});

test('an editor (is_admin) and a student are refused on both paths, existing or not (no id probing)', async () => {
  for (const id of [4, 5]) {
    for (const p of ['/10', '/11', '/999', '/admin/10', '/admin/999']) {
      assert.equal((await del(p, id)).status, 403, `user ${id} ${p}`);
    }
  }
  assert.equal(materials.size, 3);
  await settle();
  assert.equal(destroyCalls.length, 0);
});

test("a full admin can delete anyone's material", async () => {
  assert.equal((await del('/10', 1)).status, 200);
  assert.equal((await del('/11', 1)).status, 200);
  assert.equal(materials.size, 1);
});

test('a material with NULL uploaded_by is deletable by a full admin only', async () => {
  assert.equal((await del('/12', 2)).status, 403);
  assert.equal((await del('/12', 3)).status, 403);
  assert.equal(materials.has(12), true);
  assert.equal((await del('/12', 1)).status, 200);
  assert.equal(materials.has(12), false);
});

test('a missing material is 404 (for admins and contributors), including a non-numeric id', async () => {
  assert.equal((await del('/999', 1)).status, 404);
  assert.equal((await del('/999', 2)).status, 404);
  assert.equal((await del('/abc', 2)).status, 404);
  assert.equal(materials.size, 3);
});

test('/admin/:id is tightened to full admins: an editor and a contributor are refused, an admin passes', async () => {
  assert.equal((await del('/admin/10', 5)).status, 403); // editor used to be allowed
  assert.equal((await del('/admin/10', 2)).status, 403); // contributor is not is_admin
  assert.equal(materials.has(10), true);
  assert.equal((await del('/admin/10', 1)).status, 200);
  assert.equal(materials.has(10), false);
});

test('a Cloudinary failure never fails the delete (the row is already gone)', async () => {
  destroyMode = 'throw';
  assert.equal((await del('/10', 2)).status, 200);
  assert.equal(materials.has(10), false);
  await settle();
  assert.equal(destroyCalls.length, 1);

  destroyMode = 'not_found';
  assert.equal((await del('/11', 3)).status, 200);
  assert.equal(materials.has(11), false);
});

test('a file_url we cannot identify with certainty is not sent to Cloudinary at all', async () => {
  materials.set(13, { id: 13, title: 'Odd', uploaded_by: 2, file_url: 'https://example.com/somewhere/else.pdf' });
  materials.set(14, { id: 14, title: 'Other folder', uploaded_by: 2, file_url: 'https://res.cloudinary.com/demo/raw/upload/v1/abukonn/messages/chat.pdf' });
  assert.equal((await del('/13', 2)).status, 200);
  assert.equal((await del('/14', 2)).status, 200);
  await settle();
  assert.equal(destroyCalls.length, 0);
});

test('browse tells each viewer exactly what they may delete (same rule as the endpoint)', async () => {
  const flags = async userId => {
    const res = await fetch(base + '/', { headers: { Authorization: `Bearer ${tokenFor(userId)}` } });
    const body = await res.json();
    return Object.fromEntries(body.materials.map(m => [m.id, m.can_delete]));
  };
  assert.deepEqual(await flags(1), { 10: true, 11: true, 12: true });  // full admin: all
  assert.deepEqual(await flags(2), { 10: true, 11: false, 12: false }); // contributor: own only
  assert.deepEqual(await flags(4), { 10: false, 11: false, 12: false }); // student: none
  assert.deepEqual(await flags(5), { 10: false, 11: false, 12: false }); // editor: none
});

test('public_id derivation is strict: only our own cloud, raw resources and library folder', () => {
  const { libraryPublicIdFromUrl } = require('../src/lib/libraryAsset');
  const f = u => libraryPublicIdFromUrl(u, 'demo');
  assert.equal(f(url('notes_ab12cd.pdf')), 'abukonn/library/notes_ab12cd.pdf');
  assert.equal(f('https://res.cloudinary.com/demo/raw/upload/abukonn/library/file_fxzsj0'), 'abukonn/library/file_fxzsj0'); // legacy, no extension/version
  assert.equal(f('https://res.cloudinary.com/other/raw/upload/v1/abukonn/library/a.pdf'), null);   // someone else's cloud
  assert.equal(f('https://res.cloudinary.com/demo/image/upload/v1/abukonn/library/a.pdf'), null);  // not a raw asset
  assert.equal(f('https://res.cloudinary.com/demo/raw/authenticated/v1/abukonn/library/a.pdf'), null);
  assert.equal(f('https://res.cloudinary.com/demo/raw/upload/v1/abukonn/messages/a.pdf'), null);   // outside the library folder
  assert.equal(f('https://res.cloudinary.com/demo/raw/upload/v1/abukonn/library/'), null);
  assert.equal(f('https://res.cloudinary.com/demo/raw/upload/v1/abukonn/library/%2e%2e/x.pdf'), null);
  assert.equal(f('http://res.cloudinary.com/demo/raw/upload/v1/abukonn/library/a.pdf'), null);
  assert.equal(f('not a url'), null);
});
