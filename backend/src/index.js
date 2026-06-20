require('dotenv').config();
require('./config/db');

const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const postRoutes = require('./routes/posts');
const userRoutes = require('./routes/users');
const newsRoutes = require('./routes/news');
const messageRoutes = require('./routes/messages');
const searchRoutes = require('./routes/search');
const followRoutes = require('./routes/follows');
const { saveMessage } = require('./controllers/messageController');
const { markConversationRead } = require('./models/Message');
const { createUsersTable } = require('./models/User');
const { createPostsTable, createPostLikesTable } = require('./models/Post');
const { createCommentsTable } = require('./models/Comment');
const { createNewsTable } = require('./models/News');
const { createMessagesTables } = require('./models/Message');
const { createWhitelistTable } = require('./models/Whitelist');
const { createFollowsTable } = require('./models/Follow');
const { createNotificationsTable } = require('./models/Notification');
const { createGroupTables } = require('./models/Group');
const { createRepliesTable } = require('./models/Reply');
const { createStoriesTable, createStoryViewsTable, createStoryReactionsTable, createStoryRepliesTable } = require('./models/Story');
const { createConnectTables } = require('./models/Connect');
const { createHashtagTables } = require('./models/Hashtag');
const { createUserSettingsTable } = require('./models/UserSettings');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const groupRoutes = require('./routes/groups');
const storyRoutes = require('./routes/stories');
const connectRoutes = require('./routes/connect');
const hashtagRoutes = require('./routes/hashtags');
const settingsRoutes = require('./routes/settings');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3001',
    methods: ['GET', 'POST'],
  },
});

// Make io accessible from route controllers
app.set('io', io);

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

io.on('connection', (socket) => {
  // ── Presence ────────────────────────────────────────────────────────
  socket.on('user_online', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const uid = decoded.id;
      socket.data.userId = uid;
      if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
      onlineUsers.get(uid).add(socket.id);
      socket.broadcast.emit('user_status', { userId: uid, online: true });
    } catch {
      // invalid token — ignore
    }
  });

  socket.on('get_online_status', (userIds, callback) => {
    if (typeof callback !== 'function') return;
    const statuses = (userIds || []).map((id) => ({
      userId: id,
      online: onlineUsers.has(id),
    }));
    callback(statuses);
  });

  // ── Conversations ────────────────────────────────────────────────────
  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
  });

  socket.on('join_group', (groupId) => {
    socket.join(`group_${groupId}`);
  });

  socket.on('send_message', async ({ conversationId, content, token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const message = await saveMessage(conversationId, decoded.id, content);
      io.to(`conversation_${conversationId}`).emit('receive_message', message);
    } catch (err) {
      console.error('Socket send_message error:', err.message);
      socket.emit('error_message', { message: err.message });
    }
  });

  // ── Typing indicators ────────────────────────────────────────────────
  socket.on('typing_start', ({ conversationId, token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket
        .to(`conversation_${conversationId}`)
        .emit('user_typing', { conversationId, userId: decoded.id });
    } catch {
      // ignore
    }
  });

  socket.on('typing_stop', ({ conversationId, token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket
        .to(`conversation_${conversationId}`)
        .emit('user_stopped_typing', { conversationId, userId: decoded.id });
    } catch {
      // ignore
    }
  });

  // ── Read receipts ────────────────────────────────────────────────────
  socket.on('mark_read', async ({ conversationId, token }) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await markConversationRead(conversationId, decoded.id);
      socket
        .to(`conversation_${conversationId}`)
        .emit('messages_read', { conversationId });
    } catch {
      // ignore
    }
  });

  socket.on('disconnect', () => {
    const uid = socket.data?.userId;
    if (uid) {
      const sockets = onlineUsers.get(uid);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          onlineUsers.delete(uid);
          socket.broadcast.emit('user_status', { userId: uid, online: false });
        }
      }
    }
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/follows', followRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/connect', connectRoutes);
app.use('/api/hashtags', hashtagRoutes);
app.use('/api/settings', settingsRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'ABUkonn API is running!' });
});

const PORT = process.env.PORT || 3000;

createUsersTable()
  .then(() => createPostsTable())
  .then(() => createCommentsTable())
  .then(() => createNewsTable())
  .then(() => createMessagesTables())
  .then(() => createWhitelistTable())
  .then(() => createFollowsTable())
  .then(() => createPostLikesTable())
  .then(() => createNotificationsTable())
  .then(() => createGroupTables())
  .then(() => createRepliesTable())
  .then(() => createStoriesTable())
  .then(() => createStoryViewsTable())
  .then(() => createStoryReactionsTable())
  .then(() => createStoryRepliesTable())
  .then(() => createConnectTables())
  .then(() => createHashtagTables())
  .then(() => createUserSettingsTable())
  .then(() => {
    server.timeout = 120000;
    server.keepAliveTimeout = 120000;
    server.listen(PORT, () => {
      console.log(`ABUkonn server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });

module.exports = { app, server, io };