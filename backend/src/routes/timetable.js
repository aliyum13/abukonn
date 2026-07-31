const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const uploadAny = require('../middleware/uploadAny');
const {
  getTodayClasses, getWeekClasses, getTimetableByDeptLevel,
  uploadTimetable, deleteTimetable, getUploads, previewCSV,
  updateClass, addClass, deleteClass, setClassStatus, bulkCancelClasses,
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

// Bulk status update: cancel every class across a date range + scope in one
// action, instead of editing each class individually.
router.post('/admin/bulk-cancel', adminAuth, bulkCancelClasses);

// Individual class CRUD (admin)
router.post('/admin/class', adminAuth, addClass);
router.put('/admin/class/:id', adminAuth, updateClass);
router.patch('/admin/class/:id/status', adminAuth, setClassStatus);
router.delete('/admin/class/:id', adminAuth, deleteClass);

// Dynamic route LAST
router.get('/:department/:level', auth, getTimetableByDeptLevel);

module.exports = router;

