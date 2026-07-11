const Follow = require('../models/Follow');
const Notification = require('../models/Notification');
const { emitNotification } = require('../lib/notify');
const User = require('../models/User');
const { departmentsInSameFaculty, facultyForDepartment } = require('../lib/departments');

async function follow(req, res) {
  try {
    const followerId = req.user.id;
    const followingId = parseInt(req.params.userId, 10);

    if (followerId === followingId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    await Follow.followUser(followerId, followingId);
    const stats = await Follow.getStats(followingId);

    // Notify the followed user
    Notification.createNotification({
      recipientId: followingId,
      senderId: followerId,
      type: 'follow',
    })
      .then(() => emitNotification(req.app, followingId))
      .catch(() => {});

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
    const followers = await Follow.getFollowers(userId, req.user.id);
    res.json({ followers });
  } catch (err) {
    console.error('Get followers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getUserFollowing(req, res) {
  try {
    const userId = parseInt(req.params.userId, 10);
    const following = await Follow.getFollowing(userId, req.user.id);
    res.json({ following });
  } catch (err) {
    console.error('Get following error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMyFollowers(req, res) {
  try {
    const followers = await Follow.getFollowers(req.user.id, req.user.id);
    res.json({ followers });
  } catch (err) {
    console.error('Get my followers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMyFollowing(req, res) {
  try {
    const following = await Follow.getFollowing(req.user.id, req.user.id);
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

// Discover People — returns people to follow, grouped into prioritised
// sections: your department, your faculty, admins, content creators, verified
// users, then everyone else. Each person appears in only the first section
// they qualify for (de-duplicated across sections).
async function discover(req, res) {
  try {
    const me = await User.findById(req.user.id);
    const myDept = me?.department || null;
    const facultyDepts = departmentsInSameFaculty(myDept);
    const facultyName = facultyForDepartment(myDept);

    const seen = new Set([req.user.id]);
    const take = (rows) => {
      const out = [];
      for (const r of rows) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(r);
      }
      return out;
    };

    // 1. Same department
    const department = myDept
      ? take(await Follow.discoverSection(req.user.id, 'u.department = $2', [myDept], 20))
      : [];

    // 2. Same faculty (other departments in the faculty)
    let faculty = [];
    if (facultyDepts.length > 0) {
      const placeholders = facultyDepts.map((_, i) => `$${i + 2}`).join(',');
      faculty = take(
        await Follow.discoverSection(req.user.id, `u.department IN (${placeholders})`, facultyDepts, 20)
      );
    }

    // 3. Admins
    const admins = take(await Follow.discoverSection(req.user.id, 'u.is_admin = TRUE', [], 20));

    // 4. Content creators
    const creators = take(await Follow.discoverSection(req.user.id, 'u.is_content_creator = TRUE', [], 20));

    // 5. Verified users
    const verified = take(await Follow.discoverSection(req.user.id, 'u.is_verified = TRUE', [], 20));

    // 6. Everyone else
    const others = take(await Follow.discoverSection(req.user.id, 'TRUE', [], 30));

    res.json({
      faculty_name: facultyName,
      department_name: myDept,
      sections: [
        { key: 'department', title: myDept ? `From ${myDept}` : 'Your department', people: department },
        { key: 'faculty', title: facultyName || 'Your faculty', people: faculty },
        { key: 'admins', title: 'Admins', people: admins },
        { key: 'creators', title: 'Content creators', people: creators },
        { key: 'verified', title: 'Verified users', people: verified },
        { key: 'others', title: 'More people across ABU', people: others },
      ].filter((s) => s.people.length > 0),
    });
  } catch (err) {
    console.error('Discover error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Search people by name/username.
async function search(req, res) {
  try {
    const q = (req.query.q || '').toString().trim();
    if (q.length < 2) return res.json({ results: [] });
    const results = await Follow.searchPeople(req.user.id, q, 30);
    res.json({ results });
  } catch (err) {
    console.error('People search error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Toggle the notification bell for someone you follow. You must already
// follow them (the bell lives on the follow relationship).
async function setNotifications(req, res) {
  try {
    const followingId = parseInt(req.params.userId, 10);
    const { enabled } = req.body;
    const result = await Follow.setNotifyOnPost(req.user.id, followingId, enabled);
    if (result === null) {
      return res.status(400).json({ message: 'Follow this person first to turn on notifications' });
    }
    res.json({ notify_on_post: result });
  } catch (err) {
    console.error('setNotifications error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Is the bell on for this person?
async function getNotifications(req, res) {
  try {
    const followingId = parseInt(req.params.userId, 10);
    const on = await Follow.getNotifyOnPost(req.user.id, followingId);
    res.json({ notify_on_post: on });
  } catch (err) {
    console.error('getNotifications error:', err.message);
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
  discover,
  search,
  setNotifications,
  getNotifications,
};
