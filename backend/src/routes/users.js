const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getProfile, getUserById, updateProfile, uploadPhoto } = require('../controllers/userController');

const router = express.Router();

router.use(auth);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.post('/me/photo', upload.single('photo'), uploadPhoto);
router.get('/:id', getUserById);

module.exports = router;
