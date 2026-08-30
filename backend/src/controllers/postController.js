const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Reply = require('../models/Reply');
const Notification = require('../models/Notification');
const Follow = require('../models/Follow');
const { emitNotification, emitNotificationToMany } = require('../lib/notify');
const Hashtag = require('../models/Hashtag');
const PostView = require('../models/PostView');
const { isBlocked } = require('../models/ReportBlock');
const { resolveMentions } = require('../utils/mentions');
const cloudinary = require('../config/cloudinary');

// Attaches each post's media[] (from post_media, Layer 1's d0bb8dc) onto the
// array in place, in one batched query rather than one per post. A post with
// no post_media rows (the common case today, and every legacy post) gets an
// empty array rather than undefined, so clients can render `post.media` the
// same way regardless of whether it's populated -- no `post.media ?? []`
// scattered through every render site.
async function attachMedia(posts) {
  if (!posts || posts.length === 0) return posts;
  // A repost carries no post_media rows of its own -- the media lives on the
  // ORIGINAL post. So for reposts we look up media by original_post_id and
  // attach the original's media to the repost card. (Legacy single image_url
  // is already copied onto the repost row by repostPost, so this only matters
  // for the newer multi-image/video posts.)
  const idsToFetch = new Set();
  for (const p of posts) {
    idsToFetch.add(p.id);
    if (p.is_repost && p.original_post_id) idsToFetch.add(p.original_post_id);
  }
  const byPost = await Post.getMediaForPosts([...idsToFetch]);
  for (const post of posts) {
    const ownMedia = byPost[post.id] || [];
    if (ownMedia.length === 0 && post.is_repost && post.original_post_id) {
      post.media = byPost[post.original_post_id] || [];
    } else {
      post.media = ownMedia;
    }
  }
  return posts;
}
const pool = require('../config/db');

async function uploadBufferToCloudinary(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'abukonn/posts', resource_type: 'image', timeout: 120000 },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function createPost(req, res) {
  try {
    const content = req.body.content || '';
    const postSubtype = (req.body.post_subtype || 'post').toLowerCase();
    const discussionTitle = req.body.discussion_title?.trim() || null;

    if (postSubtype === 'discussion' || postSubtype === 'question') {
      if (!discussionTitle) return res.status(400).json({ message: 'Title is required' });
    } else if (postSubtype === 'poll') {
      // poll_options is JSON string from FormData
    } else if (postSubtype === 'event') {
      if (!req.body.event_title?.trim()) return res.status(400).json({ message: 'Event title is required' });
      // Mobile's event-date field used to be free text (no picker), so an
      // unparseable string (natural-language dates, 12-hour "3:00 PM" with no
      // seconds, wrong field order) went straight into a TIMESTAMP WITH TIME
      // ZONE column with zero validation -- Postgres rejected the INSERT and
      // the whole request surfaced as an opaque 500, while web's native
      // datetime-local picker can never produce an invalid string in the
      // first place. Validate here so a bad date is a clear 400 regardless of
      // which client (or a future one) sent it, rather than a server error.
      if (req.body.event_date && isNaN(new Date(req.body.event_date).getTime())) {
        return res.status(400).json({ message: 'Invalid event date' });
      }
    } else {
      // A plain post needs EITHER text or an attached image/media -- not
      // necessarily both. This required non-empty content unconditionally,
      // so a single-image-no-caption post (both composers already allow
      // submitting one -- their own client-side check is
      // !text && !media, same as this) was rejected here regardless. Checked
      // against the raw request fields since imageUrl/media aren't parsed
      // into local vars until just below this block.
      const hasMedia = !!(req.body.image_url || req.file || req.body.media);
      if (!content.trim() && !hasMedia) return res.status(400).json({ message: 'Post content is required' });
    }

    let imageUrl = null;
    if (req.body.image_url) {
      // Direct Cloudinary upload from frontend (bypasses Railway timeout)
      imageUrl = req.body.image_url;
    } else if (req.file) {
      // Fallback: file uploaded through Railway
      const result = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
      imageUrl = result.secure_url;
    }

    // Multi-media (Pro feature): up to 3 images/video, any mix, uploaded
    // direct-to-Cloudinary client-side (web/mobile's uploadMedia) -- this
    // endpoint only ever receives the resulting URLs, never a file, so
    // there's no Railway-timeout risk here regardless of how many/how large.
    //
    // media is JSON from FormData, same pattern as poll_options above. A
    // post uses EITHER media[] OR the legacy single image_url, never both --
    // if media[] is present it takes priority and imageUrl is dropped, so a
    // client can't accidentally double up.
    //
    // PRO-GATE INSERTION POINT: once is_pro exists (Paystack work), the
    // check goes right here --
    //   if (media && media.length > 0 && !req.user.is_pro)
    //     return res.status(403).json({ message: 'Multi-media posts are a Pro feature.' });
    // Left unenforced for now (Option A per user's decision) -- the feature
    // is fully built and functional, just not yet paywalled.
    // Multi-media posts are Pro-only (all-or-nothing, per launch decision):
    // a free user can't attach any media[] items. Uses the authoritative
    // fresh-from-DB isUserPro check (NOT req.user.is_pro, which comes from the
    // JWT signed at login and would be stale after an upgrade/lapse).
    let media = null;
    if (req.body.media) {
      try { media = JSON.parse(req.body.media); } catch { media = null; }
    }
    // Pro gate (Option 1): a SINGLE IMAGE is free (the baseline everyone has
    // always had -- the composers send even single photos through media[],
    // so gating all of media[] blocked ordinary photo posts entirely). What's
    // Pro is genuine multi-media: more than one item, OR any video. Uses the
    // authoritative fresh-from-DB isUserPro check (NOT req.user.is_pro, which
    // comes from the JWT signed at login and would be stale).
    let isPro = false;
    if (Array.isArray(media) && media.length > 0) {
      const isMultiOrVideo = media.length > 1 || media.some(m => m?.media_type === 'video');
      if (isMultiOrVideo) {
        isPro = await User.isProFeatureUnlocked(req.user.id);
        if (!isPro) {
          return res.status(403).json({ message: 'Posting multiple photos or a video is a Pro feature.' });
        }
      }
    }
    if (Array.isArray(media) && media.length > 0) {
      if (media.length > 3) {
        return res.status(400).json({ message: 'A post can have up to 3 photos/videos.' });
      }
      // Server-side duration backstop for the "increased upload limits" perk.
      // Free = 180s, Pro = 360s -- must stay in step with LIMITS in BOTH
      // web/src/lib/upload.ts and mobile/src/lib/upload.ts. Authoritative
      // check (a client could bypass the pre-flight one in uploadMedia).
      // isPro already resolved above.
      const maxVideoSeconds = isPro ? 360 : 180;
      for (const item of media) {
        if (!item?.media_url || !['image', 'video'].includes(item?.media_type)) {
          return res.status(400).json({ message: 'Each media item needs a media_url and a valid media_type.' });
        }
        if (item.media_type === 'video' && item.duration_seconds != null && item.duration_seconds > maxVideoSeconds) {
          return res.status(400).json({ message: `Videos can be up to ${maxVideoSeconds} seconds long.` });
        }
      }
      imageUrl = null; // media[] supersedes the legacy single-image field
    } else {
      media = null;
    }

    const category = (req.body.category || 'GENERAL').toUpperCase();
    let pollOptions = null;
    if (req.body.poll_options) {
      try { pollOptions = JSON.parse(req.body.poll_options); } catch { pollOptions = null; }
    }

    const post = await Post.createPost({
      userId: req.user.id,
      content: content.trim(),
      imageUrl,
      category,
      postSubtype,
      discussionTitle,
      pollOptions,
      pollDurationHours: req.body.poll_duration_hours ? parseInt(req.body.poll_duration_hours) : null,
      eventTitle: req.body.event_title?.trim() || null,
      eventDate: req.body.event_date || null,
      eventLocation: req.body.event_location?.trim() || null,
      media,
    });

    const textToIndex = `${discussionTitle || ''} ${content.trim()}`.trim();
    if (textToIndex) {
      Hashtag.indexPostHashtags(post.id, textToIndex).catch(err =>
        console.error('Hashtag indexing error:', err.message)
      );
    }

    if (textToIndex) {
      resolveMentions(textToIndex, req.user.id)
        .then(async mentioned => {
          await Promise.all(mentioned.map(u =>
            Notification.createNotification({ recipientId: u.id, senderId: req.user.id, type: 'mention', postId: post.id })
          ));
          emitNotificationToMany(req.app, mentioned.map(u => u.id), {
            title: 'ABUkonn',
            body: '{name} mentioned you',
            senderId: req.user.id,
            data: { type: 'post', postId: post.id },
          });
        })
        .catch(err => console.error('Mention notification error:', err.message));
    }

    // Notify followers who turned the bell ON for this author. Fire-and-forget
    // so a large follower list never slows down posting. Events get their own
    // type so the notification can read "posted an event".
    {
      const activityType = (postSubtype === 'event') ? 'new_event' : 'new_post';
      Follow.getNotifyFollowerIds(req.user.id)
        .then(async ids => {
          await Notification.createNotificationsForMany({
            recipientIds: ids,
            senderId: req.user.id,
            type: activityType,
            postId: post.id,
          });
          emitNotificationToMany(req.app, ids, {
            title: 'ABUkonn',
            body: activityType === 'new_event'
              ? '{name} created an event'
              : '{name} shared a new post',
            senderId: req.user.id,
            data: { type: 'post', postId: post.id },
          });
        })
        .catch(err => console.error('Post notification fan-out error:', err.message));
    }

    const fullPost = await Post.getPostById(post.id);
    res.status(201).json({ message: 'Post created', post: fullPost });
  } catch (err) {
    console.error('Create post error:', err.message);
    res.status(500).json({ message: 'Server error creating post' });
  }
}

async function voteOnPoll(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const optionId = parseInt(req.body.option_id, 10);
    if (!optionId) return res.status(400).json({ message: 'option_id is required' });
    await Post.votePoll(postId, req.user.id, optionId);
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'Poll has ended') return res.status(400).json({ message: err.message });
    if (err.code === '23505') return res.status(409).json({ message: 'Already voted' });
    console.error('voteOnPoll error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Owner-only: who voted for each option on a poll.
async function getPollVotersHandler(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const post = await Post.getPostById(postId);
    if (!post) return res.status(404).json({ message: 'Post not found' });
    // Only the poll's creator can see who voted.
    if (post.user_id !== req.user.id) {
      return res.status(403).json({ message: 'Only the poll creator can see who voted' });
    }
    const options = await Post.getPollVoters(postId);
    res.json({ options });
  } catch (err) {
    console.error('getPollVoters error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function toggleRSVP(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const result = await Post.toggleEventRSVP(postId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('toggleRSVP error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function setBestAnswer(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const commentId = parseInt(req.params.commentId, 10);
    await Comment.markBestAnswer(commentId, postId, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'Unauthorized') return res.status(403).json({ message: 'Only the post owner can mark the best answer' });
    console.error('setBestAnswer error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getFeed(req, res) {
  try {
    // Paginated: the feed query runs correlated subqueries per row, so returning
    // every post at once got linearly slower as content accumulated. Default 20.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    // Client-supplied session anchor (epoch ms) -- same value across one
    // scroll session's page 1 + all its loadMore() calls. See
    // Post.getForYouFeed's sessionStart doc comment for why. Absent/invalid
    // falls back to null, which getForYouFeed treats as "no session" (today's
    // exact prior behavior).
    const sessionStart = req.query.session_start ? parseInt(req.query.session_start, 10) : null;
    // "For You" v2: freshness-first ranking (every new post gets a chance),
    // following + capped trending, own recent posts on top, seen-demoted so
    // refresh brings newer content. Returns an "exhausted" flag when there are
    // no more unseen posts -- the client shows "you're all caught up".
    const { posts, exhausted } = await Post.getForYouFeed(req.user.id, limit, offset, Number.isFinite(sessionStart) ? sessionStart : null);
    await attachMedia(posts);
    // hasMore is PURELY a pagination signal: a full page means there is very
    // likely another one behind it. caughtUp used to be ANDed in here, which
    // made "you've seen everything new" also mean "stop paginating" -- the
    // feed hard-stopped the moment the unseen pool ran out, even though the
    // ranked pool still had days of (already-seen) posts left to scroll. The
    // two states are now independent, and the client renders them separately:
    //   caughtUp && hasMore -> "all caught up" divider, scrolling continues
    //   !hasMore            -> real end of feed (terminal message)
    // getForYouFeed already sorts seen posts below unseen ones, so everything
    // past the divider is the demoted tail -- exactly what should come next.
    res.json({ posts, page, limit, hasMore: posts.length === limit, caughtUp: exhausted });
  } catch (err) {
    console.error('Get feed error:', err.message);
    res.status(500).json({ message: 'Server error fetching feed' });
  }
}

async function getFollowingFeed(req, res) {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * limit;
    const posts = await Post.getFollowingPosts(req.user.id, limit, offset);
    await attachMedia(posts);
    res.json({ posts, page, limit, hasMore: posts.length === limit });
  } catch (err) {
    console.error('Get following feed error:', err.message);
    res.status(500).json({ message: 'Server error fetching following feed' });
  }
}

async function getSinglePost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const post = await Post.getPostByIdForUser(postId, req.user.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    // Don't let blocked users (either direction) view each other's posts
    const [blockedThem, blockedByThem] = await Promise.all([
      isBlocked(req.user.id, post.user_id),
      isBlocked(post.user_id, req.user.id),
    ]);
    if (blockedThem || blockedByThem) {
      return res.status(404).json({ message: 'Post not found' });
    }

    await attachMedia([post]);
    res.json({ post });
  } catch (err) {
    console.error('Get single post error:', err.message);
    res.status(500).json({ message: 'Server error fetching post' });
  }
}

async function likePost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const existing = await Post.getPostById(postId);

    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Reposts must never fork engagement -- resolve to the one true original
    // (walks any pre-existing repost chains, stops safely if that original
    // was deleted) before writing anything.
    const canonical = await Post.resolveCanonicalPost(existing);
    const viaRepost = canonical.id !== existing.id;
    const likeBody = viaRepost ? '{name} liked your post via a repost' : '{name} liked your post';

    const { post, is_liked } = await Post.toggleLike(canonical.id, req.user.id);

    // Notify the ORIGINAL author, not whoever posted the repost being
    // viewed -- and say so when it happened via a repost, rather than
    // reading like a like on a brand new post.
    if (is_liked && canonical.user_id !== req.user.id) {
      Notification.createNotification({
        recipientId: canonical.user_id,
        senderId: req.user.id,
        type: 'like',
        postId: canonical.id,
      })
        .then(() => emitNotification(req.app, canonical.user_id, {
          title: 'ABUkonn',
          body: likeBody,
          senderId: req.user.id,
          data: { type: 'post', postId: canonical.id },
        }))
        .catch(() => {});
    }

    res.json({ message: is_liked ? 'Post liked' : 'Post unliked', post, is_liked });
  } catch (err) {
    console.error('Like post error:', err.message);
    res.status(500).json({ message: 'Server error liking post' });
  }
}

async function getComments(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const existing = await Post.getPostById(postId);
    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }
    // Same resolution as addComment -- a repost's comment thread IS the
    // original's, not a separate one.
    const canonical = await Post.resolveCanonicalPost(existing);
    const comments = await Comment.getCommentsByPost(canonical.id, req.user.id);
    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err.message);
    res.status(500).json({ message: 'Server error fetching comments' });
  }
}

// Toggle a like on a comment
async function likeCommentHandler(req, res) {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    const result = await Comment.toggleCommentLike(commentId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Like comment error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Delete own comment (author only)
async function deleteCommentHandler(req, res) {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    const deleted = await Comment.deleteComment(commentId, req.user.id);
    if (!deleted) {
      return res.status(403).json({ message: 'You can only delete your own comment' });
    }
    // Keep the post's comment count in sync
    await Post.decrementCommentsCount(deleted.post_id);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete comment error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function addComment(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const existing = await Post.getPostById(postId);
    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Comments made on a repost must land on the original's own thread --
    // otherwise they'd only ever be visible on that one specific repost,
    // invisible everywhere else the original (or any other repost of it) is
    // viewed. Resolve first, same as likePost.
    const canonical = await Post.resolveCanonicalPost(existing);
    const viaRepost = canonical.id !== existing.id;

    const comment = await Comment.createComment({
      postId: canonical.id,
      userId: req.user.id,
      content: content.trim(),
    });

    await Post.incrementCommentsCount(canonical.id);
    const post = await Post.getPostById(canonical.id);

    // Notify the ORIGINAL author, not whoever posted the repost being
    // viewed -- and say so when it happened via a repost.
    if (canonical.user_id !== req.user.id) {
      Notification.createNotification({
        recipientId: canonical.user_id,
        senderId: req.user.id,
        type: 'comment',
        postId: canonical.id,
      })
        .then(() => emitNotification(req.app, canonical.user_id, {
          title: 'ABUkonn',
          body: viaRepost ? '{name} commented on your post via a repost' : '{name} commented on your post',
          senderId: req.user.id,
          data: { type: 'post', postId: canonical.id },
        }))
        .catch(() => {});
    }

    resolveMentions(content.trim(), req.user.id)
      .then(async mentioned => {
        await Promise.all(mentioned.map(u =>
          Notification.createNotification({ recipientId: u.id, senderId: req.user.id, type: 'mention', postId: canonical.id })
        ));
        // Push too, matching how a mention in a POST already behaves -- a
        // mention in a comment was writing the bell notification but sending
        // no push, so an offline/app-closed user never heard about it.
        emitNotificationToMany(req.app, mentioned.map(u => u.id), {
          title: 'ABUkonn',
          body: '{name} mentioned you in a comment',
          senderId: req.user.id,
          data: { type: 'post', postId: canonical.id },
        });
      })
      .catch(err => console.error('Mention notification error:', err.message));

    res.status(201).json({ message: 'Comment added', comment, post });
  } catch (err) {
    console.error('Add comment error:', err.message);
    res.status(500).json({ message: 'Server error adding comment' });
  }
}

async function deletePost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const existing = await Post.getPostById(postId);

    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }

    // Decrement hashtag counts before deleting
    await Hashtag.removePostHashtags(postId).catch(() => {});
    await Post.deletePost(postId);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err.message);
    res.status(500).json({ message: 'Server error deleting post' });
  }
}

// Edit the text/caption of an already-published post. Ownership-checked the
// same way deletePost is. Only the text changes -- media, category, subtype,
// poll/event fields are all left as-is (this is a caption edit, not a
// re-compose). Currently free; PRO-GATE INSERTION POINT: once is_pro exists,
// gate here with `if (!req.user.is_pro) return res.status(403)...`.
async function updatePost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const content = (req.body.content || '').trim();

    if (!content) {
      return res.status(400).json({ message: 'Post text cannot be empty.' });
    }

    // Editing a post after publishing is a Pro feature (fresh-from-DB check).
    if (!(await User.isProFeatureUnlocked(req.user.id))) {
      return res.status(403).json({ message: 'Editing posts after publishing is a Pro feature.' });
    }

    const existing = await Post.getPostById(postId);
    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }
    if (existing.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only edit your own posts' });
    }

    const updated = await Post.updatePostContent(postId, content);

    // Re-sync hashtags to the new text: clear the old set (decrementing their
    // counts) then index the new set. Handles both added and removed tags.
    const textToIndex = `${existing.discussion_title || ''} ${content}`.trim();
    Hashtag.removePostHashtags(postId)
      .then(() => { if (textToIndex) return Hashtag.indexPostHashtags(postId, textToIndex); })
      .catch(err => console.error('Hashtag re-index error on edit:', err.message));

    // Deliberately NOT re-firing mention notifications on edit -- editing a
    // post to @mention someone shouldn't ping them like a fresh mention would
    // (matches how most platforms treat edits; avoids a notification-spam
    // vector via repeated edits).

    res.json({ post: updated });
  } catch (err) {
    console.error('Edit post error:', err.message);
    res.status(500).json({ message: 'Server error editing post' });
  }
}

async function repostPost(req, res) {
  try {
    const originalPostId = parseInt(req.params.id, 10);
    const newPost = await Post.repostPost(originalPostId, req.user.id);
    // The raw INSERT ... RETURNING * has no original_likes_count/
    // original_author_photo/etc -- those only come from the joined feed
    // query. Without this, a freshly-created repost would show 0
    // likes/comments until the next full feed refresh, since the client
    // prefers original_likes_count for reposts and it'd be undefined.
    const full = await Post.getPostByIdForUser(newPost.id, req.user.id);
    res.status(201).json({ message: 'Reposted', post: full || newPost });
  } catch (err) {
    console.error('Repost error:', err.message);
    res.status(500).json({ message: err.message === 'Post not found' ? 'Post not found' : 'Server error' });
  }
}

async function unrepostPost(req, res) {
  try {
    const originalPostId = parseInt(req.params.id, 10);
    await Post.unrepostPost(originalPostId, req.user.id);
    res.json({ message: 'Repost removed' });
  } catch (err) {
    console.error('Unrepost error:', err.message);
    res.status(500).json({ message: err.message === 'Post not found' ? 'Post not found' : 'Server error' });
  }
}

async function viewPost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const existing = await Post.getPostById(postId);
    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const canonical = await Post.resolveCanonicalPost(existing);
    await Post.incrementViewCount(canonical.id);
    // Real unique-viewer tracking for post analytics (Pro perk) -- separate
    // from the raw view_count increment above, which stays untouched since
    // it feeds engagement_score/trending. Same canonical-post resolution so
    // a repost's views count toward the original, consistent with likes/
    // comments/view_count. Fire-and-forget: never let this slow down or
    // fail the view-tracking response itself.
    PostView.recordView(req.user.id, canonical.id).catch(err =>
      console.error('Post view recording error:', err.message)
    );
    res.json({ message: 'Viewed' });
  } catch (err) {
    console.error('View post error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Post analytics — Pro perk. Aggregate numbers only (view_count, unique
// viewers, likes/comments/reposts), deliberately NOT a per-viewer identity
// list -- confirmed with Ali: unlike profile views, a post can rack up
// hundreds of views, so "who viewed this" is both a heavier privacy ask and
// not what "post analytics" as a paid perk usually means on other
// platforms (Instagram/X analytics are aggregate too, not a viewer list).
//
// Reuses the existing getPostsByUserId (same rich shape the profile page
// already renders: polls, events, media, etc.) rather than a new query, then
// attaches unique_viewers in one batched call -- everything else
// (view_count, likes_count, comments_count, repost_count) is already on
// each post from that query, so this endpoint's only real addition is the
// unique-viewer number PostView tracks separately from the raw counter.
//
// PRO-GATE INSERTION POINT: once is_pro exists, add
//   if (!req.user.is_pro) return res.status(403).json({ message: 'Post analytics is a Pro feature.' });
// Left unenforced for now (Option A, matching every other Pro candidate).
async function getPostAnalytics(req, res) {
  try {
    // Post analytics is a Pro feature (fresh-from-DB check).
    if (!(await User.isProFeatureUnlocked(req.user.id))) {
      return res.status(403).json({ message: 'Post analytics is a Pro feature.' });
    }
    const posts = await Post.getPostsByUserId(req.user.id, req.user.id);
    const uniqueCounts = await PostView.getUniqueViewerCounts(posts.map(p => p.id));
    const analytics = posts.map(p => ({
      id: p.id,
      content: p.content,
      image_url: p.image_url,
      created_at: p.created_at,
      view_count: p.view_count || 0,
      unique_viewers: uniqueCounts[p.id] || 0,
      likes_count: p.likes_count || 0,
      comments_count: p.comments_count || 0,
      repost_count: p.repost_count || 0,
    }));
    res.json({ analytics });
  } catch (err) {
    console.error('Get post analytics error:', err.message);
    res.status(500).json({ message: 'Server error fetching post analytics' });
  }
}

async function getReplies(req, res) {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    const replies = await Reply.getRepliesByComment(commentId);
    res.json({ replies });
  } catch (err) {
    console.error('Get replies error:', err.message);
    res.status(500).json({ message: 'Server error fetching replies' });
  }
}

async function addReply(req, res) {
  try {
    const commentId = parseInt(req.params.commentId, 10);
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Reply content is required' });
    }
    const reply = await Reply.createReply({ commentId, userId: req.user.id, content: content.trim() });

    resolveMentions(content.trim(), req.user.id)
      .then(async mentioned => {
        if (mentioned.length === 0) return;
        const { rows } = await pool.query('SELECT post_id FROM abukonn.comments WHERE id = $1', [commentId]);
        const postId = rows[0]?.post_id || null;
        await Promise.all(mentioned.map(u =>
          Notification.createNotification({ recipientId: u.id, senderId: req.user.id, type: 'mention', postId })
        ));
      })
      .catch(err => console.error('Mention notification error:', err.message));

    res.status(201).json({ reply });
  } catch (err) {
    console.error('Add reply error:', err.message);
    res.status(500).json({ message: 'Server error adding reply' });
  }
}

module.exports = { createPost, getFeed, getFollowingFeed, getSinglePost, likePost, addComment, getComments, likeCommentHandler, deleteCommentHandler, deletePost, updatePost, getReplies, addReply, repostPost, unrepostPost, viewPost, voteOnPoll, getPollVotersHandler, toggleRSVP, setBestAnswer, attachMedia, getPostAnalytics };
