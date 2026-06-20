const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { listHighlights, adminListHighlights, createHighlightHandler, updateHighlightHandler, deleteHighlightHandler } = require('../controllers/highlightController');

const router = express.Router();

router.get('/', auth, listHighlights);
router.get('/all', adminAuth, adminListHighlights);
router.post('/', adminAuth, createHighlightHandler);
router.put('/:id', adminAuth, updateHighlightHandler);
router.delete('/:id', adminAuth, deleteHighlightHandler);

module.exports = router;
