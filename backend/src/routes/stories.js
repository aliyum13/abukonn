const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createStory, getStories, deleteStory } = require('../controllers/storyController');

const router = express.Router();
router.use(auth);

router.get('/', getStories);
router.post('/', upload.single('media'), createStory);
router.delete('/:id', deleteStory);

module.exports = router;
