const express = require('express');
const auth = require('../middleware/auth');
const { getTrending, searchHashtags, getPostsByTag } = require('../controllers/hashtagController');

const router = express.Router();
router.use(auth);

// Static routes before param routes
router.get('/trending',  getTrending);
router.get('/search',    searchHashtags);
router.get('/:tag/posts', getPostsByTag);

module.exports = router;
