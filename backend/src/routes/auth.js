const express = require('express');
const { register, login } = require('../controllers/authController');
const { forgotPassword, verifyOtp, resetPassword } = require('../controllers/passwordResetController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
