const express = require('express');
const auth = require('../middleware/auth');
const {
  follow,
  unfollow,
  getStats,
  checkIsFollowing,
  getUserFollowers,
  getUserFollowing,
  getMyFollowers,
  getMyFollowing,
  getSuggestions,
} = require('../controllers/followController');

const router = express.Router();
router.use(auth);

// Static routes must come before /:userId to avoid conflicts
router.get('/suggestions', getSuggestions);
router.get('/followers', getMyFollowers);
router.get('/following', getMyFollowing);

// Dynamic routes
router.post('/:userId', follow);
router.delete('/:userId', unfollow);
router.get('/:userId/stats', getStats);
router.get('/:userId/is-following', checkIsFollowing);
router.get('/:userId/followers', getUserFollowers);
router.get('/:userId/following', getUserFollowing);

module.exports = router;
