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
const { createUsersTable } = require('./models/User');
const { createPostsTable, createPostLikesTable } = require('./models/Post');
const { createCommentsTable } = require('./models/Comment');
const { createNewsTable } = require('./models/News');
const { createMessagesTables } = require('./models/Message');
const { createWhitelistTable } = require('./models/Whitelist');
const { createFollowsTable } = require('./models/Follow');
const { createNotificationsTable } = require('./models/Notification');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3001',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_conversation', (conversationId) => {
    socket.join(`conversation_${conversationId}`);
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

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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
  .then(() => {
    server.listen(PORT, () => {
      console.log(`ABUkonn server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err.message);
    process.exit(1);
  });

module.exports = { app, server, io };