const pool = require('../config/db');

async function search(req, res) {
  const { q = '', type = 'all' } = req.query;

  const trimmed = q.trim();
  if (!trimmed) {
    return res.json({ users: [], posts: [] });
  }

  const term = `%${trimmed}%`;

  try {
    let users = [];
    let posts = [];

    if (type === 'users' || type === 'all') {
      const result = await pool.query(
        `SELECT id, full_name, matric_number, department, level, profile_photo_url
         FROM abukonn.users
         WHERE full_name ILIKE $1 OR matric_number ILIKE $1 OR department ILIKE $1
         ORDER BY full_name
         LIMIT 10`,
        [term]
      );
      users = result.rows;
    }

    if (type === 'posts' || type === 'all') {
      const result = await pool.query(
        `SELECT p.id, p.content, p.likes_count, p.comments_count, p.created_at,
                p.user_id,
                u.full_name AS author_name,
                u.department AS author_department,
                u.profile_photo_url AS author_photo,
                u.matric_number AS author_matric
         FROM abukonn.posts p
         JOIN abukonn.users u ON p.user_id = u.id
         WHERE p.content ILIKE $1
         ORDER BY p.created_at DESC
         LIMIT 10`,
        [term]
      );
      posts = result.rows;
    }

    res.json({ users, posts });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ message: 'Server error during search' });
  }
}

module.exports = { search };
