const Message = require('../models/Message');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushToUsers } = require('../lib/push');
const { isBlocked } = require('../models/ReportBlock');
const cloudinary = require('../config/cloudinary');

async function saveMessage(conversationId, senderId, content, imageUrl = null, fileUrl = null, fileName = null, fileSize = null) {
  if (!content?.trim() && !imageUrl && !fileUrl) {
    throw new Error('Message content is required');
  }

  const conversation = await Message.getConversationById(conversationId, senderId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  const message = await Message.sendMessage({
    conversationId,
    senderId,
    content: content?.trim() || '',
    imageUrl,
    fileUrl,
    fileName,
    fileSize,
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

    const [blockedThem, blockedByThem] = await Promise.all([
      isBlocked(req.user.id, recipientId),
      isBlocked(recipientId, req.user.id),
    ]);
    if (blockedThem || blockedByThem) {
      return res.status(403).json({ message: 'You cannot message this user.' });
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
    const { recipient_id, conversation_id, content, image_url, file_url, file_name, file_size } = req.body;

    if (!content?.trim() && !image_url && !file_url) {
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

    const message = await saveMessage(conversationId, req.user.id, content || '', image_url || null, file_url || null, file_name || null, file_size || null);

    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${conversationId}`).emit('receive_message', message);
    }

    // Push the message to the recipient's phone. Until now a DM only reached
    // someone whose app was OPEN on that conversation — close the app and it
    // arrived silently. An unanswered message is the strongest reason anyone
    // reopens an app, so this is the notification that matters most.
    const recipientId =
      conversation.user1_id === req.user.id ? conversation.user2_id : conversation.user1_id;

    if (recipientId) {
      const preview = (content || '').trim();
      sendPushToUsers([recipientId], {
        title: 'ABUkonn',
        body: preview
          ? `{name}: ${preview.length > 80 ? preview.slice(0, 80) + '…' : preview}`
          : '{name} sent you a message',
        senderId: req.user.id,
        data: { type: 'conversation', conversationId },
      }).catch(() => {});
    }

    res.status(201).json({ message: 'Message sent', data: message, conversation_id: conversationId });
  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ message: 'Server error sending message' });
  }
}

async function uploadMessageImage(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image provided' });
    const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'abukonn/messages',
      resource_type: 'image',
    });
    res.json({ url: result.secure_url });
  } catch (err) {
    console.error('Upload message image error:', err.message);
    res.status(500).json({ message: 'Image upload failed' });
  }
}

async function deleteMessageHandler(req, res) {
  try {
    const messageId = parseInt(req.params.id, 10);
    if (!messageId) return res.status(400).json({ message: 'Invalid message id' });

    const result = await Message.deleteMessage(messageId, req.user.id);

    if (result.error === 'not_found') {
      return res.status(404).json({ message: 'Message not found' });
    }
    if (result.error === 'forbidden') {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }
    if (result.error === 'already_deleted') {
      return res.json({ message: 'Message already deleted', data: result.message });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`conversation_${result.message.conversation_id}`).emit('message_deleted', {
        messageId: result.message.id,
        conversationId: result.message.conversation_id,
      });
    }

    res.json({ message: 'Message deleted', data: result.message });
  } catch (err) {
    console.error('Delete message error:', err.message);
    res.status(500).json({ message: 'Server error deleting message' });
  }
}

module.exports = { saveMessage, getConversations, getMessages, sendMessageHandler, startConversation, getUnreadCountHandler, uploadMessageImage, deleteMessageHandler };
