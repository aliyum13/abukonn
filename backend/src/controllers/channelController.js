const Channel = require('../models/Channel');
const Post = require('../models/Post');
const Hashtag = require('../models/Hashtag');
const cloudinary = require('../config/cloudinary');

const VALID_CATEGORIES = ['faculty', 'department', 'interest', 'year'];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function uploadImage(buffer, mimetype) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, { folder: 'abukonn/posts', resource_type: 'image' });
  return result.secure_url;
}

// GET /api/channels
async function listChannels(req, res) {
  try {
    const channels = await Channel.getAllChannels(req.user.id);
    res.json({ channels });
  } catch (err) {
    console.error('listChannels error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/channels/mine
async function listMyChannels(req, res) {
  try {
    const channels = await Channel.getMyChannels(req.user.id);
    res.json({ channels });
  } catch (err) {
    console.error('listMyChannels error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/channels/:slug
async function getChannel(req, res) {
  try {
    const channel = await Channel.getChannelBySlug(req.params.slug, req.user.id);
    if (!channel) return res.status(404).json({ message: 'Channel not found' });
    res.json({ channel });
  } catch (err) {
    console.error('getChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// POST /api/channels
async function createUserChannel(req, res) {
  try {
    const { name, description, icon, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    const slug = slugify(name.trim());
    if (!slug) return res.status(400).json({ message: 'Invalid name' });
    const channel = await Channel.createChannel({
      name: name.trim(), slug, description, icon, category,
      createdBy: req.user.id, isOfficial: false,
    });
    await Channel.joinChannel(channel.id, req.user.id);
    res.status(201).json({ channel });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'A channel with that name already exists' });
    console.error('createUserChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// POST /api/channels/:id/join
async function joinChannel(req, res) {
  try {
    const channelId = parseInt(req.params.id, 10);
    await Channel.joinChannel(channelId, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('joinChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// DELETE /api/channels/:id/leave
async function leaveChannel(req, res) {
  try {
    const channelId = parseInt(req.params.id, 10);
    await Channel.leaveChannel(channelId, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('leaveChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// GET /api/channels/:id/posts
async function getChannelPosts(req, res) {
  try {
    const channelId = parseInt(req.params.id, 10);
    const posts = await Channel.getChannelPosts(channelId, req.user.id);
    res.json({ posts });
  } catch (err) {
    console.error('getChannelPosts error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// POST /api/channels/:id/posts  — create post in channel
async function postToChannel(req, res) {
  try {
    const channelId = parseInt(req.params.id, 10);
    const content = req.body.content || '';
    const postSubtype = (req.body.post_subtype || 'post').toLowerCase();
    const discussionTitle = req.body.discussion_title?.trim() || null;

    if (postSubtype === 'discussion' && !discussionTitle) {
      return res.status(400).json({ message: 'Discussion title is required' });
    }
    if (postSubtype !== 'discussion' && !content.trim()) {
      return res.status(400).json({ message: 'Post content is required' });
    }

    let imageUrl = null;
    if (req.file) imageUrl = await uploadImage(req.file.buffer, req.file.mimetype);

    const category = (req.body.category || 'GENERAL').toUpperCase();
    const post = await Post.createPost({
      userId: req.user.id, content: content.trim(), imageUrl, category,
      postSubtype, discussionTitle,
    });
    await Channel.addPostToChannel(channelId, post.id);

    const textToIndex = postSubtype === 'discussion'
      ? `${discussionTitle} ${content.trim()}`
      : content.trim();
    Hashtag.indexPostHashtags(post.id, textToIndex).catch(() => {});

    const fullPost = await Post.getPostById(post.id);
    res.status(201).json({ post: fullPost });
  } catch (err) {
    console.error('postToChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ── Admin handlers ────────────────────────────────────────────────────────────

async function adminListChannels(req, res) {
  try {
    const channels = await Channel.getAllChannelsAdmin();
    res.json({ channels });
  } catch (err) {
    console.error('adminListChannels error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function adminCreateChannel(req, res) {
  try {
    const { name, description, icon, category, slug: customSlug } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    if (!VALID_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    const slug = customSlug?.trim() || slugify(name.trim());
    const channel = await Channel.createChannel({
      name: name.trim(), slug, description, icon, category,
      createdBy: req.user.id, isOfficial: true,
    });
    res.status(201).json({ channel });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Slug already exists' });
    console.error('adminCreateChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function adminDeleteChannel(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await Channel.deleteChannel(id);
    if (!deleted) return res.status(404).json({ message: 'Channel not found' });
    res.json({ message: 'Channel deleted' });
  } catch (err) {
    console.error('adminDeleteChannel error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  listChannels, listMyChannels, getChannel, createUserChannel,
  joinChannel, leaveChannel, getChannelPosts, postToChannel,
  adminListChannels, adminCreateChannel, adminDeleteChannel,
};
