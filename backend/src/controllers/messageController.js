const Message = require('../models/Message');
const User = require('../models/User');

async function saveMessage(conversationId, senderId, content) {
  if (!content || !content.trim()) {
    throw new Error('Message content is required');
  }

  const conversation = await Message.getConversationById(conversationId, senderId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const message = await Message.sendMessage({
    conversationId,
    senderId,
    content: content.trim(),
  });

  const sender = await User.findById(senderId);

  return {
    ...message,
    sender_name: sender.full_name,
  };
}

async function getConversations(req, res) {
  try {
    const conversations = await Message.getConversations(req.user.id);
    res.json({ conversations });
  } catch (err) {
    console.error('Get conversations error:', err.message);
    res.status(500).json({ message: 'Server error fetching conversations' });
  }
}

async function getMessages(req, res) {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const data = await Message.getMessages(conversationId, req.user.id);

    if (!data) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('Get messages error:', err.message);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
}

async function sendMessageHandler(req, res) {
  try {
    const { recipient_id, conversation_id, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    let conversationId = conversation_id;

    if (!conversationId && recipient_id) {
      const recipient = await User.findById(recipient_id);
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
      }
      if (recipient.id === req.user.id) {
        return res.status(400).json({ message: 'Cannot message yourself' });
      }

      const conversation = await Message.findOrCreateConversation(req.user.id, recipient.id);
      conversationId = conversation.id;
    }

    if (!conversationId) {
      return res.status(400).json({ message: 'recipient_id or conversation_id is required' });
    }

    const conversation = await Message.getConversationById(conversationId, req.user.id);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const message = await saveMessage(conversationId, req.user.id, content);

    res.status(201).json({ message: 'Message sent', data: message, conversation_id: conversationId });
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ message: 'Server error sending message' });
  }
}

module.exports = { saveMessage, getConversations, getMessages, sendMessageHandler };
