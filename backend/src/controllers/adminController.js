const pool = require('../config/db');
const cloudinary = require('../config/cloudinary');
const News = require('../models/News');
const Whitelist = require('../models/Whitelist');
const { updateRole, setVerified, setContentCreator } = require('../models/User');
const ClassRep = require('../models/ClassRep');
const { VALID_ROLE_TYPES, getRolesForUser, grantRole, revokeRole } = require('../models/UserRole');

// ─── Stats ────────────────────────────────────────────────────────────────────

async function getStats(req, res) {
  try {
    const [users, posts, news, activeDay, activeMonth, postersDay] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM abukonn.users'),
      pool.query('SELECT COUNT(*) FROM abukonn.posts'),
      pool.query('SELECT COUNT(*) FROM abukonn.news'),
      // Real activity: anyone who made an authenticated request in the window,
      // not just people who posted. last_active is stamped by the auth middleware.
      pool.query(
        `SELECT COUNT(*) FROM abukonn.users
         WHERE last_active >= NOW() - INTERVAL '24 hours'`
      ),
      pool.query(
        `SELECT COUNT(*) FROM abukonn.users
         WHERE last_active >= NOW() - INTERVAL '30 days'`
      ),
      // Kept as a separate signal: distinct users who actually POSTED in 24h.
      // Useful next to activeToday — the gap shows the lurker-to-poster ratio.
      pool.query(
        `SELECT COUNT(DISTINCT user_id) FROM abukonn.posts
         WHERE created_at >= NOW() - INTERVAL '24 hours'`
      ),
    ]);

    const getOnlineCount = req.app.get('getOnlineCount');
    const onlineNow = typeof getOnlineCount === 'function' ? getOnlineCount() : null;

    res.json({
      totalUsers: parseInt(users.rows[0].count, 10),
      totalPosts: parseInt(posts.rows[0].count, 10),
      totalNews: parseInt(news.rows[0].count, 10),
      // activeToday now means "opened/used the app in 24h" (real DAU), not "posted".
      activeToday: parseInt(activeDay.rows[0].count, 10),
      activeThisMonth: parseInt(activeMonth.rows[0].count, 10),
      postersToday: parseInt(postersDay.rows[0].count, 10),
      onlineNow,
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function getUsers(req, res) {
  try {
    const { search = '', page = '1', limit = '20', holds_role = '' } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    // Filters are collected as (condition, param) pairs so search and the
    // capability-role filter can combine; the limit/offset placeholders are
    // numbered after however many filter params there ended up being.
    const conditions = [];
    const filterParams = [];
    if (search) {
      filterParams.push(`%${search}%`);
      conditions.push(`(u.full_name ILIKE $${filterParams.length} OR u.email ILIKE $${filterParams.length})`);
    }
    if (holds_role) {
      if (!VALID_ROLE_TYPES.includes(holds_role)) {
        return res.status(400).json({ message: `Invalid holds_role. Use one of: ${VALID_ROLE_TYPES.join(', ')}` });
      }
      filterParams.push(holds_role);
      conditions.push(
        `EXISTS (SELECT 1 FROM abukonn.user_roles ur WHERE ur.user_id = u.id AND ur.role_type = $${filterParams.length})`
      );
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const n = filterParams.length;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM abukonn.users u ${where}`,
      filterParams
    );

    const usersResult = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.department, u.level,
              u.profile_photo_url, u.is_admin, COALESCE(u.role, 'user') AS role,
              COALESCE(u.is_verified, FALSE) AS is_verified,
              COALESCE(u.is_content_creator, FALSE) AS is_content_creator,
              COALESCE(
                (SELECT array_agg(ur.role_type ORDER BY ur.role_type)
                 FROM abukonn.user_roles ur WHERE ur.user_id = u.id),
                '{}'
              ) AS roles,
              u.created_at,
              COUNT(p.id) AS post_count
       FROM abukonn.users u
       LEFT JOIN abukonn.posts p ON p.user_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $${n + 1} OFFSET $${n + 2}`,
      [...filterParams, parseInt(limit, 10), offset]
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
      `SELECT id, full_name, email, department, level, is_admin, created_at
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
    const VALID = ['user', 'verified', 'bod', 'influencer', 'class_coordinator', 'editor', 'admin'];
    // Roles that get access to the admin panel (scoped by role on the frontend)
    const ADMIN_PANEL_ROLES = ['admin', 'class_coordinator', 'editor'];
    const { role } = req.body;
    if (!role || !VALID.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const updated = await updateRole(parseInt(req.params.id, 10), role);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    // Sync is_admin so admin-panel roles can reach /admin (scoping of WHAT they
    // see is handled per-role on the frontend).
    await pool.query(
      `UPDATE abukonn.users SET is_admin = $2 WHERE id = $1`,
      [updated.id, ADMIN_PANEL_ROLES.includes(role)]
    );
    return res.json({ message: 'Role updated', user: updated });
  } catch (err) {
    console.error('setUserRole:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// ─── Capability roles (media_team / library_contributor) ─────────────────────
// Independent of users.role above: these are separate capabilities a user can
// hold in any combination. All three handlers sit behind router.use(adminAuth).

// Resolves :id and confirms the user exists, so a bad id is a clean 400/404
// rather than an FK-violation 500 on grant. Sends the error response itself
// and returns null when the request can't proceed.
async function resolveRoleTarget(req, res) {
  const userId = parseInt(req.params.id, 10);
  if (!Number.isInteger(userId)) {
    res.status(400).json({ message: 'Invalid user id' });
    return null;
  }
  const { rows } = await pool.query('SELECT 1 FROM abukonn.users WHERE id = $1', [userId]);
  if (rows.length === 0) {
    res.status(404).json({ message: 'User not found' });
    return null;
  }
  return userId;
}

function roleTypeError(roleType) {
  return `Invalid role_type "${roleType}". Use one of: ${VALID_ROLE_TYPES.join(', ')}`;
}

async function getUserRoles(req, res) {
  try {
    const userId = await resolveRoleTarget(req, res);
    if (userId === null) return;
    return res.json({ roles: await getRolesForUser(userId) });
  } catch (err) {
    console.error('getUserRoles:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Idempotent: granting a role the user already holds succeeds and changes
// nothing. The response carries the user's full role list so the client can
// sync to server truth instead of trusting its own local toggle state.
async function grantUserRole(req, res) {
  try {
    const { role_type: roleType } = req.body || {};
    if (!VALID_ROLE_TYPES.includes(roleType)) {
      return res.status(400).json({ message: roleTypeError(roleType) });
    }
    const userId = await resolveRoleTarget(req, res);
    if (userId === null) return;
    // req.user.id is the acting admin (set by adminAuth), recorded as granted_by.
    await grantRole(userId, roleType, req.user.id);
    return res.json({ message: 'Role granted', roles: await getRolesForUser(userId) });
  } catch (err) {
    console.error('grantUserRole:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Idempotent, same as grant.
async function revokeUserRole(req, res) {
  try {
    const roleType = req.params.role_type;
    if (!VALID_ROLE_TYPES.includes(roleType)) {
      return res.status(400).json({ message: roleTypeError(roleType) });
    }
    const userId = await resolveRoleTarget(req, res);
    if (userId === null) return;
    await revokeRole(userId, roleType);
    return res.json({ message: 'Role revoked', roles: await getRolesForUser(userId) });
  } catch (err) {
    console.error('revokeUserRole:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Toggle the verified badge on a user (independent of their role).
async function setUserVerified(req, res) {
  try {
    const { verified } = req.body;
    const updated = await setVerified(parseInt(req.params.id, 10), !!verified);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    return res.json({ message: verified ? 'User verified' : 'Verification removed', user: updated });
  } catch (err) {
    console.error('setUserVerified:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// Toggle the content-creator badge on a user.
async function setUserContentCreator(req, res) {
  try {
    const { is_content_creator } = req.body;
    const updated = await setContentCreator(parseInt(req.params.id, 10), !!is_content_creator);
    if (!updated) return res.status(404).json({ message: 'User not found' });
    return res.json({ message: is_content_creator ? 'Marked as content creator' : 'Content creator removed', user: updated });
  } catch (err) {
    console.error('setUserContentCreator:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// ── Class representatives (admin management) ────────────────────────────────

async function listClassReps(req, res) {
  try {
    const reps = await ClassRep.getAllClassReps();
    res.json({ reps });
  } catch (err) {
    console.error('listClassReps:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function assignClassRep(req, res) {
  try {
    const { user_id, department, level } = req.body;
    if (!user_id || !department || !level) {
      return res.status(400).json({ message: 'user_id, department and level are required' });
    }
    const rep = await ClassRep.assignClassRep(user_id, department, level, req.user.id);
    if (!rep) return res.status(409).json({ message: 'Already a class rep for this class' });
    res.status(201).json({ rep });
  } catch (err) {
    console.error('assignClassRep:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function removeClassRep(req, res) {
  try {
    const removed = await ClassRep.removeClassRep(parseInt(req.params.id, 10));
    if (!removed) return res.status(404).json({ message: 'Assignment not found' });
    res.json({ ok: true });
  } catch (err) {
    console.error('removeClassRep:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getStats,
  getUsers,
  getRecentUsers,
  deleteUser,
  toggleAdmin,
  setUserRole,
  getUserRoles,
  grantUserRole,
  revokeUserRole,
  setUserVerified,
  setUserContentCreator,
  adminGetAllNews,
  adminCreateNews,
  adminUpdateNews,
  adminDeleteNews,
  getWhitelist,
  uploadWhitelist,
  clearWhitelist,
  listClassReps,
  assignClassRep,
  removeClassRep,
};
