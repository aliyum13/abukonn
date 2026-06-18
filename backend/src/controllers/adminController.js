const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const News = require('../models/News');
const Whitelist = require('../models/Whitelist');
const { updateRole } = require('../models/User');

// ─── Stats ────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const [users, posts, news, today] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM abukonn.users'),
      pool.query('SELECT COUNT(*) FROM abukonn.posts'),
      pool.query('SELECT COUNT(*) FROM abukonn.news'),
      pool.query(
        `SELECT COUNT(DISTINCT user_id) FROM abukonn.posts
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      ),
    ]);

    res.json({
      totalUsers: parseInt(users.rows[0].count, 10),
      totalPosts: parseInt(posts.rows[0].count, 10),
      totalNews: parseInt(news.rows[0].count, 10),
      activeToday: parseInt(today.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function getUsers(req, res) {
  try {
    const { search = '', page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = search
      ? `WHERE u.full_name ILIKE $1 OR u.matric_number ILIKE $1`
      : '';
    const params = search ? [`%${search}%`, parseInt(limit, 10), offset] : [parseInt(limit, 10), offset];

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM abukonn.users u ${where}`,
      search ? [`%${search}%`] : []
    );

    const usersResult = await pool.query(
      `SELECT u.id, u.matric_number, u.full_name, u.email, u.department, u.level,
              u.profile_photo_url, u.is_admin, COALESCE(u.role, 'user') AS role, u.created_at,
              COUNT(p.id) AS post_count
       FROM abukonn.users u
       LEFT JOIN abukonn.posts p ON p.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}`,
      params
    );

    res.json({
      users: usersResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  } catch (err) {
    console.error('Admin get users error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getRecentUsers(req, res) {
  try {
    const result = await pool.query(
      `SELECT id, matric_number, full_name, email, department, level, is_admin, created_at
       FROM abukonn.users
       ORDER BY created_at DESC
       LIMIT 10`
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('Admin recent users error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteUser(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const result = await pool.query(
      'DELETE FROM abukonn.users WHERE id = $1 RETURNING id, full_name',
      [userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: `User "${result.rows[0].full_name}" deleted` });
  } catch (err) {
    console.error('Admin delete user error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function toggleAdmin(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);

    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own admin status' });
    }

    const result = await pool.query(
      `UPDATE abukonn.users
       SET is_admin = NOT is_admin
       WHERE id = $1
       RETURNING id, full_name, is_admin`,
      [userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { full_name, is_admin } = result.rows[0];
    res.json({
      message: `${full_name} is ${is_admin ? 'now an admin' : 'no longer an admin'}`,
      is_admin,
    });
  } catch (err) {
    console.error('Admin toggle admin error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── News ─────────────────────────────────────────────────────────────────────

async function adminGetAllNews(req, res) {
  try {
    const result = await pool.query(
      `SELECT n.*, u.full_name AS author_name
       FROM abukonn.news n
       LEFT JOIN abukonn.users u ON n.created_by = u.id
       ORDER BY n.created_at DESC`
    );
    res.json({ news: result.rows });
  } catch (err) {
    console.error('Admin get news error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function adminCreateNews(req, res) {
  try {
    const { title, content, category } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ message: 'Title, content, and category are required' });
    }

    const validCategories = ['academic', 'sports', 'events', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    let imageUrl = null;
    if (req.file) {
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploaded = await cloudinary.uploader.upload(dataUri, {
        folder: 'abukonn/news',
        resource_type: 'image',
      });
      imageUrl = uploaded.secure_url;
    }

    const article = await News.createNews({
      title,
      content,
      category,
      imageUrl,
      createdBy: req.user.id,
    });

    res.status(201).json({ message: 'News created', article });
  } catch (err) {
    console.error('Admin create news error:', err.message);
    res.status(500).json({ message: 'Server error creating news' });
  }
}

async function adminUpdateNews(req, res) {
  try {
    const newsId = parseInt(req.params.id, 10);
    const { title, content, category } = req.body;

    const validCategories = ['academic', 'sports', 'events', 'general'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    let imageUrl = undefined;
    if (req.file) {
      const dataUri = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      const uploaded = await cloudinary.uploader.upload(dataUri, {
        folder: 'abukonn/news',
        resource_type: 'image',
      });
      imageUrl = uploaded.secure_url;
    }

    const setClauses = [];
    const params = [];
    let i = 1;

    if (title) { setClauses.push(`title = $${i++}`); params.push(title); }
    if (content) { setClauses.push(`content = $${i++}`); params.push(content); }
    if (category) { setClauses.push(`category = $${i++}`); params.push(category); }
    if (imageUrl !== undefined) { setClauses.push(`image_url = $${i++}`); params.push(imageUrl); }

    if (!setClauses.length) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    params.push(newsId);
    const result = await pool.query(
      `UPDATE abukonn.news SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
      params
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ message: 'Article updated', article: result.rows[0] });
  } catch (err) {
    console.error('Admin update news error:', err.message);
    res.status(500).json({ message: 'Server error updating news' });
  }
}

async function adminDeleteNews(req, res) {
  try {
    const newsId = parseInt(req.params.id, 10);
    const result = await pool.query(
      'DELETE FROM abukonn.news WHERE id = $1 RETURNING id, title',
      [newsId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ message: `Article "${result.rows[0].title}" deleted` });
  } catch (err) {
    console.error('Admin delete news error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── Whitelist ────────────────────────────────────────────────────────────────

async function getWhitelist(req, res) {
  try {
    const { page = '1' } = req.query;
    const [count, entries] = await Promise.all([
      Whitelist.getCount(),
      Whitelist.getAll({ page: parseInt(page, 10) }),
    ]);
    res.json({ count, entries });
  } catch (err) {
    console.error('Admin get whitelist error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function uploadWhitelist(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file provided' });
    }

    const csv = req.file.buffer.toString('utf-8');
    const lines = csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    // Accept: lines starting with a matric-like pattern, or strip header row
    const matricNumbers = lines
      .filter((l) => /^[A-Za-z]{2}\d{2}\/[A-Za-z]+\/\d+$/.test(l) || /^\S+$/.test(l))
      .map((l) => l.split(',')[0].trim().toUpperCase())
      .filter((m) => m.length > 0 && m !== 'MATRIC_NUMBER' && m !== 'MATRIC' && m !== 'MATRIC NUMBER');

    if (!matricNumbers.length) {
      return res.status(400).json({ message: 'No valid matric numbers found in CSV' });
    }

    const inserted = await Whitelist.bulkInsert(matricNumbers);
    const total = await Whitelist.getCount();

    res.json({
      message: `${inserted} new matric numbers added (${matricNumbers.length - inserted} duplicates skipped)`,
      inserted,
      parsed: matricNumbers.length,
      total,
    });
  } catch (err) {
    console.error('Admin upload whitelist error:', err.message);
    res.status(500).json({ message: 'Server error processing CSV' });
  }
}

async function clearWhitelist(req, res) {
  try {
    await Whitelist.clearAll();
    res.json({ message: 'Whitelist cleared' });
  } catch (err) {
    console.error('Admin clear whitelist error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function setUserRole(req, res) {
  try {
    const VALID = ['user', 'verified', 'bod', 'influencer', 'admin'];
    const { role } = req.body;
    if (!role || !VALID.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const updated = await updateRole(parseInt(req.params.id, 10), role);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    // Also sync is_admin boolean
    await pool.query(
      `UPDATE abukonn.users SET is_admin = $2 WHERE id = $1`,
      [updated.id, role === 'admin']
    );
    return res.json({ message: 'Role updated', user: updated });
  } catch (err) {
    console.error('setUserRole:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getStats,
  getUsers,
  getRecentUsers,
  deleteUser,
  toggleAdmin,
  setUserRole,
  adminGetAllNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
  getWhitelist,
  uploadWhitelist,
  clearWhitelist,
};
