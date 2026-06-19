const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { createStory, getStories, deleteStory, reactToStory, getReactionsHandler, replyToStory, getStoryRepliesHandler } = require('../controllers/storyController');

const router = express.Router();
router.use(auth);

router.get('/', getStories);
router.post('/', upload.single('media'), createStory);
router.delete('/:id', deleteStory);
router.post('/:id/react', reactToStory);
router.get('/:id/reactions', getReactionsHandler);
router.post('/:id/reply', replyToStory);
router.get('/:id/replies', getStoryRepliesHandler);

module.exports = router;
