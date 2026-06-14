const News = require('../models/News');

async function getNews(req, res) {
  try {
    const news = await News.getAllNews();
    res.json({ news });
  } catch (err) {
    console.error('Get news error:', err.message);
    res.status(500).json({ message: 'Server error fetching news' });
  }
}

async function getNewsById(req, res) {
  try {
    const article = await News.getNewsById(parseInt(req.params.id, 10));

    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }

    res.json({ article });
  } catch (err) {
    console.error('Get news by id error:', err.message);
    res.status(500).json({ message: 'Server error fetching article' });
  }
}

async function createNews(req, res) {
  try {
    const { title, content, category, image_url } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({ message: 'Title, content, and category are required' });
    }

    const validCategories = ['academic', 'sports', 'events', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const article = await News.createNews({
      title,
      content,
      category,
      imageUrl: image_url,
      createdBy: req.user?.id || null,
    });

    res.status(201).json({ message: 'News created', article });
  } catch (err) {
    console.error('Create news error:', err.message);
    res.status(500).json({ message: 'Server error creating news' });
  }
}

module.exports = { getNews, getNewsById, createNews };
