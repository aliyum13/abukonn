const express = require('express');
const auth = require('../middleware/auth');
const { registerToken, unregisterToken } = require('../lib/push');

const router = express.Router();
router.use(auth);

// The phone sends its Expo push token after login.
router.post('/register', async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    const ok = await registerToken(req.user.id, token, platform);
    if (!ok) return res.status(400).json({ message: 'Invalid push token' });
    res.json({ registered: true });
  } catch (err) {
    console.error('Register push token error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// On logout, so a signed-out phone stops receiving this user's notifications.
router.post('/unregister', async (req, res) => {
  try {
    await unregisterToken(req.body?.token);
    res.json({ unregistered: true });
  } catch (err) {
    console.error('Unregister push token error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
