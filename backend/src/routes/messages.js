const express = require('express');
const auth = require('../middleware/auth');
const {
  getConversations,
  getMessages,
  sendMessageHandler,
  startConversation,
  getUnreadCountHandler,
} = require('../controllers/messageController');

const router = express.Router();

router.use(auth);

// Static routes must come before /:conversationId
router.get('/conversations', getConversations);
router.get('/unread-count', getUnreadCountHandler);
router.post('/start', startConversation);
router.get('/:conversationId', getMessages);
router.post('/', sendMessageHandler);

module.exports = router;
