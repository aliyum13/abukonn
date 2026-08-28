const pool = require('../config/db');

const CREATE_POSTS_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

const CREATE_POST_LIKES_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.post_likes (
  user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, post_id)
);
`;

// Multi-media (Pro feature): a post can carry up to 3 images/videos, in any
// mix, in order. Deliberately a SEPARATE table rather than replacing
// image_url on posts -- old posts keep working unchanged (they still read
// image_url), and a post either uses the legacy single image_url OR this
// table, never both. position orders items left-to-right in the composer/
// carousel. thumbnail_url/duration_seconds are video-only (Cloudinary
// generates both automatically on upload) and stay NULL for images.
const CREATE_POST_MEDIA_TABLE = `
CREATE TABLE IF NOT EXISTS abukonn.post_media (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR(10) NOT NULL CHECK (media_type IN ('image', 'video')),
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

async function createPostsTable() {
  await pool.query(CREATE_POSTS_TABLE);
  // Add new columns to existing tables (idempotent)
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'GENERAL'`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS repost_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS is_repost BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS original_post_id INTEGER`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS original_author_name TEXT`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS post_subtype VARCHAR(20) DEFAULT 'post'`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS discussion_title TEXT`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS poll_duration_hours INTEGER`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS poll_ends_at TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_title VARCHAR(200)`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_date TIMESTAMP WITH TIME ZONE`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_location VARCHAR(200)`);
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS event_rsvp_count INTEGER DEFAULT 0`);
  // Edit-after-publish: NULL means never edited; a timestamp means the post's
  // text was changed after posting, which the clients surface as an "edited"
  // marker. Only the text/caption is editable (not media) -- see updatePost.
  await pool.query(`ALTER TABLE abukonn.posts ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE`);
  // The feed queries (getForYouFeed and friends) bound their candidate pool to
  // "posts from the last N hours" -- without an index on created_at, that
  // WHERE has nothing to seek on and falls back to scanning the whole table,
  // a cost that only grows as historical post volume grows even though the
  // window itself stays fixed.
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_posts_created_at ON abukonn.posts(created_at)`);
  // Uniqueness guard: a user can only ever have ONE repost of a given
  // original. Before this, nothing stopped repeat POST /:id/repost calls --
  // mobile's is_reposted was a client-only fiction that reset on every
  // reload, so a user re-tapping repost after a refresh (thinking it hadn't
  // registered) created a SECOND repost row and double-incremented
  // repost_count, and nothing guarded the race between two near-simultaneous
  // requests either. Partial (only actual repost rows) so it doubles as the
  // lookup index the new is_reposted EXISTS checks above and the
  // repost/unrepost functions below all use -- one index, three jobs.
  // Wrapped: if duplicate reposts already exist in prod from before this fix,
  // Postgres refuses to create a UNIQUE index over data that violates it --
  // this logs instead of crashing backend startup. Needs a one-time manual
  // cleanup first (see this commit's message) before the index actually
  // takes effect; nothing else in this migration depends on it existing yet.
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_unique_repost ON abukonn.posts(user_id, original_post_id) WHERE is_repost = TRUE`);
  } catch (err) {
    console.error('Could not create idx_posts_unique_repost (likely duplicate reposts already exist -- needs manual cleanup):', err.message);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.poll_options (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      option_text VARCHAR(200) NOT NULL,
      vote_count INTEGER DEFAULT 0
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.poll_votes (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      option_id INTEGER NOT NULL REFERENCES abukonn.poll_options(id) ON DELETE CASCADE,
      UNIQUE(post_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.event_rsvps (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES abukonn.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES abukonn.users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    )
  `);
  console.log('Posts table ready');
}

async function createPostLikesTable() {
  await pool.query(CREATE_POST_LIKES_TABLE);
  console.log('Post likes table ready');
}

async function createPostMediaTable() {
  await pool.query(CREATE_POST_MEDIA_TABLE);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_post_media_post ON abukonn.post_media(post_id, position)`);
  console.log('Post media table ready');
}

async function createPost({ userId, content, imageUrl = null, category = 'GENERAL', isRepost = false, originalPostId = null, originalAuthorName = null, postSubtype = 'post', discussionTitle = null, pollOptions = null, pollDurationHours = null, eventTitle = null, eventDate = null, eventLocation = null, media = null }) {
  const pollEndsAt = (postSubtype === 'poll' && pollDurationHours)
    ? new Date(Date.now() + pollDurationHours * 3600000).toISOString()
    : null;

  const result = await pool.query(
    `INSERT INTO abukonn.posts (user_id, content, image_url, category, is_repost, original_post_id, original_author_name, post_subtype, discussion_title, poll_duration_hours, poll_ends_at, event_title, event_date, event_location)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [userId, content, imageUrl, category, isRepost, originalPostId, originalAuthorName, postSubtype, discussionTitle, pollDurationHours || null, pollEndsAt, eventTitle || null, eventDate || null, eventLocation || null]
  );
  const post = result.rows[0];

  if (postSubtype === 'poll' && Array.isArray(pollOptions)) {
    for (const text of pollOptions.filter(t => t?.trim())) {
      await pool.query(
        'INSERT INTO abukonn.poll_options (post_id, option_text) VALUES ($1, $2)',
        [post.id, text.trim()]
      );
    }
  }

  // Multi-media (Pro): a post uses EITHER the legacy single image_url OR
  // this table, never both -- if media[] was supplied, imageUrl is expected
  // to be null (enforced by the controller's Pro-gate + validation, not
  // here, so this model function stays a plain writer).
  if (Array.isArray(media) && media.length > 0) {
    let position = 0;
    for (const item of media) {
      await pool.query(
        `INSERT INTO abukonn.post_media (post_id, media_url, media_type, thumbnail_url, duration_seconds, position)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [post.id, item.media_url, item.media_type, item.thumbnail_url || null, item.duration_seconds || null, position]
      );
      position += 1;
    }
  }

  return post;
}

// All media for one post, in composer/carousel order.
async function getPostMedia(postId) {
  const { rows } = await pool.query(
    `SELECT id, media_url, media_type, thumbnail_url, duration_seconds, position
     FROM abukonn.post_media WHERE post_id = $1 ORDER BY position ASC`,
    [postId]
  );
  return rows;
}

// Media for MANY posts at once, grouped by post_id -- used when attaching
// media to a page of feed posts so we don't run one query per post.
async function getMediaForPosts(postIds) {
  if (!postIds || postIds.length === 0) return {};
  const { rows } = await pool.query(
    `SELECT id, post_id, media_url, media_type, thumbnail_url, duration_seconds, position
     FROM abukonn.post_media WHERE post_id = ANY($1::int[]) ORDER BY post_id, position ASC`,
    [postIds]
  );
  const byPost = {};
  for (const row of rows) {
    if (!byPost[row.post_id]) byPost[row.post_id] = [];
    byPost[row.post_id].push(row);
  }
  return byPost;
}

async function getFollowingPosts(currentUserId, limit = 50, offset = 0) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            orig_u.full_name AS original_author_full_name,
            orig_u.profile_photo_url AS original_author_photo,
            orig_u.id AS original_author_id,
            COALESCE(orig.likes_count, 0) AS original_likes_count,
            COALESCE(orig.comments_count, 0) AS original_comments_count,
            COALESCE(orig.repost_count, 0) AS original_repost_count,
            COALESCE(orig.view_count, 0) AS original_view_count,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked,
            -- Have I already reposted the thing THIS card represents --
            -- canonical id (its own id, or original_post_id if this card
            -- IS a repost), so it reads the same whether you're looking at
            -- the original or someone else's repost of it. Mirrors is_liked
            -- exactly (same cost shape: EXISTS keyed on the viewer).
            EXISTS(
              SELECT 1 FROM abukonn.posts rp
              WHERE rp.user_id = $1 AND rp.is_repost = TRUE
                AND rp.original_post_id = (CASE WHEN p.is_repost THEN p.original_post_id ELSE p.id END)
            ) AS is_reposted,
            TRUE AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count, p.edited_at,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $1) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $1) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     LEFT JOIN abukonn.posts orig ON p.is_repost = TRUE AND orig.id = p.original_post_id
     LEFT JOIN abukonn.users orig_u ON orig.user_id = orig_u.id
     WHERE p.user_id IN (
       SELECT following_id FROM abukonn.follows WHERE follower_id = $1
     )
     AND p.user_id NOT IN (
       SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1
     )
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [currentUserId, limit, offset]
  );
  return result.rows;
}

async function getAllPosts(currentUserId, limit = 50, offset = 0) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            orig_u.full_name AS original_author_full_name,
            orig_u.profile_photo_url AS original_author_photo,
            orig_u.id AS original_author_id,
            COALESCE(orig.likes_count, 0) AS original_likes_count,
            COALESCE(orig.comments_count, 0) AS original_comments_count,
            COALESCE(orig.repost_count, 0) AS original_repost_count,
            COALESCE(orig.view_count, 0) AS original_view_count,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked,
            -- See getFollowingPosts's is_reposted comment -- same canonical-id
            -- EXISTS, mirrors is_liked.
            EXISTS(
              SELECT 1 FROM abukonn.posts rp
              WHERE rp.user_id = $1 AND rp.is_repost = TRUE
                AND rp.original_post_id = (CASE WHEN p.is_repost THEN p.original_post_id ELSE p.id END)
            ) AS is_reposted,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $1 AND f.following_id = p.user_id
            ) AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count, p.edited_at,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $1) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $1) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     LEFT JOIN abukonn.posts orig ON p.is_repost = TRUE AND orig.id = p.original_post_id
     LEFT JOIN abukonn.users orig_u ON orig.user_id = orig_u.id
     WHERE p.user_id NOT IN (
       SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1
     )
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [currentUserId, limit, offset]
  );
  return result.rows;
}

// ── "For You" ranked feed (Option B: following + injected discovery) ──────────
// Tuning knobs — all in one place so the feed can be retuned without touching
// the query. Adjust these based on real usage, not guesswork.
// ── "For You" feed tuning (v2: freshness-first with fairness guarantee) ───────
// Design goal: every new post gets a real chance to be seen regardless of
// engagement. Freshness is an ADDITIVE floor (not a multiplier engagement can
// erase), so a brand-new 0-like post ranks high for its first hours, then
// fades to engagement-based ranking. Trending mixes in but can't bury fresh.
// All knobs here; retune against real usage. Faculty/dept/level relevance is
// deferred to a later version (kept simple: freshness + following + trending).
const FORYOU = {
  FRESH_WINDOW_HOURS: 6,    // a post gets the freshness boost for its first 6h,
                            //   linearly decaying to 0 across the window.
  FRESH_BOOST: 120,         // size of the freshness floor at age 0. Large vs
                            //   typical engagement so new posts surface, but
                            //   finite so a viral old post can still mix in.
  FOLLOW_BOOST: 40,         // added for posts by people you follow (extra pull
                            //   toward your circle, stacks with freshness).
  FOLLOW_FRESH_BONUS: 40,   // extra added when a followed author's post is ALSO
                            //   inside the fresh window (new-from-followed = top).
  ENGAGEMENT_WEIGHT: 1.0,   // multiplier on raw engagement_score. Trending posts
                            //   ride this; capped below so they don't dominate.
  ENGAGEMENT_CAP: 200,      // engagement contribution is capped here so one viral
                            //   post can't tower infinitely over fresh content.
  OWN_POST_BOOST: 100000,   // your own very recent post floats to the very top so
                            //   you always immediately see what you just posted.
  OWN_POST_WINDOW_HOURS: 2, //   ...but only for its first 2h (then it ranks normally).
  SEEN_DEMOTE: 0.25,        // multiplier for posts you've already viewed — strong
                            //   demote (not hide) so refresh surfaces fresh content
                            //   without ever emptying the feed.
  CANDIDATE_MAX_AGE_HOURS: 168, // only consider posts from the last 7 days, so the
                                //   feed is a bounded, relevant campus window.
  REFRESH_JITTER_MAGNITUDE: 2,      // small tie-break jitter added to ranking_score so a
                                     //   caught-up user (nothing new since last visit)
                                     //   doesn't see an identical order on every refresh.
                                     //   Far smaller than every real gate above (own/
                                     //   follow/fresh/engagement), so it can only ever
                                     //   reorder posts that are already practically tied
                                     //   -- it cannot bury a new post or promote a
                                     //   followed/older post above one that's genuinely
                                     //   ranked higher.
  REFRESH_JITTER_BUCKET_SECONDS: 600, // deterministic hash of (post id, current bucket),
                                       //   NOT random() -- stable within one infinite-
                                       //   scroll session (every page shares the same
                                       //   bucket, so nothing skips/duplicates across
                                       //   pages), rotates to a new arrangement roughly
                                       //   every 10 minutes.
};

// The ranked "For You" feed (v2). Freshness-first: a post gets a large additive
// freshness floor for its first FRESH_WINDOW_HOURS, so new posts surface even
// with zero engagement, then fade to engagement-based ranking. Followed authors
// and (capped) trending are added on top. Your own very recent posts float to
// the top. Already-seen posts are demoted (not hidden) so refresh brings newer
// content. Candidate pool is campus-wide but bounded to the last 7 days.
// Returns { posts, exhausted } -- exhausted=true when there are no more UNSEEN
// posts left (client shows "you're all caught up").
//
// sessionStart (epoch ms, optional): the client captures Date.now() once when
// it fetches page 1, and resends the SAME value on every loadMore() call for
// that scroll session. Serves two purposes here:
//   1. Seen-demote cutoff -- only views recorded BEFORE sessionStart count
//      toward already_seen. Without this, viewing page 1's posts mid-scroll
//      (the view-tracker fires in real time as posts cross 60% visibility,
//      well before the user reaches the bottom to trigger loadMore) would
//      retroactively demote them by the time page 2's query runs, shifting
//      them out of the ranking window OFFSET expected them in -- the root
//      cause of load-more duplicates/skips. Freezing "seen" as of session
//      start means viewing during THIS session can't reorder THIS session's
//      later pages; a genuine new session (real refresh) still demotes
//      normally.
//   2. Jitter seed (see REFRESH_JITTER_* below) -- reusing the client's
//      session value instead of a server time-bucket means refresh always
//      gets a new arrangement (sessionStart is different practically every
//      call), while staying fixed across one session's pages.
// Absent (older client, or any caller that doesn't pass it) falls back to
// today's exact behavior on both counts -- no seen cutoff, time-bucketed jitter.
async function getForYouFeed(currentUserId, limit = 50, offset = 0, sessionStart = null) {
  const result = await pool.query(
    `WITH base AS (
      SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            orig_u.full_name AS original_author_full_name,
            orig_u.profile_photo_url AS original_author_photo,
            orig_u.id AS original_author_id,
            COALESCE(orig.likes_count, 0) AS original_likes_count,
            COALESCE(orig.comments_count, 0) AS original_comments_count,
            COALESCE(orig.repost_count, 0) AS original_repost_count,
            COALESCE(orig.view_count, 0) AS original_view_count,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $1
            ) AS is_liked,
            -- See getFollowingPosts's is_reposted comment -- same canonical-id
            -- EXISTS, mirrors is_liked.
            EXISTS(
              SELECT 1 FROM abukonn.posts rp
              WHERE rp.user_id = $1 AND rp.is_repost = TRUE
                AND rp.original_post_id = (CASE WHEN p.is_repost THEN p.original_post_id ELSE p.id END)
            ) AS is_reposted,
            -- Computed once here (was previously re-written verbatim a second
            -- time inside the ranking_score expression below -- same EXISTS,
            -- same subplan, run twice per row for no reason). scored below
            -- references this column instead of re-running the subquery.
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $1 AND f.following_id = p.user_id
            ) AS is_following_author,
            -- Also computed once here -- was previously re-written three more
            -- times (is_trending, is_hot, and again inside ranking_score).
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count, p.edited_at,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $1) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $1) AS is_attending,
            -- Computed once here -- was previously re-written a second time
            -- inside the seen-demote multiplier below (same EXISTS twice).
            -- $16 IS NULL means no session cutoff was supplied -- any prior
            -- view counts, matching pre-sessionStart behavior exactly.
            EXISTS(
              SELECT 1 FROM abukonn.post_views pvw
              WHERE pvw.post_id = p.id AND pvw.viewer_id = $1
                AND ($16::bigint IS NULL OR pvw.viewed_at < to_timestamp($16::bigint / 1000.0))
            ) AS already_seen
      FROM abukonn.posts p
      JOIN abukonn.users u ON p.user_id = u.id
      LEFT JOIN abukonn.posts orig ON p.is_repost = TRUE AND orig.id = p.original_post_id
      LEFT JOIN abukonn.users orig_u ON orig.user_id = orig_u.id
      WHERE p.user_id NOT IN (SELECT blocked_id FROM abukonn.blocks WHERE blocker_id = $1)
        AND p.created_at > NOW() - ($13 || ' hours')::interval
    ),
    scored AS (
      SELECT *,
            (created_at > NOW() - INTERVAL '24 hours' AND engagement_score > 20) AS is_trending,
            (engagement_score > 50) AS is_hot,
            -- v2 ranking: additive freshness floor + follow + capped engagement,
            -- times the seen-demote. hours_old drives a linear freshness ramp.
            (
              (
                -- freshness floor: FRESH_BOOST at age 0, linearly to 0 at FRESH_WINDOW_HOURS
                GREATEST(0, $4::float * (1 - (EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0) / $5::float))
                -- following boost (+ extra if the followed post is also fresh)
                + (CASE WHEN is_following_author
                        THEN $6::float + (CASE WHEN created_at > NOW() - ($5 || ' hours')::interval THEN $7::float ELSE 0 END)
                        ELSE 0 END)
                -- capped engagement so trending mixes in but can't bury fresh
                + LEAST($9::float, $8::float * engagement_score)
                -- your own very recent post floats to the very top
                + (CASE WHEN user_id = $1 AND created_at > NOW() - ($10 || ' hours')::interval THEN $11::float ELSE 0 END)
              )
              * (CASE WHEN already_seen THEN $12::float ELSE 1 END)
              -- Refresh variety: see REFRESH_JITTER_MAGNITUDE/BUCKET_SECONDS
              -- above. Deterministic per (post, seed) -- NOT random() -- so
              -- pagination within one scroll session stays exactly
              -- consistent. Seed is the client's sessionStart ($16) when
              -- supplied (a new value every real refresh, fixed for that
              -- session's pages), else the old time-bucket fallback.
              + (abs(hashtext(id::text || COALESCE($16::text, (floor(extract(epoch from now()) / $15::float))::text))) % 1000) / 1000.0 * $14::float
            ) AS ranking_score
      FROM base
    )
    SELECT * FROM scored
    ORDER BY ranking_score DESC, created_at DESC
    LIMIT $2 OFFSET $3`,
    [
      currentUserId, limit, offset,
      FORYOU.FRESH_BOOST, FORYOU.FRESH_WINDOW_HOURS,
      FORYOU.FOLLOW_BOOST, FORYOU.FOLLOW_FRESH_BONUS,
      FORYOU.ENGAGEMENT_WEIGHT, FORYOU.ENGAGEMENT_CAP,
      String(FORYOU.OWN_POST_WINDOW_HOURS), FORYOU.OWN_POST_BOOST,
      FORYOU.SEEN_DEMOTE, String(FORYOU.CANDIDATE_MAX_AGE_HOURS),
      FORYOU.REFRESH_JITTER_MAGNITUDE, FORYOU.REFRESH_JITTER_BUCKET_SECONDS,
      sessionStart,
    ]
  );
  const posts = result.rows;
  // "All caught up" signal: if every post on this page is already seen (and we
  // got a full-or-partial page), the user has exhausted the unseen pool.
  // exhausted=true when there are no UNSEEN posts in what we returned.
  const anyUnseen = posts.some(p => !p.already_seen);
  const exhausted = posts.length === 0 || !anyUnseen;
  return { posts, exhausted };
}

async function getPostById(id) {
  const result = await pool.query(
    `SELECT p.*, u.full_name AS author_name, u.department AS author_department
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
// Reposts should always act on the ONE true original post -- not fork their
// own engagement, not chain through an intermediate repost. Given this ran
// for a while before that was true (repostPost previously copied whatever
// post it was handed, including another repost, without resolving further),
// existing data may already have chains. This walks up to 5 hops (a repost-
// of-a-repost-of-a-repost is not a realistic real scenario; the cap is a
// safety net against any data corruption forming a cycle, not a real limit).
// If a link in the chain has been deleted, stops at the last post that
// still exists rather than throwing -- a deleted original must never crash
// an interaction with whatever repost of it is still visible.
async function resolveCanonicalPost(post) {
  let current = post;
  let hops = 0;
  while (current && current.is_repost && current.original_post_id && hops < 5) {
    const next = await getPostById(current.original_post_id);
    if (!next) break; // original was deleted -- stay on the last valid post
    current = next;
    hops += 1;
  }
  return current;
}

async function getPostByIdForUser(id, currentUserId) {
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            orig_u.full_name AS original_author_full_name,
            orig_u.profile_photo_url AS original_author_photo,
            orig_u.id AS original_author_id,
            COALESCE(orig.likes_count, 0) AS original_likes_count,
            COALESCE(orig.comments_count, 0) AS original_comments_count,
            COALESCE(orig.repost_count, 0) AS original_repost_count,
            COALESCE(orig.view_count, 0) AS original_view_count,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            -- See getFollowingPosts's is_reposted comment -- same canonical-id
            -- EXISTS, mirrors is_liked. $2 here since this function's own id
            -- (the post being fetched) is $1.
            EXISTS(
              SELECT 1 FROM abukonn.posts rp
              WHERE rp.user_id = $2 AND rp.is_repost = TRUE
                AND rp.original_post_id = (CASE WHEN p.is_repost THEN p.original_post_id ELSE p.id END)
            ) AS is_reposted,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count, p.edited_at,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $2) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $2) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     LEFT JOIN abukonn.posts orig ON p.is_repost = TRUE AND orig.id = p.original_post_id
     LEFT JOIN abukonn.users orig_u ON orig.user_id = orig_u.id
     WHERE p.id = $1`,
    [id, currentUserId]
  );
  return result.rows[0] || null;
}

async function toggleLike(postId, userId) {
  const existing = await pool.query(
    `SELECT 1 FROM abukonn.post_likes WHERE post_id = $1 AND user_id = $2`,
    [postId, userId]
  );
  const alreadyLiked = existing.rows.length > 0;

  if (alreadyLiked) {
    await pool.query(
      `DELETE FROM abukonn.post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId]
    );
    await pool.query(
      `UPDATE abukonn.posts SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1`,
      [postId]
    );
  } else {
    await pool.query(
      `INSERT INTO abukonn.post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [postId, userId]
    );
    await pool.query(
      `UPDATE abukonn.posts SET likes_count = likes_count + 1 WHERE id = $1`,
      [postId]
    );
  }

  const result = await pool.query(
    `SELECT * FROM abukonn.posts WHERE id = $1`,
    [postId]
  );
  return { post: result.rows[0], is_liked: !alreadyLiked };
}

async function incrementCommentsCount(id) {
  await pool.query(
    `UPDATE abukonn.posts SET comments_count = comments_count + 1 WHERE id = $1`,
    [id]
  );
}

async function decrementCommentsCount(id) {
  await pool.query(
    `UPDATE abukonn.posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1`,
    [id]
  );
}

async function getPostsByUserId(userId, currentUserId = null) {
  // Use the viewer's id for is_liked/voted/attending flags; fall back to the
  // profile owner when no viewer is passed. Returns the same rich shape as the
  // feed so the profile can render polls, events, questions, etc. fully.
  const viewerId = currentUserId || userId;
  const result = await pool.query(
    `SELECT p.id, p.user_id, p.content, p.image_url, p.likes_count, p.comments_count,
            COALESCE(p.repost_count, 0) AS repost_count,
            COALESCE(p.view_count, 0) AS view_count,
            COALESCE(p.category, 'GENERAL') AS category,
            COALESCE(p.is_repost, FALSE) AS is_repost,
            p.original_post_id, p.original_author_name,
            orig_u.full_name AS original_author_full_name,
            orig_u.profile_photo_url AS original_author_photo,
            orig_u.id AS original_author_id,
            COALESCE(orig.likes_count, 0) AS original_likes_count,
            COALESCE(orig.comments_count, 0) AS original_comments_count,
            COALESCE(orig.repost_count, 0) AS original_repost_count,
            COALESCE(orig.view_count, 0) AS original_view_count,
            COALESCE(p.post_subtype, 'post') AS post_subtype,
            p.discussion_title,
            p.created_at,
            u.full_name AS author_name, u.department AS author_department,
            u.profile_photo_url AS author_photo,
            COALESCE(u.role, 'user') AS author_role,
            COALESCE(u.is_verified, FALSE) AS author_is_verified,
            COALESCE(u.is_content_creator, FALSE) AS author_is_content_creator,
            EXISTS(
              SELECT 1 FROM abukonn.post_likes pl
              WHERE pl.post_id = p.id AND pl.user_id = $2
            ) AS is_liked,
            -- See getFollowingPosts's is_reposted comment -- same canonical-id
            -- EXISTS, mirrors is_liked. $2 here since this function's own id
            -- (the profile owner) is $1.
            EXISTS(
              SELECT 1 FROM abukonn.posts rp
              WHERE rp.user_id = $2 AND rp.is_repost = TRUE
                AND rp.original_post_id = (CASE WHEN p.is_repost THEN p.original_post_id ELSE p.id END)
            ) AS is_reposted,
            EXISTS(
              SELECT 1 FROM abukonn.follows f
              WHERE f.follower_id = $2 AND f.following_id = p.user_id
            ) AS is_following_author,
            (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) AS engagement_score,
            (p.created_at > NOW() - INTERVAL '24 hours' AND (p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 20) AS is_trending,
            ((p.likes_count * 2 + p.comments_count * 3 + COALESCE(p.repost_count,0) * 2 + COALESCE(p.view_count,0) * 0.1) > 50) AS is_hot,
            (SELECT COUNT(*)::int FROM abukonn.comments c WHERE c.post_id = p.id AND c.created_at > NOW() - INTERVAL '1 hour') AS comment_velocity,
            p.poll_duration_hours, p.poll_ends_at,
            p.event_title, p.event_date, p.event_location, COALESCE(p.event_rsvp_count, 0) AS event_rsvp_count, p.edited_at,
            (SELECT json_agg(json_build_object('id', po.id, 'option_text', po.option_text, 'vote_count', po.vote_count) ORDER BY po.id) FROM abukonn.poll_options po WHERE po.post_id = p.id) AS poll_options,
            (SELECT pv.option_id FROM abukonn.poll_votes pv WHERE pv.post_id = p.id AND pv.user_id = $2) AS voted_option_id,
            EXISTS(SELECT 1 FROM abukonn.event_rsvps er WHERE er.post_id = p.id AND er.user_id = $2) AS is_attending
     FROM abukonn.posts p
     JOIN abukonn.users u ON p.user_id = u.id
     LEFT JOIN abukonn.posts orig ON p.is_repost = TRUE AND orig.id = p.original_post_id
     LEFT JOIN abukonn.users orig_u ON orig.user_id = orig_u.id
     WHERE p.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId, viewerId]
  );
  return result.rows;
}

// Idempotent: repost is a real toggle now (see unrepostPost), and this must
// never create a second row for a (user, original) pair that already has
// one -- that's exactly how repost_count got inflated before this fix (a
// stale client re-tapping repost, or a race between two near-simultaneous
// requests). Checked at the application level first (cheap, avoids a wasted
// INSERT in the common case), AND backstopped by idx_posts_unique_repost at
// the database level for the race case the application check alone can't
// close -- if that unique index rejects the INSERT, treat it exactly like
// finding the row via the SELECT: fetch and return the existing repost
// rather than surfacing the constraint violation as an error.
async function repostPost(originalPostId, userId) {
  const target = await getPostById(originalPostId);
  if (!target) throw new Error('Post not found');
  // Reposting a repost must point at the ONE true original, not chain
  // through the intermediate repost -- resolve first.
  const original = await resolveCanonicalPost(target);

  const existing = await pool.query(
    `SELECT * FROM abukonn.posts WHERE user_id = $1 AND is_repost = TRUE AND original_post_id = $2`,
    [userId, original.id]
  );
  if (existing.rows.length > 0) return existing.rows[0];

  try {
    const newPost = await pool.query(
      `INSERT INTO abukonn.posts
         (user_id, content, image_url, category, is_repost, original_post_id, original_author_name)
       VALUES ($1, $2, $3, $4, TRUE, $5, $6)
       RETURNING *`,
      [
        userId,
        original.content,
        original.image_url,
        original.category || 'GENERAL',
        original.id,
        original.author_name,
      ]
    );
    await pool.query(
      `UPDATE abukonn.posts SET repost_count = COALESCE(repost_count, 0) + 1 WHERE id = $1`,
      [original.id]
    );
    return newPost.rows[0];
  } catch (err) {
    if (err.code === '23505') { // unique_violation -- lost the race, someone else's request won
      const row = await pool.query(
        `SELECT * FROM abukonn.posts WHERE user_id = $1 AND is_repost = TRUE AND original_post_id = $2`,
        [userId, original.id]
      );
      if (row.rows.length > 0) return row.rows[0];
    }
    throw err;
  }
}

// Removes the current user's repost of this original (a no-op, not an
// error, if they don't have one) and decrements the canonical original's
// repost_count to match. Resolves canonical the same way repostPost does,
// so calling this with either the original's id or any repost's id un-
// reposts the same underlying thing.
async function unrepostPost(originalPostId, userId) {
  const target = await getPostById(originalPostId);
  if (!target) throw new Error('Post not found');
  const original = await resolveCanonicalPost(target);

  const deleted = await pool.query(
    `DELETE FROM abukonn.posts WHERE user_id = $1 AND is_repost = TRUE AND original_post_id = $2 RETURNING id`,
    [userId, original.id]
  );
  if (deleted.rows.length > 0) {
    await pool.query(
      `UPDATE abukonn.posts SET repost_count = GREATEST(COALESCE(repost_count, 0) - 1, 0) WHERE id = $1`,
      [original.id]
    );
  }
}

async function incrementViewCount(postId) {
  await pool.query(
    `UPDATE abukonn.posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = $1`,
    [postId]
  );
}

async function deletePost(id) {
  const result = await pool.query(
    'DELETE FROM abukonn.posts WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0] || null;
}

// Edit-after-publish: updates only the text/caption and stamps edited_at.
// Ownership is enforced in the controller before this runs. Media, category,
// subtype, poll options etc. are intentionally not touched -- this is a
// caption edit, not a full re-compose.
async function updatePostContent(id, content) {
  const result = await pool.query(
    `UPDATE abukonn.posts SET content = $1, edited_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING *`,
    [content, id]
  );
  return result.rows[0] || null;
}

async function votePoll(postId, userId, optionId) {
  const { rows } = await pool.query('SELECT poll_ends_at FROM abukonn.posts WHERE id = $1', [postId]);
  if (!rows[0]) throw new Error('Post not found');
  if (rows[0].poll_ends_at && new Date(rows[0].poll_ends_at) < new Date()) {
    throw new Error('Poll has ended');
  }
  await pool.query(
    'INSERT INTO abukonn.poll_votes (post_id, user_id, option_id) VALUES ($1, $2, $3)',
    [postId, userId, optionId]
  );
  await pool.query('UPDATE abukonn.poll_options SET vote_count = vote_count + 1 WHERE id = $1', [optionId]);
}

// Who voted for what on a poll — grouped by option. Owner-only (enforced in
// the controller). Returns each option with the list of voters.
async function getPollVoters(postId) {
  const { rows } = await pool.query(
    `SELECT po.id AS option_id, po.option_text,
            COALESCE(
              json_agg(
                json_build_object('user_id', u.id, 'full_name', u.full_name,
                                  'profile_photo_url', u.profile_photo_url,
                                  'department', u.department)
                ORDER BY u.full_name
              ) FILTER (WHERE u.id IS NOT NULL),
              '[]'
            ) AS voters
     FROM abukonn.poll_options po
     LEFT JOIN abukonn.poll_votes pv ON pv.option_id = po.id
     LEFT JOIN abukonn.users u ON pv.user_id = u.id
     WHERE po.post_id = $1
     GROUP BY po.id, po.option_text
     ORDER BY po.id`,
    [postId]
  );
  return rows;
}

async function toggleEventRSVP(postId, userId) {
  const { rows } = await pool.query(
    'SELECT id FROM abukonn.event_rsvps WHERE post_id = $1 AND user_id = $2',
    [postId, userId]
  );
  if (rows.length > 0) {
    await pool.query('DELETE FROM abukonn.event_rsvps WHERE post_id = $1 AND user_id = $2', [postId, userId]);
    await pool.query('UPDATE abukonn.posts SET event_rsvp_count = GREATEST(COALESCE(event_rsvp_count,0) - 1, 0) WHERE id = $1', [postId]);
    return { attending: false };
  }
  await pool.query('INSERT INTO abukonn.event_rsvps (post_id, user_id) VALUES ($1, $2)', [postId, userId]);
  await pool.query('UPDATE abukonn.posts SET event_rsvp_count = COALESCE(event_rsvp_count, 0) + 1 WHERE id = $1', [postId]);
  return { attending: true };
}

module.exports = {
  CREATE_POSTS_TABLE,
  createPostsTable,
  createPostLikesTable,
  createPostMediaTable,
  createPost,
  getPostMedia,
  getMediaForPosts,
  getAllPosts,
  getForYouFeed,
  getFollowingPosts,
  getPostsByUserId,
  getPostById,
  resolveCanonicalPost,
  getPostByIdForUser,
  toggleLike,
  incrementCommentsCount,
  decrementCommentsCount,
  repostPost,
  unrepostPost,
  incrementViewCount,
  deletePost,
  updatePostContent,
  votePoll,
  getPollVoters,
  toggleEventRSVP,
};
