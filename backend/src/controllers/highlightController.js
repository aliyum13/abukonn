const { getActiveHighlights, getAllHighlights, createHighlight, updateHighlight, deleteHighlight } = require('../models/Highlight');

const VALID_COLORS = new Set(['blue', 'red', 'orange', 'green', 'purple', 'pink', 'yellow', 'teal', 'gray']);

async function listHighlights(req, res) {
  try {
    const highlights = await getActiveHighlights();
    res.json({ highlights });
  } catch (err) {
    console.error('List highlights error:', err.message);
    res.status(500).json({ message: 'Server error fetching highlights' });
  }
}

async function adminListHighlights(req, res) {
  try {
    const highlights = await getAllHighlights();
    res.json({ highlights });
  } catch (err) {
    console.error('Admin list highlights error:', err.message);
    res.status(500).json({ message: 'Server error fetching highlights' });
  }
}

async function createHighlightHandler(req, res) {
  try {
    const { title, description, type, icon, color, start_date, end_date, priority } = req.body;
    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });
    if (!type?.trim()) return res.status(400).json({ message: 'Type/category is required' });
    if (color && !VALID_COLORS.has(color)) return res.status(400).json({ message: 'Invalid color' });
    const highlight = await createHighlight({
      title: title.trim(),
      description: description?.trim() || null,
      type: type.trim().toLowerCase(),
      icon: icon?.trim() || '📌',
      color: color || 'blue',
      startDate: start_date || null,
      endDate: end_date || null,
      priority: parseInt(priority) || 0,
      createdBy: req.user.id,
    });
    res.status(201).json({ highlight });
  } catch (err) {
    console.error('Create highlight error:', err.message);
    res.status(500).json({ message: 'Server error creating highlight' });
  }
}

async function updateHighlightHandler(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { title, description, type, icon, color, start_date, end_date, priority, is_active } = req.body;
    if (color !== undefined && color !== null && !VALID_COLORS.has(color)) {
      return res.status(400).json({ message: 'Invalid color' });
    }
    const highlight = await updateHighlight(id, {
      title: title?.trim(),
      description: description?.trim(),
      type: type?.trim().toLowerCase(),
      icon: icon?.trim(),
      color,
      startDate: start_date,
      endDate: end_date,
      priority: priority !== undefined ? parseInt(priority) : undefined,
      isActive: is_active,
    });
    if (!highlight) return res.status(404).json({ message: 'Highlight not found' });
    res.json({ highlight });
  } catch (err) {
    console.error('Update highlight error:', err.message);
    res.status(500).json({ message: 'Server error updating highlight' });
  }
}

async function deleteHighlightHandler(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const deleted = await deleteHighlight(id);
    if (!deleted) return res.status(404).json({ message: 'Highlight not found' });
    res.json({ message: 'Highlight deleted' });
  } catch (err) {
    console.error('Delete highlight error:', err.message);
    res.status(500).json({ message: 'Server error deleting highlight' });
  }
}

module.exports = { listHighlights, adminListHighlights, createHighlightHandler, updateHighlightHandler, deleteHighlightHandler };
