const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const uploadAny = require('../middleware/uploadAny');
const {
  getStats,
  getUsers,
  getRecentUsers,
  deleteUser,
  toggleAdmin,
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

// News
router.get('/news', adminGetAllNews);
router.post('/news', upload.single('image'), adminCreateNews);
router.put('/news/:id', upload.single('image'), adminUpdateNews);
router.delete('/news/:id', adminDeleteNews);

// Whitelist
router.get('/whitelist', getWhitelist);
router.post('/whitelist/upload', uploadAny.single('csv'), uploadWhitelist);
router.delete('/whitelist', clearWhitelist);

module.exports = router;
