const express = require('express');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getSettings,
  updateSettings,
  changePassword,
  changeEmail,
  deactivateAccount,
  deleteAccount,
} = require('../controllers/settingsController');
const { updateProfile, uploadPhoto } = require('../controllers/userController');

const router = express.Router();
router.use(auth);

router.get('/', getSettings);
router.patch('/', updateSettings);
router.patch('/password', changePassword);
router.patch('/email', changeEmail);
router.patch('/profile', updateProfile);
router.post('/photo', upload.single('photo'), uploadPhoto);
router.post('/deactivate', deactivateAccount);
router.delete('/account', deleteAccount);

module.exports = router;
