const pool = require('../config/db');
const { byStartTime, normalizeTime } = require('../lib/time');

const createTimetableTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.timetables (
      id SERIAL PRIMARY KEY,
      department VARCHAR(200) NOT NULL,
      level VARCHAR(50) NOT NULL,
      day VARCHAR(20) NOT NULL,
      start_time VARCHAR(10) NOT NULL,
      end_time VARCHAR(10) NOT NULL,
      course_code VARCHAR(20),
      course_title VARCHAR(200) NOT NULL,
      venue VARCHAR(100),
      lecturer VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'holding' CHECK (status IN ('holding', 'cancelled')),
      created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    ALTER TABLE abukonn.timetables ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'holding'
  `).catch(() => {});
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timetables_status_check'
      ) THEN
        ALTER TABLE abukonn.timetables
        ADD CONSTRAINT timetables_status_check CHECK (status IN ('holding', 'cancelled'));
      END IF;
    END $$;
  `).catch(() => {});
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.timetable_uploads (
      id SERIAL PRIMARY KEY,
      department VARCHAR(200) NOT NULL,
      level VARCHAR(50) NOT NULL,
      uploaded_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      file_name VARCHAR(255),
      row_count INTEGER DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'timetable_uploads_dept_level_unique'
      ) THEN
        ALTER TABLE abukonn.timetable_uploads
        ADD CONSTRAINT timetable_uploads_dept_level_unique
        UNIQUE (department, level);
      END IF;
    END $$;
  `).catch(() => {});
  console.log('Timetable tables ready');
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Normalize level: "300 Level" -> "300" and "300" -> "300 Level" both match
const normalizeLevel = (level) => level ? level.replace(/\s*level\s*/i, '').trim() : level;

const getTodayClasses = async (department, level) => {
  const dayName = DAY_NAMES[new Date().getDay()];
  const normalLevel = normalizeLevel(level);
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.timetables
     WHERE department = $1 
     AND (level = $2 OR level = $3 OR REPLACE(LOWER(level), ' level', '') = $4)
     AND day = $5
     ORDER BY (CASE WHEN start_time ~ '^[0-9]{1,2}:[0-9]{2}' THEN (LPAD(SPLIT_PART(start_time, ':', 1), 2, '0') || ':' || SPLIT_PART(start_time, ':', 2))::time ELSE '00:00'::time END) ASC`,
    [department, level, normalLevel, normalLevel.toLowerCase(), dayName]
  );
  // Safety net: sort in JS too, so ordering is right even for rows stored in
  // 12-hour form that the SQL time-cast would misorder.
  return { classes: [...rows].sort(byStartTime), day: dayName };
};

// Today's classes with any class-rep overrides applied. Each returned class
// carries an `override` field describing the change (edited/cancelled/added)
// so the frontend can show the original struck through + the change. Falls back
// silently to the plain timetable if the overrides table doesn't exist yet.
// Overlays academic-calendar no-class periods (holiday/break/exam) onto a
// list of classes for a specific date. A class already cancelled by a
// timetable_override keeps that override (manual/bulk cancels take precedence
// over the calendar's blanket reason). Otherwise, if the date falls in a
// no-class calendar entry, the class is marked cancelled with the entry's name
// as the reason. Derived live from the calendar (not materialized as override
// rows) so the calendar stays the single source of truth -- edit a break's
// dates and the effect updates automatically.
const applyCalendarClosure = async (classes, date) => {
  let entries = [];
  try {
    const AcademicCalendar = require('./AcademicCalendar');
    entries = await AcademicCalendar.getNoClassEntriesForDate(date);
  } catch {
    return classes; // calendar unavailable -> unchanged
  }
  if (entries.length === 0) return classes;
  // Prefer a break/holiday label if several overlap; any is acceptable.
  const reason = entries[0].activity;
  return classes.map((cls) => {
    if (cls.override) return cls; // manual/bulk override already applied
    return { ...cls, override: { kind: 'cancel', note: reason, source: 'calendar' } };
  });
};

const getTodayClassesWithOverrides = async (department, level) => {
  const base = await getTodayClasses(department, level);
  let overrides = [];
  try {
    const TimetableOverride = require('./TimetableOverride');
    const today = new Date().toISOString().slice(0, 10);
    overrides = await TimetableOverride.getOverridesForDate(department, level, today);
  } catch {
    return base;
  }

  const byOriginal = new Map();
  const additions = [];
  for (const o of overrides) {
    if (o.kind === 'add') additions.push(o);
    else if (o.original_class_id != null) byOriginal.set(o.original_class_id, o);
  }

  const merged = base.classes.map((cls) => {
    const o = byOriginal.get(cls.id);
    if (!o) return { ...cls, override: null };
    if (o.kind === 'cancel') {
      return { ...cls, override: { kind: 'cancel', note: o.note, override_id: o.id } };
    }
    return {
      ...cls,
      override: {
        kind: 'edit',
        override_id: o.id,
        note: o.note,
        new: {
          start_time: o.start_time, end_time: o.end_time,
          course_code: o.course_code, course_title: o.course_title,
          venue: o.venue, lecturer: o.lecturer,
        },
      },
    };
  });

  for (const o of additions) {
    merged.push({
      id: `override-${o.id}`,
      department, level, day: base.day,
      start_time: o.start_time, end_time: o.end_time,
      course_code: o.course_code, course_title: o.course_title,
      venue: o.venue, lecturer: o.lecturer, status: 'holding',
      override: { kind: 'add', override_id: o.id, note: o.note },
    });
  }

  // byStartTime understands both 12- and 24-hour input; the old inline parser
  // read "2:00 PM" as 02:00, so afternoon classes sorted before morning ones.
  merged.sort(byStartTime);

  const today = new Date().toISOString().slice(0, 10);
  const withCalendar = await applyCalendarClosure(merged, today);

  return { classes: withCalendar, day: base.day, has_overrides: overrides.length > 0 };
};

const DAY_TO_NUM = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };

// The date of the NEXT upcoming occurrence of a given weekday name, as a
// YYYY-MM-DD string (today counts if it matches). Used to line each recurring
// class up with the specific calendar date its override would be filed under.
const nextDateForDay = (dayName) => {
  const target = DAY_TO_NUM[dayName];
  if (target === undefined) return null;
  const now = new Date();
  const todayNum = now.getUTCDay();
  const delta = (target - todayNum + 7) % 7;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + delta));
  return d.toISOString().slice(0, 10);
};

const getWeekClasses = async (department, level) => {
  const normalLevel = normalizeLevel(level);
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.timetables
     WHERE department = $1 
     AND (level = $2 OR level = $3 OR REPLACE(LOWER(level), ' level', '') = $4)
     ORDER BY
       CASE day
         WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
         WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END,
       (CASE WHEN start_time ~ '^[0-9]{1,2}:[0-9]{2}' THEN (LPAD(SPLIT_PART(start_time, ':', 1), 2, '0') || ':' || SPLIT_PART(start_time, ':', 2))::time ELSE '00:00'::time END) ASC`,
    [department, level, normalLevel, normalLevel.toLowerCase()]
  );
  const classes = [...rows].sort(byStartTime);

  // Merge date-specific overrides onto the recurring week, the same way
  // getTodayClassesWithOverrides does for a single day -- previously the week
  // view ignored overrides entirely, so a bulk-cancelled or rescheduled class
  // showed as normal in the week-ahead view even though Today showed it
  // cancelled. Each recurring class is matched to its next upcoming calendar
  // date (per weekday), and any override filed for that class on that date is
  // attached.
  let overrides = [];
  try {
    const TimetableOverride = require('./TimetableOverride');
    overrides = await TimetableOverride.getUpcomingOverrides(department, level);
  } catch {
    return classes; // overrides unavailable -> plain recurring week, unchanged
  }
  if (overrides.length === 0) return classes;

  // Index overrides by (original_class_id + override_date) so each class only
  // picks up the override filed against the specific date it recurs on next.
  const byKey = new Map();
  const additions = [];
  for (const o of overrides) {
    const oDate = o.override_date instanceof Date ? o.override_date.toISOString().slice(0, 10) : String(o.override_date).slice(0, 10);
    if (o.kind === 'add') additions.push({ ...o, oDate });
    else if (o.original_class_id != null) byKey.set(`${o.original_class_id}:${oDate}`, o);
  }

  const merged = classes.map((cls) => {
    const classDate = nextDateForDay(cls.day);
    const o = classDate ? byKey.get(`${cls.id}:${classDate}`) : null;
    if (!o) return { ...cls, override: null };
    if (o.kind === 'cancel') {
      return { ...cls, override: { kind: 'cancel', note: o.note, override_id: o.id } };
    }
    return {
      ...cls,
      override: {
        kind: 'edit', override_id: o.id, note: o.note,
        new: {
          start_time: o.start_time, end_time: o.end_time,
          course_code: o.course_code, course_title: o.course_title,
          venue: o.venue, lecturer: o.lecturer,
        },
      },
    };
  });

  // One-off added classes: surface them on their weekday, mirroring the today
  // view's handling.
  for (const o of additions) {
    const addDay = Object.keys(DAY_TO_NUM).find((d) => nextDateForDay(d) === o.oDate);
    if (!addDay) continue; // outside the upcoming week window
    merged.push({
      id: `override-${o.id}`, department, level, day: addDay,
      start_time: o.start_time, end_time: o.end_time,
      course_code: o.course_code, course_title: o.course_title,
      venue: o.venue, lecturer: o.lecturer, status: 'holding',
      override: { kind: 'add', override_id: o.id, note: o.note },
    });
  }

  // Overlay academic-calendar no-class periods too, per class's own next date
  // (each weekday maps to a different calendar date, so closures are checked
  // date by date). A class already cancelled by an override keeps it.
  let calendarByDate;
  try {
    const AcademicCalendar = require('./AcademicCalendar');
    calendarByDate = new Map();
    for (const cls of merged) {
      const d = nextDateForDay(cls.day);
      if (d && !calendarByDate.has(d)) {
        calendarByDate.set(d, await AcademicCalendar.getNoClassEntriesForDate(d));
      }
    }
  } catch {
    return merged.sort(byStartTime); // calendar unavailable -> overrides-only week
  }

  const withCalendar = merged.map((cls) => {
    if (cls.override) return cls;
    const d = nextDateForDay(cls.day);
    const entries = d ? calendarByDate.get(d) : null;
    if (entries && entries.length > 0) {
      return { ...cls, override: { kind: 'cancel', note: entries[0].activity, source: 'calendar' } };
    }
    return cls;
  });

  return withCalendar.sort(byStartTime);
};

const getTimetable = async (department, level) => {
  const normalLevel = normalizeLevel(level);
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.timetables
     WHERE department = $1 
     AND (level = $2 OR level = $3 OR REPLACE(LOWER(level), ' level', '') = $4)
     ORDER BY
       CASE day
         WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
         WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 ELSE 6 END,
       (CASE WHEN start_time ~ '^[0-9]{1,2}:[0-9]{2}' THEN (LPAD(SPLIT_PART(start_time, ':', 1), 2, '0') || ':' || SPLIT_PART(start_time, ':', 2))::time ELSE '00:00'::time END) ASC`,
    [department, level, normalLevel, normalLevel.toLowerCase()]
  );
  return [...rows].sort(byStartTime);
};

const clearTimetable = async (department, level) => {
  const normalLevel = normalizeLevel(level);
  await pool.query(
    `DELETE FROM abukonn.timetables 
     WHERE department = $1 AND (level = $2 OR level = $3)`,
    [department, level, normalLevel]
  );
};

const bulkInsert = async (entries, createdBy) => {
  if (!entries.length) return 0;
  const values = entries.map((e, i) => {
    const base = i * 11;
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11})`;
  }).join(',');
  const params = entries.flatMap(e => [
    e.department, e.level, e.day, e.start_time, e.end_time,
    e.course_code || null, e.course_title, e.venue || null, e.lecturer || null,
    e.status === 'cancelled' ? 'cancelled' : 'holding', createdBy,
  ]);
  await pool.query(
    `INSERT INTO abukonn.timetables
     (department, level, day, start_time, end_time, course_code, course_title, venue, lecturer, status, created_by)
     VALUES ${values}`,
    params
  );
  return entries.length;
};

const saveUploadRecord = async ({ department, level, uploadedBy, fileName, rowCount }) => {
  await pool.query(
    `INSERT INTO abukonn.timetable_uploads (department, level, uploaded_by, file_name, row_count, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (department, level)
     DO UPDATE SET
       uploaded_by = EXCLUDED.uploaded_by,
       file_name = EXCLUDED.file_name,
       row_count = EXCLUDED.row_count,
       created_at = NOW()`,
    [department, level, uploadedBy, fileName, rowCount]
  );
};

const getUploads = async () => {
  const { rows } = await pool.query(
    `SELECT tu.*, u.full_name AS uploader_name
     FROM abukonn.timetable_uploads tu
     LEFT JOIN abukonn.users u ON tu.uploaded_by = u.id
     ORDER BY tu.created_at DESC
     LIMIT 50`
  );
  return rows;
};

const deleteUploadRecord = async (department, level) => {
  const normalLevel = normalizeLevel(level);
  await pool.query(
    `DELETE FROM abukonn.timetable_uploads 
     WHERE department = $1 AND (level = $2 OR level = $3)`,
    [department, level, normalLevel]
  );
};

module.exports = {
  createTimetableTable, getTodayClasses, getTodayClassesWithOverrides, getWeekClasses, getTimetable,
  clearTimetable, bulkInsert, saveUploadRecord, getUploads, deleteUploadRecord,
};




