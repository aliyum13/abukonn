const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { initializePayment, verifyPayment, getProStatus } = require('../controllers/proController');

// All authed. The webhook is NOT here -- it's mounted separately in index.js
// with express.raw + no auth (Paystack calls it directly, signature-verified).
router.post('/subscribe', auth, initializePayment);
router.get('/verify/:reference', auth, verifyPayment);
router.get('/status', auth, getProStatus);

module.exports = router;
