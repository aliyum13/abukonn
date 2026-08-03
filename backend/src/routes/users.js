const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { verifyFileSignature } = require('../middleware/verifyFileSignature');
const { getProfile, getUserById, updateProfile, uploadPhoto, removePhoto, getBirthdaysToday, searchForMention, resolveUsername, getProfileViewers } = require('../controllers/userController');

const router = express.Router();

// Public: resolving a username to an id powers shareable profile links
// (abukonn.com/@name). A logged-out visitor clicking a shared link must be able
// to resolve it before being sent to login. Only returns an id — no user data.
router.get('/username/:username', resolveUsername);

router.use(auth);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.post('/me/photo', upload.single('photo'), verifyFileSignature, uploadPhoto);
router.delete('/me/photo', removePhoto);
router.get('/birthdays/today', getBirthdaysToday);
router.get('/mention-search', searchForMention);
router.get('/me/profile-viewers', getProfileViewers);
router.get('/:id', getUserById);

module.exports = router;
