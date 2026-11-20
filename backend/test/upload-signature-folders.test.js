// The signed-upload endpoint (GET /api/stories/upload-signature) only signs for a fixed
// allowlist of Cloudinary folders; anything else is silently signed for abukonn/stories.
// abukonn/news is on the list so the mobile News composer can upload a cover image to the
// same folder the admin panel's multipart upload uses.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.CLOUDINARY_API_KEY = 'key123';
process.env.CLOUDINARY_API_SECRET = 'secret456';

const dbPath = require.resolve('../src/config/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query: async () => ({ rows: [] }) } };
const { getUploadSignature } = require(path.join('..', 'src', 'controllers', 'storyController'));

async function sign(query) {
  let body; let status = 200;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  await getUploadSignature({ query, user: { id: 1 } }, res);
  return { status, body };
}

test('abukonn/news is signed for as itself', async () => {
  const r = await sign({ folder: 'abukonn/news' });
  assert.equal(r.status, 200);
  assert.equal(r.body.folder, 'abukonn/news');
  assert.equal(r.body.cloud_name, 'demo');
  assert.equal(r.body.api_key, 'key123');
  assert.ok(r.body.signature && r.body.timestamp);
});

test('the signature is bound to the folder: a news signature differs from a stories one', async () => {
  const news = await sign({ folder: 'abukonn/news' });
  const stories = await sign({ folder: 'abukonn/stories' });
  // Same second, same secret: only the folder differs, so the signatures must differ.
  if (news.body.timestamp === stories.body.timestamp) assert.notEqual(news.body.signature, stories.body.signature);
});

test('the existing folders are unchanged', async () => {
  for (const f of ['abukonn/stories', 'abukonn/posts', 'abukonn/messages', 'abukonn/files', 'abukonn/groups']) {
    assert.equal((await sign({ folder: f })).body.folder, f);
  }
});

test('an unlisted folder still falls back to stories (nothing else became signable)', async () => {
  for (const f of ['abukonn/library', 'abukonn/admin', 'abukonn/news/../x', 'abukonn/newsx', '']) {
    assert.equal((await sign({ folder: f })).body.folder, 'abukonn/stories', `"${f}"`);
  }
  assert.equal((await sign({})).body.folder, 'abukonn/stories');
});
