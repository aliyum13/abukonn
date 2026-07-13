const pool = require('../config/db');

// ── Push notifications (Expo) ────────────────────────────────────────────────
//
// Devices register an Expo push token; we send through Expo's push service,
// which fans out to APNs (iOS) and FCM (Android). Free, and no Apple/Google
// credentials to manage on our side.
//
// Push is ALWAYS best-effort. A failed push must never break the request that
// triggered it — someone liking a post should not see an error because a
// notification couldn't be delivered.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo accepts up to 100 messages per request

const CREATE_PUSH_TOKENS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON abukonn.push_tokens(user_id);`;

async function createPushTokensTable() {
  await pool.query(CREATE_PUSH_TOKENS_TABLE);
  console.log('Push tokens table ready');
}

// Register a device. The token is UNIQUE and re-pointed to whichever user last
// logged in on that device — otherwise, if two students shared a phone, the
// previous user would keep receiving the new user's notifications.
async function registerToken(userId, token, platform = null) {
  if (!token || typeof token !== 'string' || !token.startsWith('ExponentPushToken')) {
    return false;
  }
  await pool.query(
    `INSERT INTO abukonn.push_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE
       SET user_id = EXCLUDED.user_id,
           platform = EXCLUDED.platform,
           last_used_at = CURRENT_TIMESTAMP`,
    [userId, token, platform]
  );
  return true;
}

// Called on logout, so a signed-out phone stops receiving that user's pushes.
async function unregisterToken(token) {
  if (!token) return;
  await pool.query(`DELETE FROM abukonn.push_tokens WHERE token = $1`, [token]);
}

async function getTokensForUsers(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT user_id, token FROM abukonn.push_tokens WHERE user_id = ANY($1::int[])`,
    [userIds]
  );
  return rows;
}

// Expo tells us when a token is dead (uninstalled app, etc). Removing them
// keeps the table from filling with tokens that can never be delivered to.
async function removeDeadTokens(tokens) {
  if (!tokens.length) return;
  await pool.query(`DELETE FROM abukonn.push_tokens WHERE token = ANY($1::text[])`, [tokens]);
  console.log(`[push] removed ${tokens.length} dead token(s)`);
}

async function sendChunk(messages) {
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    console.error('[push] Expo responded', res.status);
    return;
  }

  const body = await res.json();
  const tickets = body?.data || [];

  // Match tickets back to the messages we sent (Expo preserves order) and drop
  // any token Expo reports as unregistered.
  const dead = [];
  tickets.forEach((t, i) => {
    if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
      dead.push(messages[i].to);
    } else if (t.status === 'error') {
      console.error('[push] delivery error:', t.message);
    }
  });
  if (dead.length) await removeDeadTokens(dead);
}

/**
 * Send a push to one or more users. Best-effort and fire-and-forget.
 *
 * @param {number[]} userIds  recipients
 * @param {object}   payload  { title, body, data, senderId }
 *
 * If `senderId` is given and the title/body contain the placeholder {name}, the
 * sender's name is looked up and substituted. That lookup happens ONLY after we
 * know a recipient actually has the app installed — so notifications for people
 * with no registered device cost nothing extra.
 */
async function sendPushToUsers(userIds, payload) {
  try {
    let { title, body, data = {}, senderId } = payload || {};
    if (!title || !userIds?.length) return;

    const rows = await getTokensForUsers(userIds);
    if (!rows.length) return; // nobody has the app installed — stop here

    // Only now is it worth resolving the sender's name.
    if (senderId && (title.includes('{name}') || (body || '').includes('{name}'))) {
      const { rows: u } = await pool.query(
        `SELECT full_name FROM abukonn.users WHERE id = $1`,
        [senderId]
      );
      const name = u[0]?.full_name || 'Someone';
      title = title.replace('{name}', name);
      body = (body || '').replace('{name}', name);
    }

    const messages = rows.map(r => ({
      to: r.token,
      sound: 'default',
      title,
      body,
      data,          // lets the app deep-link to the right screen on tap
      priority: 'high',
    }));

    for (let i = 0; i < messages.length; i += CHUNK) {
      await sendChunk(messages.slice(i, i + CHUNK));
    }
  } catch (err) {
    // Never let a push failure surface to the user.
    console.error('[push] send failed:', err.message);
  }
}

module.exports = {
  createPushTokensTable,
  registerToken,
  unregisterToken,
  sendPushToUsers,
};
