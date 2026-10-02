const pool = require('../config/db');
const News = require('../models/News');
const { sendPushToUsers } = require('./push');

const MAX_BODY = 140;

// Campus-wide push for a newly published article: everyone with a registered
// device except the author. Delivery (100-per-request chunking, dead-token
// cleanup, never throwing) is lib/push's job; this only decides who and what.
//
// Exactly-once: the article is atomically claimed first (news.notified_at), so
// calling this twice for the same article -- a retried request, a double
// invocation -- sends one push, not two. A crash after the claim loses the push
// rather than duplicating it, which is the right failure for a notification.
// Never throws: publishing must succeed even if the push can't go out.
async function announceNews(article) {
  try {
    if (!article?.id) return false;
    if (!(await News.claimNotification(article.id))) return false;

    const { rows } = await pool.query(
      `SELECT id FROM abukonn.users WHERE id <> $1`,
      [article.created_by ?? 0]
    );
    const title = String(article.title || '');
    await sendPushToUsers(
      rows.map(r => r.id),
      {
        title: 'ABUkonn News',
        body: title.length > MAX_BODY ? `${title.slice(0, MAX_BODY - 1)}…` : title,
        data: { type: 'news', newsId: article.id },
      }
    );
    return true;
  } catch (err) {
    console.error('[news] announce failed:', err.message);
    return false;
  }
}

module.exports = { announceNews };
