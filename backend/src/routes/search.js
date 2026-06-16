const express = require('express');
const auth = require('../middleware/auth');
const { search } = require('../controllers/searchController');

const router = express.Router();

router.use(auth);
router.get('/', search);

module.exports = router;
