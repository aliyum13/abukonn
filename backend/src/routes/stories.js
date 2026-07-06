const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../middleware/verifyFileSignature');
const { getUploadSignature, createStory, getStories, getMyStories, deleteStory, reactToStory, getReactionsHandler, replyToStory, getStoryRepliesHandler, recordView, getViewersHandler } = require('../controllers/storyController');

const router = express.Router();
router.use(auth);

router.get('/', getStories);
router.get('/mine', getMyStories);
router.get('/upload-signature', getUploadSignature);
router.post('/', upload.single('media'), verifyFileSignature, createStory);
router.delete('/:id', deleteStory);
router.post('/:id/react', reactToStory);
router.get('/:id/reactions', getReactionsHandler);
router.post('/:id/view', recordView);
router.post('/:id/reply', replyToStory);
router.get('/:id/replies', getStoryRepliesHandler);
router.get('/:id/viewers', getViewersHandler);

module.exports = router;
