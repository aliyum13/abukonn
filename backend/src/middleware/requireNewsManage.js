const pool = require('../config/db');
const News = require('../models/News');
const { hasRole, ROLE_TYPES } = require('../models/UserRole');

// Who may edit or delete a News article:
//   - a FULL admin (users.role === 'admin') may change any article;
//   - a Media Team member may change only the articles they published;
//   - nobody else. That includes editors and class coordinators, who carry is_admin for the
//     admin panel but used to be able to edit and delete ANY article (the admin router only
//     checked is_admin). They keep the access only if they also hold media_team, and then
//     only for their own articles.
// Publishing already required media_team; this makes changing an article at least as strict.
function mayManageNews({ isFullAdmin, isMediaTeam, userId }, article) {
  if (isFullAdmin) return true;
  return isMediaTeam && article.created_by != null && article.created_by === userId;
}

// Chain AFTER an auth middleware (it relies on req.user.id) and BEFORE any body/upload
// parsing, so a refused request never uploads an image. Roles are read fresh from the
// database on every request, like requireMediaTeam. Sets req.newsArticle on success.
//
// Order matters, the same as the library's delete: someone with no rights at all is refused
// (403) BEFORE the article is looked up, so the status can't be used to probe which ids
// exist. After that a missing article is 404 and an ownership failure is 403.
async function requireNewsManage(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  try {
    const userId = req.user.id;
    const [{ rows }, isMediaTeam] = await Promise.all([
      pool.query('SELECT role FROM abukonn.users WHERE id = $1', [userId]),
      hasRole(userId, ROLE_TYPES.MEDIA_TEAM),
    ]);
    const isFullAdmin = rows[0]?.role === 'admin';
    if (!isFullAdmin && !isMediaTeam) {
      return res.status(403).json({ message: 'Forbidden. Media Team or full admin access is required to change News.' });
    }

    const id = parseInt(req.params.id, 10);
    const article = Number.isInteger(id) ? await News.getNewsOwnership(id) : null;
    if (!article) return res.status(404).json({ message: 'Article not found' });

    if (!mayManageNews({ isFullAdmin, isMediaTeam, userId }, article)) {
      return res.status(403).json({ message: 'Forbidden. You can only change News articles you published.' });
    }
    req.newsArticle = article;
    next();
  } catch (err) {
    console.error('requireNewsManage:', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
}

module.exports = requireNewsManage;
module.exports.mayManageNews = mayManageNews;
