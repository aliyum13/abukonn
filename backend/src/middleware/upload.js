const multer = require('multer');

const allowedMimes = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  // Video uploads deferred to Phase 2 (mobile app)
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

module.exports = upload;
