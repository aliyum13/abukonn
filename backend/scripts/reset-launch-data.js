/**
 * Pre-launch data reset.
 *
 * Wipes all TEST ACTIVITY/CONTENT so the platform starts clean at launch,
 * while KEEPING:
 *   - users (everyone stays registered, admins keep access)
 *   - user_settings
 *   - academic_calendar, timetables, timetable_uploads
 *   - news
 *   - matric_whitelist
 *
 * Uses TRUNCATE ... RESTART IDENTITY CASCADE on parent tables — CASCADE clears
 * dependent rows automatically in the correct order (so no foreign-key errors),
 * and RESTART IDENTITY resets auto-increment IDs to 1 for a truly fresh start.
 *
 * IMPORTANT: TRUNCATE CASCADE will also clear anything that references the
 * truncated tables. We deliberately DO NOT truncate `users`, so nothing that
 * references users is cascaded via users. The tables listed below are the
 * content roots; their children cascade cleanly.
 *
 * Exposed as an admin-only endpoint (see routes/admin.js) requiring an explicit
 * confirmation token so it can never fire by accident.
 */

// Content tables to clear. Order doesn't matter with CASCADE, but grouped for clarity.
const TABLES_TO_WIPE = [
  // Posts and everything hanging off them (likes, comments, replies, polls, events, hashtag links)
  'posts',
  'post_likes',
  'post_hashtags',
  'hashtags',
  'comments',
  'comment_replies',
  'poll_options',
  'poll_votes',
  'event_rsvps',
  // Stories
  'stories',
  'story_reactions',
  'story_replies',
  'story_views',
  // Messaging
  'messages',
  'conversations',
  'groups',
  'group_members',
  'group_messages',
  // Social graph
  'follows',
  'connections',
  'connect_requests',
  // Misc user-generated
  'notifications',
  'reports',
  'blocks',
  'highlights',
  'library_materials',
  'support_tickets',
];

async function resetLaunchData(pool) {
  // Build a single TRUNCATE covering all tables — one statement, atomic.
  const qualified = TABLES_TO_WIPE.map(t => `abukonn.${t}`).join(', ');
  await pool.query(`TRUNCATE ${qualified} RESTART IDENTITY CASCADE`);

  // Report what remains in the kept tables so the caller can confirm nothing
  // important was lost.
  const kept = {};
  for (const t of ['users', 'academic_calendar', 'timetables', 'news', 'user_settings']) {
    try {
      const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM abukonn.${t}`);
      kept[t] = rows[0].n;
    } catch {
      kept[t] = 'n/a';
    }
  }
  return { wiped: TABLES_TO_WIPE, kept };
}

module.exports = { resetLaunchData, TABLES_TO_WIPE };
