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

// News
router.get('/news', adminGetAllNews);
router.post('/news', upload.single('image'), verifyFileSignature, adminCreateNews);
router.put('/news/:id', upload.single('image'), verifyFileSignature, adminUpdateNews);
router.delete('/news/:id', adminDeleteNews);

// Whitelist
router.get('/whitelist', getWhitelist);
router.post('/whitelist/upload', uploadAny.single('csv'), uploadWhitelist);
router.delete('/whitelist', clearWhitelist);

// Diagnostic: report the raw file_url + file_name for every document row so we
// can see exactly why the repair is skipping files.
router.get('/repair-file-extensions-diagnose', async (req, res) => {
  try {
    const pool = require('../config/db');
    const tables = [
      { table: 'library_materials' },
      { table: 'messages' },
      { table: 'group_messages' },
    ];
    const out = {};
    for (const t of tables) {
      const { rows } = await pool.query(
        `SELECT id, file_url, file_name FROM abukonn.${t.table} WHERE file_url IS NOT NULL`
      );
      out[t.table] = rows;
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
