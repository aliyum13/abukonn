const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const uploadAny = require('../middleware/uploadAny');
const {
  getTodayClasses, getWeekClasses, getTimetableByDeptLevel,
  uploadTimetable, deleteTimetable, getUploads, previewCSV,
} = require('../controllers/timetableController');

const router = express.Router();

// Static routes FIRST (before dynamic /:department/:level)
router.get('/today', auth, getTodayClasses);
router.get('/week', auth, getWeekClasses);

// Admin routes BEFORE dynamic route
router.get('/admin/uploads', adminAuth, getUploads);
router.post('/admin/upload', adminAuth, uploadAny.single('csv'), uploadTimetable);
router.post('/admin/preview', adminAuth, uploadAny.single('csv'), previewCSV);
router.delete('/admin/:department/:level', adminAuth, deleteTimetable);

// Dynamic route LAST
router.get('/:department/:level', auth, getTimetableByDeptLevel);

module.exports = router;
