const Hashtag = require('../models/Hashtag');

// GET /api/hashtags/trending
async function getTrending(req, res) {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const tags = await Hashtag.getTrending(limit);
    return res.json({ hashtags: tags });
  } catch (err) {
    console.error('getTrending:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/hashtags/search?q=...
async function searchHashtags(req, res) {
  try {
    const { q = '' } = req.query;
    if (!q.trim()) return res.json({ hashtags: [] });
    const tags = await Hashtag.searchHashtags(q.trim());
    return res.json({ hashtags: tags });
  } catch (err) {
    console.error('searchHashtags:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/hashtags/:tag/posts
async function getPostsByTag(req, res) {
  try {
    const tag = req.params.tag.toLowerCase();
    const [meta, posts] = await Promise.all([
      Hashtag.getHashtagMeta(tag),
      Hashtag.getPostsByTag(tag, req.user.id),
    ]);
    return res.json({ tag, meta, posts });
  } catch (err) {
    console.error('getPostsByTag:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getTrending, searchHashtags, getPostsByTag };
