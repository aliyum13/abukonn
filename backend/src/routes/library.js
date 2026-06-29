const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const uploadAny = require('../middleware/uploadAny');
const { browse, getMaterial, upload, deleteMaterial, adminList } = require('../controllers/libraryController');

const router = express.Router();

router.get('/', auth, browse);
router.get('/admin/all', adminAuth, adminList);
router.post('/admin/upload', adminAuth, uploadAny.single('file'), upload);
router.delete('/admin/:id', adminAuth, deleteMaterial);
router.get('/:id', auth, getMaterial);

module.exports = router;
