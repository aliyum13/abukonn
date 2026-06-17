const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');

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

    // Mark received messages as read silently
    Message.markConversationRead(conversationId, req.user.id).catch(() => {});

    res.json(data);
  } catch (err) {
    console.error('Get messages error:', err.message);
    res.status(500).json({ message: 'Server error fetching messages' });
  }
}

async function startConversation(req, res) {
  try {
    const { recipient_id } = req.body;
    if (!recipient_id) {
      return res.status(400).json({ message: 'recipient_id is required' });
    }
    const recipientId = parseInt(recipient_id, 10);
    if (recipientId === req.user.id) {
      return res.status(400).json({ message: 'Cannot message yourself' });
    }
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ message: 'User not found' });
    }
    const conversation = await Message.findOrCreateConversation(req.user.id, recipientId);
    res.json({
      conversation: {
        id: conversation.id,
        other_user_id: recipient.id,
        other_user_name: recipient.full_name,
        other_user_department: recipient.department,
        other_user_photo: recipient.profile_photo_url,
        last_message: null,
        last_message_at: null,
        unread_count: 0,
      },
    });
  } catch (err) {
    console.error('Start conversation error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUnreadCountHandler(req, res) {
  try {
    const count = await Message.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error('Get msg unread count error:', err.message);
    res.status(500).json({ message: 'Server error' });
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

    // Broadcast to all clients in the conversation room (real-time delivery)
    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${conversationId}`).emit('receive_message', message);
    }

    res.status(201).json({ message: 'Message sent', data: message, conversation_id: conversationId });
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ message: 'Server error sending message' });
  }
}

module.exports = { saveMessage, getConversations, getMessages, sendMessageHandler, startConversation, getUnreadCountHandler };
