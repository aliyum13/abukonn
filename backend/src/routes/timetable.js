const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const uploadAny = require('../middleware/uploadAny');
const {
  getTodayClasses, getWeekClasses, getTimetableByDeptLevel,
  uploadTimetable, deleteTimetable, getUploads, previewCSV,
  updateClass, addClass, deleteClass,
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

// Individual class CRUD (admin)
router.post('/admin/class', adminAuth, addClass);
router.put('/admin/class/:id', adminAuth, updateClass);
router.delete('/admin/class/:id', adminAuth, deleteClass);

// Dynamic route LAST
router.get('/:department/:level', auth, getTimetableByDeptLevel);

module.exports = router;

