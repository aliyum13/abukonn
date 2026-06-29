const express = require('express');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { submitTicket, getTickets, updateTicket } = require('../controllers/supportController');

const router = express.Router();

router.post('/', auth, submitTicket);
router.get('/admin', adminAuth, getTickets);
router.patch('/admin/:id', adminAuth, updateTicket);

module.exports = router;
