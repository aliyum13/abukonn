const Story = require('../models/Story');
const { findOrCreateConversation, sendMessage } = require('../models/Message');
const cloudinary = require('../config/cloudinary');

const CLOUDINARY_TIMEOUT_MS = 120000;

function streamUpload(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

async function uploadToCloudinary(buffer, mimetype) {
  // Video uploads deferred to Phase 2 — always use image resource type
  console.log('[Cloudinary] uploading via stream', { mimetype, bufferLength: buffer.length });
  return streamUpload(buffer, {
    folder: 'abukonn/stories',
    resource_type: 'image',
    timeout: CLOUDINARY_TIMEOUT_MS,
  });
}

const ALLOWED_UPLOAD_FOLDERS = new Set(['abukonn/stories', 'abukonn/posts', 'abukonn/messages', 'abukonn/files']);

async function getUploadSignature(req, res) {
  try {
    const requested = typeof req.query.folder === 'string' ? req.query.folder : 'abukonn/stories';
    const folder = ALLOWED_UPLOAD_FOLDERS.has(requested) ? requested : 'abukonn/stories';
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      process.env.CLOUDINARY_API_SECRET
    );
    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    });
  } catch (err) {
    console.error('Signature error:', err.message);
    res.status(500).json({ message: 'Failed to generate upload signature' });
  }
}

async function createStory(req, res) {
  try {
    const storyType = req.body?.story_type;
    const caption = (req.body?.caption || '').trim().slice(0, 150) || null;

    if (storyType === 'text') {
      const textContent = (req.body?.text_content || '').trim();
      const bgColor = req.body?.bg_color || '#16a34a';
      if (!textContent) return res.status(400).json({ message: 'Text content is required' });
      const story = await Story.createStory({
        userId: req.user.id,
        mediaUrl: null,
        mediaType: null,
        storyType: 'text',
        textContent,
        bgColor,
        // No caption for text stories — the text content is the story
      });
      return res.status(201).json({ story });
    }

    // Direct upload: image was uploaded straight to Cloudinary from the browser
    if (req.body?.direct_upload) {
      const mediaUrl = req.body?.media_url;
      if (!mediaUrl) return res.status(400).json({ message: 'media_url is required for direct upload' });
      const story = await Story.createStory({
        userId: req.user.id,
        mediaUrl,
        mediaType: 'image',
        storyType: 'image',
        caption,
      });
      return res.status(201).json({ story });
    }

    if (!req.file) return res.status(400).json({ message: 'Media file is required' });

    // Reject video at the controller level even if somehow past middleware
    if (req.file.mimetype.startsWith('video/')) {
      return res.status(400).json({ message: 'Video stories are coming in Phase 2. Only image stories are supported for now.' });
    }

    let result;
    try {
      result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    } catch (uploadErr) {
      console.error('[Cloudinary] upload error:', uploadErr);
      return res.status(500).json({ message: 'Failed to upload image' });
    }

    const story = await Story.createStory({
      userId: req.user.id,
      mediaUrl: result.secure_url,
      mediaType: 'image',
      storyType: 'image',
      caption,
    });
    res.status(201).json({ story });
  } catch (err) {
    console.error('Create story error:', err.message);
    res.status(500).json({ message: 'Server error uploading story' });
  }
}

async function getStories(req, res) {
  try {
    const rows = await Story.getActiveStoriesForUser(req.user.id);
    // Group by user — own stories appear first (handled in SQL)
    const map = new Map();
    for (const s of rows) {
      if (!map.has(s.user_id)) {
        map.set(s.user_id, {
          user_id: s.user_id,
          user_name: s.user_name,
          user_photo: s.user_photo,
          is_own: s.user_id === req.user.id,
          stories: [],
        });
      }
      map.get(s.user_id).stories.push(s);
    }
    res.json({ groups: Array.from(map.values()) });
  } catch (err) {
    console.error('Get stories error:', err.message);
    res.status(500).json({ message: 'Server error fetching stories' });
  }
}

async function getMyStories(req, res) {
  try {
    const stories = await Story.getMyActiveStories(req.user.id);
    res.json({ stories });
  } catch (err) {
    console.error('Get my stories error:', err.message);
    res.status(500).json({ message: 'Server error fetching stories' });
  }
}

async function deleteStory(req, res) {
  try {
    const storyId = parseInt(req.params.id, 10);
    const deleted = await Story.deleteStory(storyId, req.user.id);
    if (!deleted) return res.status(404).json({ message: 'Story not found or unauthorized' });
    res.json({ message: 'Story deleted' });
  } catch (err) {
    console.error('Delete story error:', err.message);
    res.status(500).json({ message: 'Server error deleting story' });
  }
}

async function reactToStory(req, res) {
  try {
    const storyId = parseInt(req.params.id, 10);
    const result = await Story.toggleStoryReaction(storyId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('React to story error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getReactionsHandler(req, res) {
  try {
    const storyId = parseInt(req.params.id, 10);
    const result = await Story.getStoryReactions(storyId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Get story reactions error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function replyToStory(req, res) {
  try {
    const storyId = parseInt(req.params.id, 10);
    const content = (req.body?.content || '').trim();
    if (!content) return res.status(400).json({ message: 'Reply content is required' });

    const story = await Story.getStoryById(storyId);
    if (!story) return res.status(404).json({ message: 'Story not found' });

    const reply = await Story.createStoryReply(storyId, req.user.id, content);

    if (story.user_id !== req.user.id) {
      const conv = await findOrCreateConversation(req.user.id, story.user_id);
      const dmContent = JSON.stringify({
        type: 'story_reply',
        story_id: story.id,
        story_type: story.story_type,
        media_url: story.media_url || null,
        text_content: story.text_content || null,
        bg_color: story.bg_color || null,
        reply: content,
      });
      await sendMessage({ conversationId: conv.id, senderId: req.user.id, content: dmContent });
    }

    res.status(201).json({ reply });
  } catch (err) {
    console.error('Reply to story error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getStoryRepliesHandler(req, res) {
  try {
    const storyId = parseInt(req.params.id, 10);
    const replies = await Story.getStoryReplies(storyId);
    res.json({ replies });
  } catch (err) {
    console.error('Get story replies error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function recordView(req, res) {
  try {
    const storyId = parseInt(req.params.id, 10);
    const story = await Story.getStoryById(storyId);
    if (!story) return res.status(404).json({ message: 'Story not found' });
    if (story.user_id !== req.user.id) {
      await Story.recordStoryView(storyId, req.user.id);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('Record story view error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getUploadSignature, createStory, getStories, getMyStories, deleteStory, reactToStory, getReactionsHandler, replyToStory, getStoryRepliesHandler, recordView };
