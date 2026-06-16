const Follow = require('../models/Follow');

async function follow(req, res) {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId, 10);

    if (followerId === followingId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    await Follow.followUser(followerId, followingId);
    const stats = await Follow.getStats(followingId);
    res.json({ message: 'Followed successfully', ...stats });
  } catch (err) {
    console.error('Follow error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function unfollow(req, res) {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId, 10);

    await Follow.unfollowUser(followerId, followingId);
    const stats = await Follow.getStats(followingId);
    res.json({ message: 'Unfollowed successfully', ...stats });
  } catch (err) {
    console.error('Unfollow error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getStats(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const stats = await Follow.getStats(userId);
    res.json(stats);
  } catch (err) {
    console.error('Stats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function checkIsFollowing(req, res) {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId, 10);
    const result = await Follow.isFollowing(followerId, followingId);
    res.json({ is_following: result });
  } catch (err) {
    console.error('Check follow error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUserFollowers(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const followers = await Follow.getFollowers(userId);
    res.json({ followers });
  } catch (err) {
    console.error('Get followers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUserFollowing(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const following = await Follow.getFollowing(userId);
    res.json({ following });
  } catch (err) {
    console.error('Get following error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMyFollowers(req, res) {
  try {
    const followers = await Follow.getFollowers(req.user.id);
    res.json({ followers });
  } catch (err) {
    console.error('Get my followers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMyFollowing(req, res) {
  try {
    const following = await Follow.getFollowing(req.user.id);
    res.json({ following });
  } catch (err) {
    console.error('Get my following error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getSuggestions(req, res) {
  try {
    const suggestions = await Follow.getSuggestions(req.user.id, 5);
    res.json({ suggestions });
  } catch (err) {
    console.error('Get suggestions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  follow,
  unfollow,
  getStats,
  checkIsFollowing,
  getUserFollowers,
  getUserFollowing,
  getMyFollowers,
  getMyFollowing,
  getSuggestions,
};
