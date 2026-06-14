const express = require('express');
const auth = require('../middleware/auth');
const {
  getConversations,
  getMessages,
  sendMessageHandler,
} = require('../controllers/messageController');

const router = express.Router();

router.use(auth);

router.get('/conversations', getConversations);
router.get('/:conversationId', getMessages);
router.post('/', sendMessageHandler);

module.exports = router;
