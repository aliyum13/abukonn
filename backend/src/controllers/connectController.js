const {
  sendRequest,
  cancelRequest,
  acceptRequest,
  declineRequest,
  getIncomingRequests,
  getOutgoingRequests,
  getConnections,
  getConnectionStatus,
  removeConnection,
} = require('../models/Connect');
const { createNotification } = require('../models/Notification');

// POST /api/connect/:userId  — send a connect request
async function sendConnectRequest(req, res) {
  try {
    const senderId = req.user.id;
    const receiverId = parseInt(req.params.userId, 10);
    if (senderId === receiverId) return res.status(400).json({ message: 'Cannot connect with yourself' });

    const request = await sendRequest(senderId, receiverId);
    // Notify receiver
    await createNotification({ recipientId: receiverId, senderId, type: 'connect_request' }).catch(() => {});
    return res.status(201).json({ message: 'Connect request sent', request });
  } catch (err) {
    console.error('sendConnectRequest:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// DELETE /api/connect/:userId  — cancel/withdraw my pending request
async function cancelConnectRequest(req, res) {
  try {
    const senderId = req.user.id;
    const receiverId = parseInt(req.params.userId, 10);
    await cancelRequest(senderId, receiverId);
    return res.json({ message: 'Request cancelled' });
  } catch (err) {
    console.error('cancelConnectRequest:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PATCH /api/connect/:requestId/accept
async function acceptConnectRequest(req, res) {
  try {
    const receiverId = req.user.id;
    const requestId = parseInt(req.params.requestId, 10);
    const result = await acceptRequest(requestId, receiverId);
    if (!result) return res.status(404).json({ message: 'Request not found or already handled' });
    // Notify sender that request was accepted
    await createNotification({ recipientId: result.sender_id, senderId: receiverId, type: 'connect_accepted' }).catch(() => {});
    return res.json({ message: 'Connected!', request: result });
  } catch (err) {
    console.error('acceptConnectRequest:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// PATCH /api/connect/:requestId/decline
async function declineConnectRequest(req, res) {
  try {
    const receiverId = req.user.id;
    const requestId = parseInt(req.params.requestId, 10);
    const result = await declineRequest(requestId, receiverId);
    if (!result) return res.status(404).json({ message: 'Request not found' });
    return res.json({ message: 'Request declined' });
  } catch (err) {
    console.error('declineConnectRequest:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/connect/requests/incoming
async function getIncoming(req, res) {
  try {
    const requests = await getIncomingRequests(req.user.id);
    return res.json({ requests });
  } catch (err) {
    console.error('getIncoming:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/connect/requests/outgoing
async function getOutgoing(req, res) {
  try {
    const requests = await getOutgoingRequests(req.user.id);
    return res.json({ requests });
  } catch (err) {
    console.error('getOutgoing:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/connect/connections
async function listConnections(req, res) {
  try {
    const connections = await getConnections(req.user.id);
    return res.json({ connections });
  } catch (err) {
    console.error('listConnections:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/connect/:userId/status
async function getStatus(req, res) {
  try {
    const viewerId = req.user.id;
    const targetId = parseInt(req.params.userId, 10);
    const status = await getConnectionStatus(viewerId, targetId);
    return res.json(status);
  } catch (err) {
    console.error('getStatus:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/connect/requests/incoming/count
async function getIncomingCount(req, res) {
  try {
    const requests = await getIncomingRequests(req.user.id);
    return res.json({ count: requests.length });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
}

// DELETE /api/connect/:userId/remove — disconnect two users
async function disconnectUser(req, res) {
  try {
    const userId = req.user.id;
    const targetId = parseInt(req.params.userId, 10);
    await removeConnection(userId, targetId);
    return res.json({ message: 'Disconnected' });
  } catch (err) {
    console.error('disconnectUser:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
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
};
