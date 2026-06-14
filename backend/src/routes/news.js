const express = require('express');
const auth = require('../middleware/auth');
const { getNews, getNewsById, createNews } = require('../controllers/newsController');

const router = express.Router();

router.get('/', getNews);
router.get('/:id', getNewsById);
router.post('/', auth, createNews);

module.exports = router;
