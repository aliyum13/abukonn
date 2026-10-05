// Library upload access, over HTTP through the REAL library router: the real
// auth, the real requireLibraryUploader / hasRole, the real shared upload chain
// (multer limits, file filter, clean JSON errors) and the real controller. Only
// the database and Cloudinary are stubbed.
//
// Users: 1 = full admin, 2 = Library Contributor who is NOT an admin,
// 3 = ordinary student, 4 = editor (is_admin, role 'editor', no contributor role).

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';

const USERS = {
  1: { is_admin: true, role: 'admin' },
  2: { is_admin: false, role: 'user' },
  3: { is_admin: false, role: 'user' },
  4: { is_admin: true, role: 'editor' },
};
const contributors = new Set();
const inserts = []; // library_materials INSERT params
const cloudinaryUploads = [];

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT role FROM abukonn\.users/.test(s)) {
      return { rows: USERS[params[0]] ? [{ role: USERS[params[0]].role }] : [] };
    }
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) {
      return { rows: USERS[params[0]] ? [{ is_admin: USERS[params[0]].is_admin }] : [] };
    }
    if (/^SELECT 1 FROM abukonn\.user_roles/.test(s)) {
      assert.equal(params[1], 'library_contributor');
      return { rows: contributors.has(params[0]) ? [{}] : [] };
    }
    if (/^UPDATE abukonn\.users SET last_active/.test(s)) return { rows: [] };
    if (/^INSERT INTO abukonn\.library_materials/.test(s)) {
      inserts.push(params);
      const [title, description, type, faculty, department, level, course_code, course_title, file_url, file_name, file_size, file_type, uploaded_by] = params;
      return { rows: [{ id: 50, title, type, file_url, file_name, file_size, file_type, uploaded_by }] };
    }
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
      upload_stream(opts, cb) {
        return {
          end(buffer) {
            cloudinaryUploads.push({ opts, bytes: buffer.length });
            cb(null, { secure_url: `https://res.cloudinary.com/demo/raw/upload/${opts.folder}/${opts.public_id}` });
          },
        };
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
  inserts.length = 0;
  cloudinaryUploads.length = 0;
});

const tokenFor = id => jwt.sign({ id }, process.env.JWT_SECRET);

async function upload(url, { token, name = 'notes.pdf', type = 'application/pdf', bytes = 1024 } = {}) {
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.alloc(bytes, 1)], { type }), name);
  fd.append('title', 'CSC 301 Past Questions');
  fd.append('type', 'past_question');
  const res = await fetch(base + url, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
const get = async (url, token) => {
  const res = await fetch(base + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const UPLOAD_PATHS = ['/upload', '/admin/upload'];

test('uploading without a token is 401 on both paths', async () => {
  for (const p of UPLOAD_PATHS) assert.equal((await upload(p)).status, 401, p);
});

test('a non-contributor, non-admin gets 403 on both paths, and nothing is uploaded or stored', async () => {
  for (const id of [3, 4]) { // ordinary student, and an editor (is_admin but no contributor role)
    for (const p of UPLOAD_PATHS) {
      const r = await upload(p, { token: tokenFor(id) });
      assert.equal(r.status, 403, `user ${id} ${p}`);
      assert.match(r.json.message, /Library Contributor/);
    }
  }
  assert.equal(cloudinaryUploads.length, 0);
  assert.equal(inserts.length, 0);
});

test('a contributor who is NOT an admin can upload, and the uploader id is stored', async () => {
  contributors.add(2);
  for (const p of UPLOAD_PATHS) {
    const r = await upload(p, { token: tokenFor(2) });
    assert.equal(r.status, 200, p);
  }
  assert.equal(inserts.length, 2);
  assert.equal(inserts[0][12], 2); // uploaded_by
  assert.equal(cloudinaryUploads[0].opts.resource_type, 'raw');
});

test('a full admin can upload without holding the contributor role', async () => {
  const r = await upload('/upload', { token: tokenFor(1) });
  assert.equal(r.status, 200);
  assert.equal(inserts[0][12], 1);
});

test('the role is read fresh: revoking contributor takes effect on the next upload', async () => {
  contributors.add(2);
  assert.equal((await upload('/upload', { token: tokenFor(2) })).status, 200);
  contributors.delete(2);
  assert.equal((await upload('/upload', { token: tokenFor(2) })).status, 403);
});

test('the shared path keeps the upload limits and clean errors (25MB, accepted types)', async () => {
  contributors.add(2);
  let r = await upload('/upload', { token: tokenFor(2), bytes: 26 * 1024 * 1024 });
  assert.equal(r.status, 400);
  assert.equal(r.json.message, 'File exceeds the 25MB limit');

  r = await upload('/upload', { token: tokenFor(2), name: 'setup.exe', type: 'application/x-msdownload' });
  assert.equal(r.status, 400);
  assert.match(r.json.message, /Unsupported file type/);

  // Office doc with a missing MIME type is accepted via the extension fallback.
  r = await upload('/upload', { token: tokenFor(2), name: 'notes.docx', type: '' });
  assert.equal(r.status, 200);
  // A 13MB file is under the 25MB cap.
  r = await upload('/upload', { token: tokenFor(2), bytes: 13 * 1024 * 1024 });
  assert.equal(r.status, 200);
});

test('/permissions needs auth and reports exactly what the gate enforces', async () => {
  assert.equal((await get('/permissions')).status, 401);
  contributors.add(2);
  const expected = { 1: true, 2: true, 3: false, 4: false };
  for (const [id, can] of Object.entries(expected)) {
    const r = await get('/permissions', tokenFor(Number(id)));
    assert.equal(r.status, 200);
    assert.deepEqual(r.json, { can_upload: can }, `user ${id}`);
  }
});
