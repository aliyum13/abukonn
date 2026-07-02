const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const {
  reportPost,
  reportUser,
  blockUser,
  unblockUser,
  getBlockList,
  getBlockStatus,
  adminGetReports,
  adminResolveReport,
} = require('../controllers/reportBlockController');

const router = express.Router();

// ── User-facing ───────────────────────────────────────────────────────────────
router.use(auth);

router.post('/report/post/:id', reportPost);
router.post('/report/user/:id', reportUser);
router.post('/block/:id', blockUser);
router.delete('/block/:id', unblockUser);
router.get('/blocks', getBlockList);
router.get('/block-status/:id', getBlockStatus);

// ── Admin-only ────────────────────────────────────────────────────────────────
router.get('/admin/reports', adminAuth, adminGetReports);
router.patch('/admin/reports/:id', adminAuth, adminResolveReport);

module.exports = router;
