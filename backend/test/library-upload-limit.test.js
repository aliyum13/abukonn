// The Library's 10MB upload limit, over HTTP through the real library router.
// Cloudinary's account cap on a single file is 10MB; our cap used to be 25MB, so
// a 21.5MB PDF passed every check of ours and then failed at the last step with
// "Server error: File size too large. Got 22519144. Maximum is 10485760."
//
// Only the database and Cloudinary are stubbed.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

process.env.JWT_SECRET = 'test-secret';

const MB = 1024 * 1024;
const FRIENDLY = "Files over 10MB can't be uploaded yet";

const inserts = [];
const cloudinaryUploads = [];
// What the stubbed Cloudinary does on the next upload: 'ok' | 'too-large' | 'boom'
let cloudinaryMode = 'ok';

const fakePool = {
  async query(sql, params = []) {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/^SELECT role FROM abukonn\.users/.test(s)) return { rows: [{ role: 'admin' }] };
    if (/^SELECT is_admin FROM abukonn\.users/.test(s)) return { rows: [{ is_admin: true }] };
    if (/^SELECT 1 FROM abukonn\.user_roles/.test(s)) return { rows: [] };
    if (/^UPDATE abukonn\.users SET last_active/.test(s)) return { rows: [] };
    if (/^INSERT INTO abukonn\.library_materials/.test(s)) {
      inserts.push(params);
      return { rows: [{ id: 50, file_size: params[10] }] };
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
            if (cloudinaryMode === 'too-large') {
              // The exact object shape and text Cloudinary returned in production.
              return cb({ message: `File size too large. Got ${buffer.length}. Maximum is 10485760.`, http_code: 400 });
            }
            if (cloudinaryMode === 'boom') return cb({ message: 'Invalid cloud_name', http_code: 401 });
            cb(null, { secure_url: `https://res.cloudinary.com/demo/raw/upload/${opts.folder}/${opts.public_id}` });
          },
        };
      },
    },
  },
});

const express = require('express');
const jwt = require('jsonwebtoken');
const uploadAny = require('../src/middleware/uploadAny');
const { LIBRARY_MAX_FILE_SIZE, LIBRARY_TOO_LARGE_MESSAGE, libraryUploadFailure } = require('../src/lib/libraryLimits');

const app = express();
app.use(express.json());
app.use('/api/library', require('../src/routes/library'));
// The admin CSV routes share uploadAny with the library, so a stand-in route
// proves they were not dragged down to the library's lower cap.
app.post('/csv', uploadAny.single('csv'), uploadAny.handleUploadError, (req, res) => res.json({ size: req.file.size }));

let server;
let base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());
test.beforeEach(() => {
  inserts.length = 0;
  cloudinaryUploads.length = 0;
  cloudinaryMode = 'ok';
});

const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET);

async function uploadLibrary(bytes, name = 'notes.pdf', type = 'application/pdf') {
  const fd = new FormData();
  fd.append('file', new Blob([Buffer.alloc(bytes, 1)], { type }), name);
  fd.append('title', 'CSC 301 Past Questions');
  fd.append('type', 'past_question');
  const res = await fetch(`${base}/api/library/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

test('the limit is exactly 10MB and the friendly message says so', () => {
  assert.equal(LIBRARY_MAX_FILE_SIZE, 10 * MB);
  assert.equal(LIBRARY_MAX_FILE_SIZE, 10485760); // Cloudinary's own "Maximum is 10485760"
  assert.equal(LIBRARY_TOO_LARGE_MESSAGE, FRIENDLY);
});

test('a file of exactly 10MB is accepted, one byte over is refused', async () => {
  let r = await uploadLibrary(10 * MB);
  assert.equal(r.status, 200);
  assert.equal(cloudinaryUploads.length, 1);

  cloudinaryUploads.length = 0;
  inserts.length = 0;
  r = await uploadLibrary(10 * MB + 1);
  assert.equal(r.status, 400);
  assert.equal(r.json.message, FRIENDLY);
});

test('an oversized file is refused before it reaches Cloudinary, and nothing is stored', async () => {
  // The 21.5MB PDF from the field report (22519144 bytes).
  const r = await uploadLibrary(22519144);
  assert.equal(r.status, 400);
  assert.equal(r.json.message, FRIENDLY);
  assert.equal(cloudinaryUploads.length, 0, 'no bytes were sent to Cloudinary');
  assert.equal(inserts.length, 0, 'no library row was created');
});

test("Cloudinary's own size refusal is mapped to the same friendly 400, not a 500 with their wording", async () => {
  cloudinaryMode = 'too-large';
  const r = await uploadLibrary(1024); // under our cap, so only the Cloudinary mapping can catch it
  assert.equal(r.status, 400);
  assert.equal(r.json.message, FRIENDLY);
  assert.doesNotMatch(r.json.message, /Server error|Maximum is/);
  assert.equal(inserts.length, 0, 'no library row for a file that was not stored');
});

test('any other Cloudinary failure is still a 500 with the underlying text (behaviour unchanged)', async () => {
  cloudinaryMode = 'boom';
  const r = await uploadLibrary(1024);
  assert.equal(r.status, 500);
  assert.equal(r.json.message, 'Server error: Invalid cloud_name');
  assert.equal(inserts.length, 0);
});

test('libraryUploadFailure handles both error shapes Cloudinary uses, and never throws', () => {
  const tooLarge = 'File size too large. Got 22519144. Maximum is 10485760.';
  assert.deepEqual(libraryUploadFailure({ message: tooLarge }), { status: 400, message: FRIENDLY });
  assert.deepEqual(libraryUploadFailure({ error: { message: tooLarge } }), { status: 400, message: FRIENDLY });
  assert.deepEqual(libraryUploadFailure(new Error('FILE SIZE TOO LARGE')), { status: 400, message: FRIENDLY });
  assert.deepEqual(libraryUploadFailure(new Error('boom')), { status: 500, message: 'Server error: boom' });
  assert.deepEqual(libraryUploadFailure(undefined), { status: 500, message: 'Server error: ' });
  assert.deepEqual(libraryUploadFailure(null), { status: 500, message: 'Server error: ' });
});

test('the admin CSV routes keep their own 25MB cap (the library change must not lower them)', async () => {
  async function postCsv(bytes) {
    const fd = new FormData();
    fd.append('csv', new Blob([Buffer.alloc(bytes, 65)], { type: 'text/csv' }), 'rows.csv');
    const res = await fetch(`${base}/csv`, { method: 'POST', body: fd });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }
  // 13MB would be refused at the library's 10MB cap but is fine for a CSV.
  let r = await postCsv(13 * MB);
  assert.equal(r.status, 200);
  assert.equal(r.json.size, 13 * MB);

  r = await postCsv(26 * MB);
  assert.equal(r.status, 400);
  assert.equal(r.json.message, 'File exceeds the 25MB limit');
});

// The bug in the field report was a client and a server disagreeing about the cap.
// Web has no test runner, so this is the one automated guard that its constant and
// label stay in step with the server's. (Mobile still carries 25MB until its next
// build; add it here when that label changes.)
const webForm = path.join(__dirname, '..', '..', 'web', 'src', 'components', 'library', 'LibraryUploadForm.tsx');
test('the web upload form uses the same limit as the server', { skip: !fs.existsSync(webForm) && 'web/ is not present' }, () => {
  const src = fs.readFileSync(webForm, 'utf8');
  const constant = src.match(/const MAX_FILE_SIZE = (\d+) \* 1024 \* 1024;/);
  assert.ok(constant, 'MAX_FILE_SIZE constant not found in LibraryUploadForm.tsx');
  assert.equal(Number(constant[1]) * MB, LIBRARY_MAX_FILE_SIZE);

  const label = src.match(/File \* \(max (\d+)MB\)/);
  assert.ok(label, 'the "File * (max NMB)" label was not found');
  assert.equal(Number(label[1]) * MB, LIBRARY_MAX_FILE_SIZE);
});
