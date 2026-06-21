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
    const { bio, department, level, username, full_name, date_of_birth } = req.body;

    if (username !== undefined && username !== null && username !== '') {
      if (!/^[a-zA-Z0-9_]{1,30}$/.test(username)) {
        return res.status(400).json({ message: 'Username may only contain letters, numbers, and underscores (max 30 characters).' });
      }
    }

    const dateOfBirth = date_of_birth ? date_of_birth : null;
    const user = await User.updateProfile(req.user.id, { bio, department, level, username, full_name, dateOfBirth });

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

async function getBirthdaysToday(req, res) {
  try {
    const users = await User.getBirthdayUsers(req.user.id);
    const me = await User.findById(req.user.id);
    let isMyBirthday = false;
    if (me?.date_of_birth) {
      const dob = new Date(me.date_of_birth);
      const now = new Date();
      isMyBirthday = dob.getUTCMonth() === now.getUTCMonth() && dob.getUTCDate() === now.getUTCDate();
    }
    res.json({ users, is_my_birthday: isMyBirthday });
  } catch (err) {
    console.error('getBirthdaysToday:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getProfile, getUserById, updateProfile, uploadPhoto, getBirthdaysToday };
