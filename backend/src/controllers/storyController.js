const Story = require('../models/Story');
const { findOrCreateConversation, sendMessage } = require('../models/Message');
const cloudinary = require('../config/cloudinary');

const CLOUDINARY_TIMEOUT_MS = 90000;

async function uploadToCloudinary(buffer, mimetype) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const resourceType = mimetype.startsWith('video/') ? 'video' : 'image';
  const uploadPromise = cloudinary.uploader.upload(dataUri, {
    folder: 'abukonn/stories',
    resource_type: resourceType,
  });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Cloudinary upload timed out')), CLOUDINARY_TIMEOUT_MS)
  );
  return Promise.race([uploadPromise, timeoutPromise]);
}

async function createStory(req, res) {
  try {
    const storyType = req.body?.story_type;

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
      });
      return res.status(201).json({ story });
    }

    if (!req.file) return res.status(400).json({ message: 'Media file is required' });

    const isVideo = req.file.mimetype.startsWith('video/');
    if (isVideo && req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ message: 'Video must be under 10MB' });
    }

    let result;
    try {
      result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    } catch (uploadErr) {
      console.error('Cloudinary upload error:', uploadErr.message);
      const msg = uploadErr.message === 'Cloudinary upload timed out'
        ? 'Upload timed out — try a shorter video'
        : 'Failed to upload media';
      return res.status(500).json({ message: msg });
    }

    const mediaType = isVideo ? 'video' : 'image';
    const story = await Story.createStory({
      userId: req.user.id,
      mediaUrl: result.secure_url,
      mediaType,
      storyType: mediaType,
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

module.exports = { createStory, getStories, getMyStories, deleteStory, reactToStory, getReactionsHandler, replyToStory, getStoryRepliesHandler, recordView };
