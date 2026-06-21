const Notification = require('../models/Notification');

async function getNotifications(req, res) {
  try {
    const notifications = await Notification.getGroupedNotifications(req.user.id);
    res.json({ notifications });
  } catch (err) {
    console.error('Get notifications error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await Notification.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error('Get unread count error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function markAllRead(req, res) {
  try {
    await Notification.markAllRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Mark all read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function markOneRead(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await Notification.markOneRead(id, req.user.id);
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Mark one read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function markManyRead(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'ids must be a non-empty array' });
    }
    await Notification.markManyRead(ids.map(Number), req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark many read error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getNotifications, getUnreadCount, markAllRead, markOneRead, markManyRead };
