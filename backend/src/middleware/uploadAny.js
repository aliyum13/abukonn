const multer = require('multer');
const path = require('path');

// Used for admin-only CSV (whitelist/timetable/academic-calendar) and document
// (library) uploads.
// Previously had no file-type restriction whatsoever — anyone with a
// compromised or careless admin session could've uploaded any file type.
const allowedMimes = [
  'text/csv', 'application/vnd.ms-excel', 'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Extension fallback for the MIME check below -- mobile browsers (Android in
// particular) often fail to report a real MIME type for Office documents,
// especially files that arrived via Drive/WhatsApp/USB without clean
// metadata: the OS content resolver falls back to application/octet-stream
// (or reports nothing at all) instead of the correct type. A strict
// MIME-only whitelist rejects those legitimate files outright, which is why
// Word/PowerPoint uploads were failing on Android while PDF (whose MIME is
// reported consistently everywhere) worked fine.
const allowedExtensions = ['.csv', '.txt', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      return cb(null, true);
    }
    const ext = path.extname(file.originalname || '').toLowerCase();
    if ((!file.mimetype || file.mimetype === 'application/octet-stream') && allowedExtensions.includes(ext)) {
      return cb(null, true);
    }
    const err = new Error('Unsupported file type. Allowed: CSV, PDF, Word, PowerPoint, Excel.');
    err.code = 'UNSUPPORTED_FILE_TYPE';
    cb(err, false);
  },
});

// Multer (and our own fileFilter above) report problems by calling next(err)
// rather than sending a response -- that error skips straight past the route
// handler to the first error-handling middleware in the chain. Without one,
// it fell through to Express's default handler, which doesn't return the
// { message } JSON shape the frontend expects, so every rejection (wrong
// type or too large) showed up as an unhelpful generic failure instead of
// the real reason.
function handleUploadError(err, _req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: `File exceeds the ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` });
  }
  if (err.code === 'UNSUPPORTED_FILE_TYPE') {
    return res.status(400).json({ message: err.message });
  }
  return res.status(400).json({ message: err.message || 'Upload failed' });
}

module.exports = uploadAny;
module.exports.handleUploadError = handleUploadError;
module.exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
