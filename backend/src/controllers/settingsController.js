const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserSettings = require('../models/UserSettings');

async function getSettings(req, res) {
  try {
    const [user, settingsRow] = await Promise.all([
      User.findById(req.user.id),
      UserSettings.getOrCreate(req.user.id),
    ]);
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      user: User.toPrivateUser(user),
      settings: UserSettings.toClientSettings(settingsRow),
    });
  } catch (err) {
    console.error('getSettings:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateSettings(req, res) {
  try {
    const row = await UserSettings.update(req.user.id, req.body);
    res.json({
      message: 'Settings updated',
      settings: UserSettings.toClientSettings(row),
    });
  } catch (err) {
    if (err.message.startsWith('Invalid value')) {
      return res.status(400).json({ message: err.message });
    }
    console.error('updateSettings:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({ message: 'All password fields are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    const user = await User.findByIdWithPassword(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(current_password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await User.updatePassword(req.user.id, hash);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('changePassword:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function changeEmail(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const user = await User.findByIdWithPassword(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    const existing = await User.findByEmail(email.toLowerCase().trim());
    if (existing && existing.id !== req.user.id) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const updated = await User.updateEmail(req.user.id, email.toLowerCase().trim());
    res.json({
      message: 'Email updated successfully',
      user: User.toPrivateUser(updated),
    });
  } catch (err) {
    console.error('changeEmail:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deactivateAccount(req, res) {
  try {
    await UserSettings.setDeactivated(req.user.id, true);
    res.json({ message: 'Account deactivated. You can reactivate by logging in again.' });
  } catch (err) {
    console.error('deactivateAccount:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteAccount(req, res) {
  try {
    const { confirmation } = req.body;
    if (confirmation !== 'DELETE') {
      return res.status(400).json({ message: 'Type DELETE to confirm account deletion' });
    }
    await User.deleteById(req.user.id);
    res.json({ message: 'Account deleted permanently' });
  } catch (err) {
    console.error('deleteAccount:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getSettings,
  updateSettings,
  changePassword,
  changeEmail,
  deactivateAccount,
  deleteAccount,
};
