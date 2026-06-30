const multer = require('multer');

// Used for admin-only CSV (whitelist/timetable) and document (library) uploads.
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

const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Allowed: CSV, PDF, Word, PowerPoint, Excel.'), false);
    }
  },
});

module.exports = uploadAny;
