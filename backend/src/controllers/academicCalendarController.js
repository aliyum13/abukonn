const Calendar = require('../models/AcademicCalendar');

function parseCSV(buffer) {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.length < 2) continue;
    const obj = {};
    rawHeaders.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    rows.push(obj);
  }
  return rows;
}

// Accepts common date formats and returns YYYY-MM-DD or null
function normalizeDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;
  // Already ISO-ish
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or D/M/YYYY
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function normalizeSemester(raw) {
  const s = (raw || '').trim().toLowerCase();
  if (s.startsWith('1') || s.includes('first')) return 'first';
  if (s.startsWith('2') || s.includes('second')) return 'second';
  return null;
}


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

async function previewCSV(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required.' });
    const rows = parseCSV(req.file.buffer);
    const valid = [];
    const errors = [];
    rows.forEach((r, idx) => {
      const semester = normalizeSemester(r.semester);
      const activity = (r.activity || '').trim();
      if (!activity) { errors.push(`Row ${idx + 2}: missing activity`); return; }
      if (!semester) { errors.push(`Row ${idx + 2}: semester must be 'first' or 'second'`); return; }
      valid.push({
        semester,
        activity,
        from_date: normalizeDate(r.from_date || r.from),
        to_date: normalizeDate(r.to_date || r.to),
        period: (r.period || '').trim() || null,
      });
    });
    res.json({ valid, total: valid.length, errors });
  } catch (err) {
    console.error('calendar previewCSV:', err.message);
    res.status(500).json({ message: 'Failed to parse CSV' });
  }
}

async function uploadCSV(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'CSV file is required.' });
    const session = (req.query.session || '').toString().trim();
    if (!session) return res.status(400).json({ message: 'Session is required (e.g. 2025/2026).' });
    const replace = req.query.replace === 'true';

    const rows = parseCSV(req.file.buffer);
    const entries = [];
    rows.forEach((r) => {
      const semester = normalizeSemester(r.semester);
      const activity = (r.activity || '').trim();
      if (!activity || !semester) return;
      entries.push({
        session,
        semester,
        activity,
        fromDate: normalizeDate(r.from_date || r.from),
        toDate: normalizeDate(r.to_date || r.to),
        period: (r.period || '').trim() || null,
        createdBy: req.user.id,
      });
    });

    if (entries.length === 0) {
      return res.status(400).json({ message: 'No valid rows found. Check that semester is first/second and activity is filled.' });
    }

    if (replace) await Calendar.deleteSession(session);
    const inserted = await Calendar.bulkAddEntries(entries);
    res.status(201).json({ message: `${inserted} entr${inserted === 1 ? 'y' : 'ies'} added to ${session}.`, count: inserted });
  } catch (err) {
    console.error('calendar uploadCSV:', err.message);
    res.status(500).json({ message: 'Failed to upload calendar' });
  }
}

module.exports = { getCalendar, getSessions, addEntry, updateEntry, deleteEntry, deleteSession, previewCSV, uploadCSV };
