const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const upload = require('../middleware/upload');
const {
  listChannels, listMyChannels, getChannel, createUserChannel,
  joinChannel, leaveChannel, getChannelPosts, postToChannel,
  adminListChannels, adminCreateChannel, adminDeleteChannel,
} = require('../controllers/channelController');

const router = express.Router();

// Admin routes — before auth middleware to use adminAuth instead
router.get('/admin-list', adminAuth, adminListChannels);
router.post('/admin', adminAuth, adminCreateChannel);
router.delete('/admin/:id', adminAuth, adminDeleteChannel);

// User routes
router.use(auth);
router.get('/', listChannels);
router.get('/mine', listMyChannels);
router.post('/', createUserChannel);
router.get('/:slug', getChannel);
router.post('/:id/join', joinChannel);
router.delete('/:id/leave', leaveChannel);
router.get('/:id/posts', getChannelPosts);
router.post('/:id/posts', upload.single('image'), postToChannel);

module.exports = router;
