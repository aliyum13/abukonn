const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const uploadAny = require('../middleware/uploadAny');
const requireLibraryUploader = require('../middleware/requireLibraryUploader');
const { browse, getMaterial, upload, deleteMaterial, adminList, permissions } = require('../controllers/libraryController');

const router = express.Router();

router.get('/', auth, browse);
// Must stay above '/:id', or "permissions" is parsed as a material id.
router.get('/permissions', auth, permissions);
router.get('/admin/all', adminAuth, adminList);

// One upload path for everyone allowed to upload: full admins and Library
// Contributors. It uses `auth`, not adminAuth, because a contributor who isn't
// an admin could never get past adminAuth. /admin/upload is the old path, kept
// as an alias (same chain) so an already-open admin page keeps working.
const uploadChain = [auth, requireLibraryUploader, uploadAny.single('file'), uploadAny.handleUploadError, upload];
router.post('/upload', ...uploadChain);
router.post('/admin/upload', ...uploadChain);
// Deletion is unchanged here: still adminAuth, and not ownership-scoped.
router.delete('/admin/:id', adminAuth, deleteMaterial);
router.get('/:id', auth, getMaterial);

module.exports = router;
