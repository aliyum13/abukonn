const pool = require('../config/db');

// Matches @username — letters, numbers, underscores, 2-30 chars, not preceded by
// a word character (so email-like text or code isn't accidentally matched)
const MENTION_REGEX = /(?:^|[^\w@])@([a-zA-Z0-9_]{2,30})/g;

function extractMentionedUsernames(text) {
  if (!text) return [];
  const usernames = new Set();
  let match;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    usernames.add(match[1].toLowerCase());
  }
  return [...usernames];
}

/** Resolves @usernames found in `text` to user IDs (excluding the author and blocked relationships). */
async function resolveMentions(text, authorId) {
  const usernames = extractMentionedUsernames(text);
  if (usernames.length === 0) return [];

  const { rows } = await pool.query(
    `SELECT id, username FROM abukonn.users
     WHERE LOWER(username) = ANY($1)
       AND id != $2
       AND id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $2)
       AND id NOT IN (SELECT blocker_id FROM abukonn.blocks WHERE blocked_id = $2)`,
    [usernames, authorId]
  );
  return rows;
}

module.exports = { extractMentionedUsernames, resolveMentions };
