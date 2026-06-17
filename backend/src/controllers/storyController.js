const Story = require('../models/Story');
const cloudinary = require('../config/cloudinary');

async function uploadToCloudinary(buffer, mimetype) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const resourceType = mimetype.startsWith('video') ? 'video' : 'image';
  return cloudinary.uploader.upload(dataUri, {
    folder: 'abukonn/stories',
    resource_type: resourceType,
  });
}

async function createStory(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Media file is required' });
    const result = await uploadToCloudinary(req.file.buffer, req.file.mimetype);
    const mediaType = req.file.mimetype.startsWith('video') ? 'video' : 'image';
    const story = await Story.createStory({
      userId: req.user.id,
      mediaUrl: result.secure_url,
      mediaType,
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

module.exports = { createStory, getStories, deleteStory };
