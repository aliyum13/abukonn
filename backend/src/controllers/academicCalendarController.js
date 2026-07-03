const Calendar = require('../models/AcademicCalendar');

// ── Student-facing ─────────────────────────────────────────────────────────────

async function getCalendar(req, res) {
  try {
    const { session } = req.query;
    if (session) {
      const entries = await Calendar.getEntriesBySession(session);
      return res.json({ session, entries });
    }
    const latest = await Calendar.getLatestCalendar();
    res.json(latest);
  } catch (err) {
    console.error('getCalendar:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getSessions(req, res) {
  try {
    const sessions = await Calendar.getSessions();
    res.json({ sessions });
  } catch (err) {
    console.error('getSessions:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

// ── Admin ──────────────────────────────────────────────────────────────────────

function validSemester(s) {
  return s === 'first' || s === 'second';
}

async function addEntry(req, res) {
  try {
    const { session, semester, activity, from_date, to_date, period, sort_order } = req.body;
    if (!session || !validSemester(semester) || !activity?.trim()) {
      return res.status(400).json({ message: 'session, semester (first/second), and activity are required.' });
    }
    const entry = await Calendar.addEntry({
      session: session.trim(),
      semester,
      activity: activity.trim(),
      fromDate: from_date,
      toDate: to_date,
      period: period?.trim(),
      sortOrder: sort_order,
      createdBy: req.user.id,
    });
    res.status(201).json({ entry });
  } catch (err) {
    console.error('addEntry:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function updateEntry(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    const { semester, activity, from_date, to_date, period, sort_order } = req.body;
    if (semester && !validSemester(semester)) {
      return res.status(400).json({ message: 'semester must be first or second.' });
    }
    const entry = await Calendar.updateEntry(id, {
      semester,
      activity: activity?.trim(),
      fromDate: from_date,
      toDate: to_date,
      period: period?.trim(),
      sortOrder: sort_order,
    });
    if (!entry) return res.status(404).json({ message: 'Entry not found.' });
    res.json({ entry });
  } catch (err) {
    console.error('updateEntry:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteEntry(req, res) {
  try {
    await Calendar.deleteEntry(parseInt(req.params.id, 10));
    res.json({ message: 'Entry deleted.' });
  } catch (err) {
    console.error('deleteEntry:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function deleteSession(req, res) {
  try {
    await Calendar.deleteSession(req.params.session);
    res.json({ message: 'Session deleted.' });
  } catch (err) {
    console.error('deleteSession:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { getCalendar, getSessions, addEntry, updateEntry, deleteEntry, deleteSession };
