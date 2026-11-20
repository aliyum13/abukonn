const express = require('express');
const auth = require('../middleware/auth');
const requireMediaTeam = require('../middleware/requireMediaTeam');
const { getNews, getNewsById, createNews, likeNewsHandler, getUnreadNewsCount, markNewsSeen, getNewsPermissions } = require('../controllers/newsController');

const router = express.Router();

// optionalAuth (not the required `auth`): news stays readable without login,
// same as before this change, but now decodes a token when one IS sent so
// is_liked reflects the real caller instead of always coming back false.
router.get('/', auth.optionalAuth, getNews);
// Must stay above '/:id', or "unread-count" / "permissions" are parsed as an article id.
router.get('/unread-count', auth, getUnreadNewsCount);
router.get('/permissions', auth, getNewsPermissions);
router.post('/seen', auth, markNewsSeen);
router.get('/:id', auth.optionalAuth, getNewsById);
router.post('/', auth, requireMediaTeam, createNews);
router.post('/:id/like', auth, likeNewsHandler);
// Edit / delete: a full admin (any article) or the Media Team member who published it. The
// gate runs before anything else, so a refused request never reaches the handler.
const requireNewsManage = require('../middleware/requireNewsManage');
const { updateNewsHandler, deleteNewsHandler } = require('../controllers/newsManageController');
router.put('/:id', auth, requireNewsManage, updateNewsHandler);
router.delete('/:id', auth, requireNewsManage, deleteNewsHandler);

module.exports = router;
