const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Follow = require('../models/Follow');
const { isBlocked } = require('../models/ReportBlock');
const cloudinary = require('../config/cloudinary');
const pool = require('../config/db');
const { attachMedia } = require('./postController');
const ProfileView = require('../models/ProfileView');

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

    const posts = await Post.getPostsByUserId(req.user.id, req.user.id);
    await attachMedia(posts);
    const replies = await Comment.getCommentsByUser(req.user.id);
    const classRepFor = await require('../models/ClassRep').getClassRepsForUser(req.user.id);

    // Own profile — include matric_number
    res.json({
      user: User.toPrivateUser(user),
      posts,
      replies,
      class_rep_for: classRepFor,
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

    // If the viewer has blocked this user, or this user has blocked the viewer,
    // return 404 so neither party can stalk the other's profile.
    const [blockedThem, blockedByThem] = await Promise.all([
      isBlocked(req.user.id, userId),
      isBlocked(userId, req.user.id),
    ]);
    if (blockedThem || blockedByThem) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fire-and-forget: never let view-recording slow down or fail the
    // profile fetch itself. Recording happens for every visit regardless of
    // Pro status on either side (see ProfileView.recordView) -- only
    // reading the list back is gated.
    ProfileView.recordView(req.user.id, userId).catch(err =>
      console.error('Profile view recording error:', err.message)
    );

    const [posts, stats, following, replies, classRepFor] = await Promise.all([
      Post.getPostsByUserId(userId, req.user.id),
      Follow.getStats(userId),
      Follow.isFollowing(req.user.id, userId),
      Comment.getCommentsByUser(userId),
      require('../models/ClassRep').getClassRepsForUser(userId),
    ]);
    await attachMedia(posts);

    const publicUser = User.toPublicUser(user);

    res.json({
      user: {
        ...publicUser,
        followers_count: stats.followers_count,
        following_count: stats.following_count,
        is_following: following,
      },
      posts,
      replies,
      class_rep_for: classRepFor,
    });
  } catch (err) {
    console.error('Get user error:', err.message);
    res.status(500).json({ message: 'Server error fetching user' });
  }
}

// "Who viewed my profile" — Pro perk. Recording (ProfileView.recordView,
// called from getUserById above) happens for every visit regardless of
// Pro status; this endpoint, which READS the list back, is what's gated.
// PRO-GATE INSERTION POINT: once is_pro exists, add
//   if (!req.user.is_pro) return res.status(403).json({ message: 'Profile views is a Pro feature.' });
// right here. Left unenforced for now (Option A, matching every other Pro
// candidate) -- fully functional, not yet paywalled.
async function getProfileViewers(req, res) {
  try {
    // "Who viewed my profile" is a Pro feature (fresh-from-DB check).
    // Recording views still happens for everyone (see getUserById); only
    // reading the list back is gated.
    if (!(await User.isProFeatureUnlocked(req.user.id))) {
      return res.status(403).json({ message: 'Seeing who viewed your profile is a Pro feature.' });
    }
    const viewers = await ProfileView.getViewers(req.user.id);
    res.json({ viewers });
  } catch (err) {
    console.error('Get profile viewers error:', err.message);
    res.status(500).json({ message: 'Server error fetching profile viewers' });
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
    // Unique-constraint violation on username (users_username_unique) surfaces
    // as Postgres 23505. Return a friendly "taken" message instead of a
    // generic 500 -- benefits both web and mobile, which share this endpoint.
    if (err.code === '23505' && /username/i.test(err.constraint || err.detail || '')) {
      return res.status(409).json({ message: 'That username is already taken. Please choose another.' });
    }
    console.error('Update profile error:', err.message);
    res.status(500).json({ message: 'Server error updating profile' });
  }
}

async function uploadPhoto(req, res) {
  try {
    let photoUrl;

    // Mobile uploads the image straight to Cloudinary (to avoid Railway's
    // request timeout on large files) and sends just the resulting URL. Web
    // still posts the raw file as multipart. Support both.
    if (req.body?.photo_url) {
      photoUrl = req.body.photo_url;
    } else if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
      photoUrl = result.secure_url;
    } else {
      return res.status(400).json({ message: 'No photo provided' });
    }

    const user = await User.updateProfilePhoto(req.user.id, photoUrl);

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

async function searchForMention(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const term = `${q}%`;
    const { rows } = await pool.query(
      `SELECT id, username, full_name, profile_photo_url
       FROM abukonn.users
       WHERE (username ILIKE $1 OR full_name ILIKE $1)
         AND id != $2
         AND id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $2)
         AND id NOT IN (SELECT blocker_id FROM abukonn.blocks WHERE blocked_id = $2)
       ORDER BY
         CASE WHEN username ILIKE $1 THEN 0 ELSE 1 END,
         full_name
       LIMIT 8`,
      [term, req.user.id]
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('searchForMention error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function resolveUsername(req, res) {
  try {
    const username = req.params.username;
    const user = await User.findByUsername(username);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user.id });
  } catch (err) {
    console.error('resolveUsername error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Remove the profile photo entirely (revert to the default initials avatar),
// as distinct from replacing it with a different image. Sets the column to
// NULL; the clients' Avatar components already fall back to initials when
// src is null, so no display change is needed.
async function removePhoto(req, res) {
  try {
    const user = await User.updateProfilePhoto(req.user.id, null);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      message: 'Photo removed',
      user: User.toPrivateUser(user),
    });
  } catch (err) {
    console.error('Remove photo error:', err.message);
    res.status(500).json({ message: 'Server error removing photo' });
  }
}

module.exports = { getProfile, getUserById, updateProfile, uploadPhoto, removePhoto, getBirthdaysToday, searchForMention, resolveUsername, getProfileViewers };
