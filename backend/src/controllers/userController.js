const User = require('../models/User');
const Post = require('../models/Post');

async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const posts = await Post.getPostsByUserId(req.user.id);

    res.json({
      user: User.toPublicUser(user),
      posts,
    });
  } catch (err) {
    console.error('Get profile error:', err.message);
    res.status(500).json({ message: 'Server error fetching profile' });
  }
}

async function getUserById(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const posts = await Post.getPostsByUserId(userId);

    res.json({
      user: User.toPublicUser(user),
      posts,
    });
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ message: 'Server error fetching user' });
  }
}

async function updateProfile(req, res) {
  try {
    const { bio, department, level } = req.body;

    const user = await User.updateProfile(req.user.id, { bio, department, level });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile updated',
      user: User.toPublicUser(user),
    });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Server error updating profile' });
  }
}

async function uploadPhoto(req, res) {
  res.json({
    message: 'Photo upload coming soon',
    profile_photo_url: 'https://via.placeholder.com/150/16a34a/ffffff?text=ABU',
  });
}

module.exports = { getProfile, getUserById, updateProfile, uploadPhoto };
