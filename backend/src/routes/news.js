const express = require('express');
const auth = require('../middleware/auth');
const requireMediaTeam = require('../middleware/requireMediaTeam');
const { getNews, getNewsById, createNews, likeNewsHandler, getUnreadNewsCount, markNewsSeen } = require('../controllers/newsController');

const router = express.Router();

// optionalAuth (not the required `auth`): news stays readable without login,
// same as before this change, but now decodes a token when one IS sent so
// is_liked reflects the real caller instead of always coming back false.
router.get('/', auth.optionalAuth, getNews);
// Must stay above '/:id', or "unread-count" is parsed as an article id.
router.get('/unread-count', auth, getUnreadNewsCount);
router.post('/seen', auth, markNewsSeen);
router.get('/:id', auth.optionalAuth, getNewsById);
router.post('/', auth, requireMediaTeam, createNews);
router.post('/:id/like', auth, likeNewsHandler);

module.exports = router;
