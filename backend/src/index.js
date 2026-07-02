require('dotenv').config();
require('./config/db');

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
const { markConversationRead, getConversationById } = require('./models/Message');
const { isMember: isGroupMember } = require('./models/Group');
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
const { createHighlightsTable } = require('./models/Highlight');
const { createChannelTables } = require('./models/Channel');
const { createPasswordResetsTable } = require('./models/PasswordReset');
const { createTimetableTable } = require('./models/Timetable');
const { createSupportTable } = require('./models/Support');
const { createLibraryTable } = require('./models/Library');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const groupRoutes = require('./routes/groups');
const storyRoutes = require('./routes/stories');
const connectRoutes = require('./routes/connect');
const hashtagRoutes = require('./routes/hashtags');
const settingsRoutes = require('./routes/settings');
const highlightRoutes = require('./routes/highlights');
const { createReportBlockTables } = require('./models/ReportBlock');

const app = express();
const server = http.createServer(app);

// Known-good production origins are always allowed, regardless of whether
// CLIENT_URL is set correctly on the host — this is what abukonn.com
// actually is, so it should never depend on an env var being configured
// right to keep working. CLIENT_URL can still add extra origins
// (staging, www, etc.) on top of these via a comma-separated list.
const PRODUCTION_ORIGINS = ['https://abukonn.com', 'https://www.abukonn.com'];
const envOrigins = (process.env.CLIENT_URL || 'http://localhost:3001')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...PRODUCTION_ORIGINS, ...envOrigins])];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Require a valid JWT before a socket connection is allowed at all.
// Without this, anyone could open a websocket and call join_conversation /
// join_group with a guessed ID to silently receive other people's messages.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

// Make io accessible from route controllers
app.set('io', io);

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

io.on('connection', (socket) => {
  // socket.data.userId is set and verified by the io.use() auth middleware above.
  const uid = socket.data.userId;
  if (!onlineUsers.has(uid)) onlineUsers.set(uid, new Set());
  onlineUsers.get(uid).add(socket.id);
  socket.broadcast.emit('user_status', { userId: uid, online: true });

  // ── Presence ────────────────────────────────────────────────────────
  socket.on('get_online_status', (userIds, callback) => {
    if (typeof callback !== 'function') return;
    const statuses = (userIds || []).map((id) => ({
      userId: id,
      online: onlineUsers.has(id),
    }));
    callback(statuses);
  });

  // ── Conversations ────────────────────────────────────────────────────
  // Verify the connected user is actually a participant before letting them
  // join the room — otherwise anyone could guess a conversation/group ID and
  // silently receive every message broadcast to it.
  socket.on('join_conversation', async (conversationId) => {
    try {
      const conversation = await getConversationById(conversationId, socket.data.userId);
      if (!conversation) return;
      socket.join(`conversation_${conversationId}`);
    } catch (err) {
      console.error('Socket join_conversation error:', err.message);
    }
  });

  socket.on('join_group', async (groupId) => {
    try {
      const member = await isGroupMember(groupId, socket.data.userId);
      if (!member) return;
      socket.join(`group_${groupId}`);
    } catch (err) {
      console.error('Socket join_group error:', err.message);
    }
  });

  socket.on('send_message', async ({ conversationId, content }) => {
    try {
      const message = await saveMessage(conversationId, socket.data.userId, content);
      io.to(`conversation_${conversationId}`).emit('receive_message', message);
    } catch (err) {
      console.error('Socket send_message error:', err.message);
      socket.emit('error_message', { message: err.message });
    }
  });

  // ── Typing indicators ────────────────────────────────────────────────
  socket.on('typing_start', ({ conversationId }) => {
    socket
      .to(`conversation_${conversationId}`)
      .emit('user_typing', { conversationId, userId: socket.data.userId });
  });

  socket.on('typing_stop', ({ conversationId }) => {
    socket
      .to(`conversation_${conversationId}`)
      .emit('user_stopped_typing', { conversationId, userId: socket.data.userId });
  });

  // ── Read receipts ────────────────────────────────────────────────────
  socket.on('mark_read', async ({ conversationId }) => {
    try {
      await markConversationRead(conversationId, socket.data.userId);
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
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — a sane default ceiling on the whole API, with a much
// stricter limit on auth endpoints (login/register/password-reset) since
// those are the ones worth protecting against brute force.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again shortly.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again in a few minutes.' },
});

app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
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
app.use('/api/highlights', highlightRoutes);
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/support', require('./routes/support'));
app.use('/api/library', require('./routes/library'));
app.use('/api/moderation', require('./routes/moderation'));

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
  .then(() => createHighlightsTable())
  .then(() => createChannelTables())
  .then(() => createPasswordResetsTable())
  .then(() => createTimetableTable())
  .then(() => createSupportTable())
  .then(() => createLibraryTable())
  .then(() => createReportBlockTables())
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


