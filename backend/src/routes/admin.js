const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const uploadAny = require('../middleware/uploadAny');
const { verifyFileSignature } = require('../middleware/verifyFileSignature');
const {
  getStats,
  getUsers,
  getRecentUsers,
  deleteUser,
  toggleAdmin,
  setUserRole,
  setUserVerified,
  setUserContentCreator,
  listClassReps,
  assignClassRep,
  removeClassRep,
  adminGetAllNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
  getWhitelist,
  uploadWhitelist,
  clearWhitelist,
} = require('../controllers/adminController');

const router = express.Router();

router.use(adminAuth);

// Stats
router.get('/stats', getStats);

// Users
router.get('/users', getUsers);
router.get('/users/recent', getRecentUsers);
router.delete('/users/:id', deleteUser);
router.patch('/users/:id/toggle-admin', toggleAdmin);
router.patch('/users/:id/role', setUserRole);
router.patch('/users/:id/verified', setUserVerified);
router.patch('/users/:id/content-creator', setUserContentCreator);
router.get('/class-reps', listClassReps);
router.post('/class-reps', assignClassRep);
router.delete('/class-reps/:id', removeClassRep);

// News
router.get('/news', adminGetAllNews);
router.post('/news', upload.single('image'), verifyFileSignature, adminCreateNews);
router.put('/news/:id', upload.single('image'), verifyFileSignature, adminUpdateNews);
router.delete('/news/:id', adminDeleteNews);

// Whitelist
router.get('/whitelist', getWhitelist);
router.post('/whitelist/upload', uploadAny.single('csv'), uploadWhitelist);
router.delete('/whitelist', clearWhitelist);

// PRE-LAUNCH: wipe all test content (posts, stories, messages, groups, etc.)
// while keeping users, settings, academic calendar, timetable, and news.
// Requires an explicit confirmation phrase in the body so it can't fire by
// accident. Destructive and irreversible.
router.post('/reset-launch-data', async (req, res) => {
  try {
    if (req.body?.confirm !== 'WIPE ABUKONN TEST DATA') {
      return res.status(400).json({
        message: 'Confirmation required. Send { "confirm": "WIPE ABUKONN TEST DATA" } to proceed.',
      });
    }
    const pool = require('../config/db');
    const { resetLaunchData } = require('../../scripts/reset-launch-data');
    const result = await resetLaunchData(pool);
    res.json({ message: 'Test data wiped. Users and config preserved.', ...result });
  } catch (err) {
    console.error('reset-launch-data error:', err.message);
    res.status(500).json({ message: 'Reset failed', error: err.message });
  }
});

// One-time maintenance: fix documents uploaded before the extension-
// preservation fix (they were stored with no file extension, so browsers
// and the document viewer can't render them and fall back to a raw
// download prompt). Safe to run repeatedly — already-correct rows are
// skipped automatically.
router.post('/repair-file-extensions', async (req, res) => {
  try {
    const pool = require('../config/db');
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const { repairAll } = require('../../scripts/fix-file-extensions');
    const results = await repairAll(pool, cloudinary);
    res.json({ message: 'Repair complete', results });
  } catch (err) {
    console.error('repair-file-extensions error:', err.message);
    res.status(500).json({ message: 'Repair failed', error: err.message });
  }
});

module.exports = router;
