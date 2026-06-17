const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const cloudinary = require('../config/cloudinary');

function uploadBufferToCloudinary(buffer, mimetype) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  return cloudinary.uploader.upload(dataUri, {
    folder: 'abukonn/profiles',
    resource_type: 'image',
  });
}

async function getProfile(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const posts = await Post.getPostsByUserId(req.user.id);

    // Own profile — include matric_number
    res.json({
      user: User.toPrivateUser(user),
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

    const [posts, stats, following] = await Promise.all([
      Post.getPostsByUserId(userId),
      Follow.getStats(userId),
      Follow.isFollowing(req.user.id, userId),
    ]);

    const publicUser = User.toPublicUser(user);

    // Expose matric_number only to the user themselves or admins
    const canSeeMatric = req.user.id === userId || req.user.is_admin;
    if (!canSeeMatric) {
      delete publicUser.matric_number;
    }

    res.json({
      user: {
        ...publicUser,
        followers_count: stats.followers_count,
        following_count: stats.following_count,
        is_following: following,
      },
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
      user: User.toPrivateUser(user),
    });
  } catch (err) {
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Server error updating profile' });
  }
}

async function uploadPhoto(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No photo provided' });
    }

    const result = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
    const user = await User.updateProfilePhoto(req.user.id, result.secure_url);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Photo uploaded successfully',
      user: User.toPrivateUser(user),
    });
  } catch (err) {
    console.error('Upload photo error:', err.message);
    res.status(500).json({ message: 'Server error uploading photo' });
  }
}

module.exports = { getProfile, getUserById, updateProfile, uploadPhoto };
