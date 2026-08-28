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
      // Same badge fields Follow.js's PERSON_SELECT already returns for
      // Discover/people-search -- this is a separate, older query (general
      // search predates the badge system, or just never got updated) that
      // never picked them up, so search results showed a bare name while the
      // exact same person's card on Discover or their own profile showed
      // Verified/Class Rep/etc. Not a rendering bug -- the fields genuinely
      // weren't in the response for either client to render.
      const result = await pool.query(
        `SELECT u.id, u.full_name, u.department, u.level, u.profile_photo_url,
                COALESCE(u.role, 'user') AS role,
                COALESCE(u.is_verified, FALSE) AS is_verified,
                COALESCE(u.is_content_creator, FALSE) AS is_content_creator,
                COALESCE(u.is_admin, FALSE) AS is_admin,
                EXISTS(SELECT 1 FROM abukonn.class_representatives cr WHERE cr.user_id = u.id) AS is_class_rep,
                EXISTS(
                  SELECT 1 FROM abukonn.follows f
                  WHERE f.follower_id = $2 AND f.following_id = u.id
                ) AS is_following
         FROM abukonn.users u
         WHERE u.full_name ILIKE $1 OR u.department ILIKE $1
         ORDER BY u.full_name
         LIMIT 10`,
        [term, req.user.id]
      );
      users = result.rows;
    }

    if (type === 'posts' || type === 'all') {
      const result = await pool.query(
        `SELECT p.id, p.content, p.likes_count, p.comments_count, p.created_at,
                p.user_id,
                u.full_name AS author_name,
                u.department AS author_department,
                u.profile_photo_url AS author_photo
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
