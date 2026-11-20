const News = require('../models/News');
const { deleteNewsCover } = require('../lib/newsAsset');

// Edit and delete for News articles. Kept apart from newsController (public reads, publish,
// likes, unread) because these two sit behind requireNewsManage (a full admin, or the Media
// Team member who published the article) and are mounted on both /api/news/:id and
// /api/admin/news/:id.

// PUT /api/news/:id -- JSON edit for clients that can't send multipart (the mobile app). The
// route has already been through requireNewsManage: a full admin, or the Media Team member
// who published this article. Editing never notifies. category is not accepted any more.
async function updateNewsHandler(req, res) {
  try {
    const { title, content, image_url } = req.body || {};
    for (const v of [title, content, image_url]) {
      if (v !== undefined && v !== null && typeof v !== 'string') {
        return res.status(400).json({ message: 'Invalid fields' });
      }
    }
    const article = await News.updateNews(req.newsArticle.id, {
      title: typeof title === 'string' ? title.trim() : undefined,
      content: typeof content === 'string' ? content.trim() : undefined,
      imageUrl: image_url === undefined ? undefined : (image_url || null),
    });
    if (article === undefined) return res.status(400).json({ message: 'No fields to update' });
    if (article === null) return res.status(404).json({ message: 'Article not found' });
    res.json({ message: 'Article updated', article });
  } catch (err) {
    console.error('Update news error:', err.message);
    res.status(500).json({ message: 'Server error updating news' });
  }
}

// DELETE /api/news/:id and /api/admin/news/:id share this. Same gate (requireNewsManage).
// The row goes first; the cover image is removed AFTER the response so cleanup can never
// delay or fail the delete (it is best-effort and never throws).
async function deleteNewsHandler(req, res) {
  try {
    const removed = await News.deleteNews(req.newsArticle.id);
    if (!removed) return res.status(404).json({ message: 'Article not found' });
    res.json({ message: `Article "${removed.title}" deleted` });
    deleteNewsCover(removed.image_url);
  } catch (err) {
    console.error('Delete news error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { updateNewsHandler, deleteNewsHandler };
