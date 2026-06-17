const Post = require('../models/Post');
const Comment = require('../models/Comment');
const cloudinary = require('../config/cloudinary');

async function uploadBufferToCloudinary(buffer, mimetype) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  return cloudinary.uploader.upload(dataUri, {
    folder: 'abukonn/posts',
    resource_type: 'image',
  });
}

async function createPost(req, res) {
  try {
    const content = req.body.content;

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    let imageUrl = null;
    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file.buffer, req.file.mimetype);
      imageUrl = result.secure_url;
    }

    const post = await Post.createPost({
      userId: req.user.id,
      content: content.trim(),
      imageUrl,
    });

    const fullPost = await Post.getPostById(post.id);
    res.status(201).json({ message: 'Post created', post: fullPost });
  } catch (err) {
    console.error('Create post error:', err.message);
    res.status(500).json({ message: 'Server error creating post' });
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

async function likePost(req, res) {
  try {
    const postId = parseInt(req.params.id, 10);
    const existing = await Post.getPostById(postId);

    if (!existing) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const { post, is_liked } = await Post.toggleLike(postId, req.user.id);
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

    await Post.deletePost(postId);
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Delete post error:', err.message);
    res.status(500).json({ message: 'Server error deleting post' });
  }
}

module.exports = { createPost, getFeed, likePost, addComment, getComments, deletePost };
