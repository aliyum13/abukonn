const express = require('express');
const auth = require('../middleware/auth');
const { getNews, getNewsById, createNews, likeNewsHandler } = require('../controllers/newsController');

const router = express.Router();

// optionalAuth (not the required `auth`): news stays readable without login,
// same as before this change, but now decodes a token when one IS sent so
// is_liked reflects the real caller instead of always coming back false.
router.get('/', auth.optionalAuth, getNews);
router.get('/:id', auth.optionalAuth, getNewsById);
router.post('/', auth, createNews);
router.post('/:id/like', auth, likeNewsHandler);

module.exports = router;
