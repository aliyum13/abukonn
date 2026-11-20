const News = require('../models/News');
const { announceNews } = require('../lib/newsPublish');
const { hasRole, ROLE_TYPES } = require('../models/UserRole');

async function getNews(req, res) {
  try {
    // req.user is only set when a token was sent (see optionalAuth) -- news
    // stays readable without login, is_liked just comes back false for an
    // anonymous request instead of reflecting a real account's likes.
    const news = await News.getAllNews(req.user?.id ?? null);
    res.json({ news });
  } catch (err) {
    console.error('Get news error:', err.message);
    res.status(500).json({ message: 'Server error fetching news' });
  }
}

async function getNewsById(req, res) {
  try {
    const article = await News.getNewsById(parseInt(req.params.id, 10), req.user?.id ?? null);

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ article });
  } catch (err) {
    console.error('Get news by id error:', err.message);
    res.status(500).json({ message: 'Server error fetching article' });
  }
}

// Like/unlike a news article. Deliberately NO notification on like, unlike
// posts -- news is institutional/staff content, not a personal post, and a
// like-notification here would just spam whichever staff account created it.
async function likeNewsHandler(req, res) {
  try {
    const newsId = parseInt(req.params.id, 10);
    const article = await News.getNewsById(newsId);
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    const { likes_count, is_liked } = await News.toggleLike(newsId, req.user.id);
    res.json({ message: is_liked ? 'Article liked' : 'Article unliked', likes_count, is_liked });
  } catch (err) {
    console.error('Like news error:', err.message);
    res.status(500).json({ message: 'Server error liking article' });
  }
}

async function createNews(req, res) {
  try {
    // Media Team gating happens in the route (requireMediaTeam). Categories are
    // gone from News, so any `category` an older client sends is ignored.
    const { title, content, image_url } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const article = await News.createNews({
      title,
      content,
      imageUrl: image_url,
      createdBy: req.user?.id || null,
    });

    res.status(201).json({ message: 'News created', article });
    // After the response; claims the article atomically so it's announced once.
    announceNews(article);
  } catch (err) {
    console.error('Create news error:', err.message);
    res.status(500).json({ message: 'Server error creating news' });
  }
}

// Lets a client decide whether to show its "New post" control. This is the SAME
// check requireMediaTeam applies to POST /api/news (and /api/admin/news), read
// fresh from user_roles on every call: a full admin who does not hold media_team
// is told false, because the publish endpoints would refuse them. It only drives
// the UI; the publish endpoints remain the real gate.
async function getNewsPermissions(req, res) {
  try {
    res.json({ can_publish: await hasRole(req.user.id, ROLE_TYPES.MEDIA_TEAM) });
  } catch (err) {
    console.error('News permissions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Badge count: articles published since this user last opened News.
async function getUnreadNewsCount(req, res) {
  try {
    res.json({ count: await News.getUnreadCount(req.user.id) });
  } catch (err) {
    console.error('Unread news count error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Called when a client opens the News screen: clears the badge.
async function markNewsSeen(req, res) {
  try {
    await News.markSeen(req.user.id);
    res.json({ count: 0 });
  } catch (err) {
    console.error('Mark news seen error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getNews, getNewsById, createNews, likeNewsHandler, getUnreadNewsCount, markNewsSeen, getNewsPermissions };
