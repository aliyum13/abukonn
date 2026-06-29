const Timetable = require('../models/Timetable');
const User = require('../models/User');

const VALID_DAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

function parseCSV(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle quoted fields naively (no embedded commas in quotes expected)
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.length < 3) continue;
    const obj = {};
    rawHeaders.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

async function getTodayClasses(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.department || !user.level) {
      console.log('[timetable] user has no department/level:', req.user.id);
      return res.json({ classes: [], day: null, no_profile: true });
    }
    console.log('[timetable] fetching for:', user.department, '|', user.level);
    const result = await Timetable.getTodayClasses(user.department, user.level);
    console.log('[timetable] found', result.classes.length, 'classes for day:', result.day);
    res.json(result);
  } catch (err) {
    console.error('getTodayClasses:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getWeekClasses(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.department || !user.level) {
      return res.json({ classes: [], no_profile: true });
    }
    const classes = await Timetable.getWeekClasses(user.department, user.level);
    res.json({ classes, department: user.department, level: user.level });
  } catch (err) {
    console.error('getWeekClasses:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getTimetableByDeptLevel(req, res) {
  try {
    const { department, level } = req.params;
    const classes = await Timetable.getTimetable(
      decodeURIComponent(department),
      decodeURIComponent(level)
    );
    res.json({ classes });
  } catch (err) {
    console.error('getTimetableByDeptLevel:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function uploadTimetable(req, res) {
  try {
    const { department, level } = req.query;
    if (!department || !level) {
      return res.status(400).json({ message: 'department and level query params are required' });
    }
    if (!req.file) return res.status(400).json({ message: 'CSV file is required' });

    const rows = parseCSV(req.file.buffer);
    if (!rows.length) return res.status(400).json({ message: 'No valid rows found in CSV' });

    const entries = rows
      .filter(r => r.day && r.start_time && r.end_time && r.course_title)
      .map(r => ({
        department,
        level,
        day: r.day?.trim(),
        start_time: r.start_time?.trim(),
        end_time: r.end_time?.trim(),
        course_code: r.course_code?.trim() || null,
        course_title: r.course_title?.trim(),
        venue: r.venue?.trim() || null,
        lecturer: r.lecturer?.trim() || null,
      }))
      .filter(e => VALID_DAYS.has(e.day));

    if (!entries.length) {
      return res.status(400).json({ message: 'No valid entries found. Check day names (Monday-Friday) and required columns.' });
    }

    await Timetable.clearTimetable(department, level);
    await Timetable.bulkInsert(entries, req.user.id);
    await Timetable.saveUploadRecord({
      department, level,
      uploadedBy: req.user.id,
      fileName: req.file.originalname,
      rowCount: entries.length,
    });

    res.json({ message: `Uploaded ${entries.length} classes for ${department} ${level}`, count: entries.length });
  } catch (err) {
    console.error('uploadTimetable:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteTimetable(req, res) {
  try {
    const { department, level } = req.params;
    const dept = decodeURIComponent(department);
    const lvl = decodeURIComponent(level);
    console.log('[deleteTimetable] deleting:', dept, lvl);
    await Timetable.clearTimetable(dept, lvl);
    await Timetable.deleteUploadRecord(dept, lvl);
    console.log('[deleteTimetable] done');
    res.json({ message: 'Timetable deleted' });
  } catch (err) {
    console.error('[deleteTimetable] error:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
}

async function getUploads(req, res) {
  try {
    const uploads = await Timetable.getUploads();
    res.json({ uploads });
  } catch (err) {
    console.error('getUploads:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// Preview CSV without saving
async function previewCSV(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required' });
    const rows = parseCSV(req.file.buffer);
    res.json({ preview: rows.slice(0, 10), total: rows.length });
  } catch (err) {
    console.error('previewCSV:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = {
  getTodayClasses, getWeekClasses, getTimetableByDeptLevel,
  uploadTimetable, deleteTimetable, getUploads, previewCSV,
};


