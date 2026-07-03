const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const {
  getCalendar, getSessions, addEntry, updateEntry, deleteEntry, deleteSession,
} = require('../controllers/academicCalendarController');

const router = express.Router();

// Student-facing
router.get('/', auth, getCalendar);
router.get('/sessions', auth, getSessions);

// Admin
router.post('/admin/entry', adminAuth, addEntry);
router.put('/admin/entry/:id', adminAuth, updateEntry);
router.delete('/admin/entry/:id', adminAuth, deleteEntry);
router.delete('/admin/session/:session', adminAuth, deleteSession);

module.exports = router;
