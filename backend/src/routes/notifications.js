const express = require('express');
const auth = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
} = require('../controllers/notificationController');

const router = express.Router();
router.use(auth);

// Static routes must come before /:id to prevent conflicts
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllRead);
router.get('/', getNotifications);
router.patch('/:id/read', markOneRead);

module.exports = router;
