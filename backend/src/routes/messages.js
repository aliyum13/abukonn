const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../middleware/verifyFileSignature');
const {
  getConversations,
  getMessages,
  sendMessageHandler,
  startConversation,
  getUnreadCountHandler,
  uploadMessageImage,
  deleteMessageHandler,
} = require('../controllers/messageController');

const router = express.Router();

router.use(auth);

// Static routes must come before /:conversationId
router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCountHandler);
router.post('/start', startConversation);
router.post('/upload-image', upload.single('image'), verifyFileSignature, uploadMessageImage);
router.delete('/:id', deleteMessageHandler);
router.get('/:conversationId', getMessages);
router.post('/', sendMessageHandler);

module.exports = router;
