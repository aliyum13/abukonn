const pool = require('../config/db');

const SETTINGS_COLS = `
  user_id, default_post_audience, story_audience, who_can_message,
  who_can_connect, show_matric,
  notif_likes, notif_comments, notif_follows, notif_connect_requests, notif_messages,
  is_deactivated, created_at, updated_at
`;

async function createUserSettingsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.user_settings (
      user_id                 INTEGER PRIMARY KEY REFERENCES abukonn.users(id) ON DELETE CASCADE,
      default_post_audience   VARCHAR(20) NOT NULL DEFAULT 'public',
      story_audience          VARCHAR(20) NOT NULL DEFAULT 'public',
      who_can_message         VARCHAR(20) NOT NULL DEFAULT 'everyone',
      who_can_connect         VARCHAR(20) NOT NULL DEFAULT 'everyone',
      show_matric             VARCHAR(20) NOT NULL DEFAULT 'only_me',
      notif_likes             BOOLEAN NOT NULL DEFAULT TRUE,
      notif_comments          BOOLEAN NOT NULL DEFAULT TRUE,
      notif_follows           BOOLEAN NOT NULL DEFAULT TRUE,
      notif_connect_requests  BOOLEAN NOT NULL DEFAULT TRUE,
      notif_messages          BOOLEAN NOT NULL DEFAULT TRUE,
      is_deactivated          BOOLEAN NOT NULL DEFAULT FALSE,
      created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('User settings table ready');
}

async function getOrCreate(userId) {
  let result = await pool.query(
    `SELECT ${SETTINGS_COLS} FROM abukonn.user_settings WHERE user_id = $1`,
    [userId]
  );
  if (result.rows[0]) return result.rows[0];

  result = await pool.query(
    `INSERT INTO abukonn.user_settings (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING ${SETTINGS_COLS}`,
    [userId]
  );
  if (result.rows[0]) return result.rows[0];

  const again = await pool.query(
    `SELECT ${SETTINGS_COLS} FROM abukonn.user_settings WHERE user_id = $1`,
    [userId]
  );
  return again.rows[0];
}

const ALLOWED = {
  default_post_audience: ['public', 'connections', 'followers'],
  story_audience: ['public', 'followers', 'connections', 'close_friends'],
  who_can_message: ['everyone', 'connections', 'nobody'],
  who_can_connect: ['everyone', 'nobody'],
  show_matric: ['only_me', 'connections', 'everyone'],
};

const BOOL_FIELDS = [
  'notif_likes', 'notif_comments', 'notif_follows', 'notif_connect_requests', 'notif_messages',
];

async function update(userId, fields) {
  const sets = [];
  const vals = [];
  let i = 1;

  for (const [key, value] of Object.entries(fields)) {
    if (ALLOWED[key]) {
      if (!ALLOWED[key].includes(value)) {
        throw new Error(`Invalid value for ${key}`);
      }
      sets.push(`${key} = $${i++}`);
      vals.push(value);
    } else if (BOOL_FIELDS.includes(key)) {
      sets.push(`${key} = $${i++}`);
      vals.push(!!value);
    }
  }

  if (sets.length === 0) return getOrCreate(userId);

  sets.push(`updated_at = NOW()`);
  vals.push(userId);

  const result = await pool.query(
    `UPDATE abukonn.user_settings SET ${sets.join(', ')}
     WHERE user_id = $${i}
     RETURNING ${SETTINGS_COLS}`,
    vals
  );
  return result.rows[0];
}

async function setDeactivated(userId, deactivated) {
  await getOrCreate(userId);
  const result = await pool.query(
    `UPDATE abukonn.user_settings
     SET is_deactivated = $2, updated_at = NOW()
     WHERE user_id = $1
     RETURNING ${SETTINGS_COLS}`,
    [userId, deactivated]
  );
  return result.rows[0];
}

function toClientSettings(row) {
  if (!row) return null;
  return {
    default_post_audience: row.default_post_audience,
    story_audience: row.story_audience,
    who_can_message: row.who_can_message,
    who_can_connect: row.who_can_connect,
    show_matric: row.show_matric,
    notif_likes: row.notif_likes,
    notif_comments: row.notif_comments,
    notif_follows: row.notif_follows,
    notif_connect_requests: row.notif_connect_requests,
    notif_messages: row.notif_messages,
    is_deactivated: row.is_deactivated,
  };
}

module.exports = {
  createUserSettingsTable,
  getOrCreate,
  update,
  setDeactivated,
  toClientSettings,
  ALLOWED,
};
