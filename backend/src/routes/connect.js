const express = require('express');
const auth = require('../middleware/auth');
const {
  sendConnectRequest,
  cancelConnectRequest,
  acceptConnectRequest,
  declineConnectRequest,
  getIncoming,
  getOutgoing,
  listConnections,
  getStatus,
  getIncomingCount,
  disconnectUser,
} = require('../controllers/connectController');

const router = express.Router();
router.use(auth);

// Static routes first to avoid /:param conflicts
router.get('/requests/incoming',       getIncoming);
router.get('/requests/incoming/count', getIncomingCount);
router.get('/requests/outgoing',       getOutgoing);
router.get('/connections',             listConnections);

// Request lifecycle
router.post('/:userId',              sendConnectRequest);
router.delete('/:userId',            cancelConnectRequest);
router.delete('/:userId/remove',     disconnectUser);
router.patch('/:requestId/accept',   acceptConnectRequest);
router.patch('/:requestId/decline',  declineConnectRequest);

// Status check
router.get('/:userId/status',        getStatus);

module.exports = router;
