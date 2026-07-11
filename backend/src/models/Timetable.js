const pool = require('../config/db');

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
  return { classes: rows, day: dayName };
};

// Today's classes with any class-rep overrides applied. Each returned class
// carries an `override` field describing the change (edited/cancelled/added)
// so the frontend can show the original struck through + the change. Falls back
// silently to the plain timetable if the overrides table doesn't exist yet.
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

  const toMin = (t) => {
    if (!t) return 0;
    const [h, m] = String(t).split(':').map((n) => parseInt(n, 10));
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };
  merged.sort((a, b) => toMin(a.start_time) - toMin(b.start_time));

  return { classes: merged, day: base.day, has_overrides: overrides.length > 0 };
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
  return rows;
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
  return rows;
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




