const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const uploadAny = require('../middleware/uploadAny');
const {
  getCalendar, getSessions, addEntry, updateEntry, deleteEntry, deleteSession, previewCSV, uploadCSV,
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
router.post('/admin/preview', adminAuth, uploadAny.single('csv'), previewCSV);
router.post('/admin/upload', adminAuth, uploadAny.single('csv'), uploadCSV);

module.exports = router;
