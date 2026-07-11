const ClassRep = require('../models/ClassRep');
const TimetableOverride = require('../models/TimetableOverride');

// Confirms the requester reps the given department + level (or is a full admin).
async function canManage(user, department, level) {
  if (user.is_admin) return true;
  return ClassRep.isClassRepFor(user.id, department, level);
}

async function myRepClasses(req, res) {
  try {
    const classes = await ClassRep.getClassRepsForUser(req.user.id);
    res.json({ classes });
  } catch (err) {
    console.error('myRepClasses:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function myOverrides(req, res) {
  try {
    const { department, level } = req.query;
    if (!department || !level) return res.status(400).json({ message: 'department and level required' });
    if (!(await canManage(req.user, department, level))) {
      return res.status(403).json({ message: 'You are not a class rep for this class' });
    }
    const overrides = await TimetableOverride.getUpcomingOverrides(department, level);
    res.json({ overrides });
  } catch (err) {
    console.error('myOverrides:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function createOverride(req, res) {
  try {
    const {
      department, level, override_date, kind, original_class_id,
      start_time, end_time, course_code, course_title, venue, lecturer, note,
    } = req.body;

    if (!department || !level || !override_date || !kind) {
      return res.status(400).json({ message: 'department, level, override_date and kind are required' });
    }
    if (!['add', 'edit', 'cancel'].includes(kind)) {
      return res.status(400).json({ message: 'Invalid kind' });
    }
    if (!(await canManage(req.user, department, level))) {
      return res.status(403).json({ message: 'You are not a class rep for this class' });
    }
    if (new Date(override_date) < new Date(new Date().toDateString())) {
      return res.status(400).json({ message: 'Cannot change a past date' });
    }
    if ((kind === 'add' || kind === 'edit') && (!course_title || !start_time)) {
      return res.status(400).json({ message: 'course_title and start_time are required' });
    }
    if ((kind === 'edit' || kind === 'cancel') && !original_class_id) {
      return res.status(400).json({ message: 'original_class_id is required for edit/cancel' });
    }

    const created = await TimetableOverride.createOverride({
      department, level,
      overrideDate: override_date,
      kind,
      originalClassId: original_class_id || null,
      startTime: start_time || null,
      endTime: end_time || null,
      courseCode: course_code || null,
      courseTitle: course_title || null,
      venue: venue || null,
      lecturer: lecturer || null,
      note: note || null,
      createdBy: req.user.id,
    });

    res.status(201).json({ override: created });
  } catch (err) {
    console.error('createOverride:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteOverride(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await TimetableOverride.getOverrideById(id);
    if (!existing) return res.status(404).json({ message: 'Override not found' });
    if (!(await canManage(req.user, existing.department, existing.level))) {
      return res.status(403).json({ message: 'Not allowed' });
    }
    await TimetableOverride.deleteOverride(id);
    res.json({ ok: true });
  } catch (err) {
    console.error('deleteOverride:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  myRepClasses,
  myOverrides,
  createOverride,
  deleteOverride,
};
