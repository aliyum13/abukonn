const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reply = require('../models/Reply');
const Notification = require('../models/Notification');
const Hashtag = require('../models/Hashtag');
const { isBlocked } = require('../models/ReportBlock');
const cloudinary = require('../config/cloudinary');

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
    } else {
      if (!content.trim()) return res.status(400).json({ message: 'Post content is required' });
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
    });

    const textToIndex = `${discussionTitle || ''} ${content.trim()}`.trim();
    if (textToIndex) {
      Hashtag.indexPostHashtags(post.id, textToIndex).catch(err =>
        console.error('Hashtag indexing error:', err.message)
      );
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
    const posts = await Post.getAllPosts(req.user.id);
    res.json({ posts });
  } catch (err) {
    console.error('Get feed error:', err.message);
    res.status(500).json({ message: 'Server error fetching feed' });
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

    const { post, is_liked } = await Post.toggleLike(postId, req.user.id);

    // Notify post owner only when liking (not unliking), skip own posts
    if (is_liked && existing.user_id !== req.user.id) {
      Notification.createNotification({
        recipientId: existing.user_id,
        senderId: req.user.id,
        type: 'like',
        postId,
      }).catch(() => {});
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
    const comments = await Comment.getCommentsByPost(postId);
    res.json({ comments });
  } catch (err) {
    console.error('Get comments error:', err.message);
    res.status(500).json({ message: 'Server error fetching comments' });
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

    const comment = await Comment.createComment({
      postId,
      userId: req.user.id,
      content: content.trim(),
    });

    await Post.incrementCommentsCount(postId);
    const post = await Post.getPostById(postId);

    // Notify post owner when someone else comments
    if (existing.user_id !== req.user.id) {
      Notification.createNotification({
        recipientId: existing.user_id,
        senderId: req.user.id,
        type: 'comment',
        postId,
      }).catch(() => {});
    }

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

async function repostPost(req, res) {
  try {
    const originalPostId = parseInt(req.params.id, 10);
    const newPost = await Post.repostPost(originalPostId, req.user.id);
    res.status(201).json({ message: 'Reposted', post: newPost });
  } catch (err) {
    console.error('Repost error:', err.message);
    res.status(500).json({ message: err.message === 'Post not found' ? 'Post not found' : 'Server error' });
  }
}

async function viewPost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    await Post.incrementViewCount(postId);
    res.json({ message: 'Viewed' });
  } catch (err) {
    console.error('View post error:', err.message);
    res.status(500).json({ message: 'Server error' });
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
    res.status(201).json({ reply });
  } catch (err) {
    console.error('Add reply error:', err.message);
    res.status(500).json({ message: 'Server error adding reply' });
  }
}

module.exports = { createPost, getFeed, getSinglePost, likePost, addComment, getComments, deletePost, getReplies, addReply, repostPost, viewPost, voteOnPoll, toggleRSVP, setBestAnswer };
