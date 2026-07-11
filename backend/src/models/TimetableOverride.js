const pool = require('../config/db');

// Timetable overrides are date-specific changes layered on top of the official
// (recurring, day-of-week) timetable. Made by class reps for their own
// department + level. Three kinds:
//   'add'    — an extra class not in the official timetable
//   'edit'   — replaces an official class for that date (references it)
//   'cancel' — hides an official class for that date (references it)
//
// Each override targets a specific calendar DATE. "Revert after the day ends"
// is automatic: a past-dated override simply stops matching the current day.
// No cleanup job needed — we only read overrides whose date >= today.

const CREATE_TIMETABLE_OVERRIDES_TABLE = `
  CREATE TABLE IF NOT EXISTS abukonn.timetable_overrides (
    id SERIAL PRIMARY KEY,
    department VARCHAR(200) NOT NULL,
    level VARCHAR(50) NOT NULL,
    override_date DATE NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('add', 'edit', 'cancel')),
    original_class_id INTEGER REFERENCES abukonn.timetables(id) ON DELETE CASCADE,
    start_time VARCHAR(10),
    end_time VARCHAR(10),
    course_code VARCHAR(20),
    course_title VARCHAR(200),
    venue VARCHAR(100),
    lecturer VARCHAR(100),
    note VARCHAR(200),
    created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  )
`;

async function createTimetableOverridesTable() {
  await pool.query(CREATE_TIMETABLE_OVERRIDES_TABLE);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_tt_overrides_lookup
     ON abukonn.timetable_overrides(department, level, override_date)`
  );
  console.log('Timetable overrides table ready');
}

const normalizeLevel = (level) => (level ? level.replace(/\s*level\s*/i, '').trim() : level);

async function createOverride({
  department, level, overrideDate, kind, originalClassId = null,
  startTime = null, endTime = null, courseCode = null, courseTitle = null,
  venue = null, lecturer = null, note = null, createdBy,
}) {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.timetable_overrides
       (department, level, override_date, kind, original_class_id,
        start_time, end_time, course_code, course_title, venue, lecturer, note, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING *`,
    [department, level, overrideDate, kind, originalClassId,
     startTime, endTime, courseCode, courseTitle, venue, lecturer, note, createdBy]
  );
  return rows[0];
}

async function getOverridesForDate(department, level, date) {
  const normal = normalizeLevel(level);
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.timetable_overrides
     WHERE department = $1
       AND (level = $2 OR REPLACE(LOWER(level), ' level', '') = $3)
       AND override_date = $4`,
    [department, level, normal.toLowerCase(), date]
  );
  return rows;
}

async function getUpcomingOverrides(department, level) {
  const normal = normalizeLevel(level);
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.timetable_overrides
     WHERE department = $1
       AND (level = $2 OR REPLACE(LOWER(level), ' level', '') = $3)
       AND override_date >= CURRENT_DATE
     ORDER BY override_date ASC,
       (CASE WHEN start_time ~ '^[0-9]{1,2}:[0-9]{2}'
         THEN (LPAD(SPLIT_PART(start_time, ':', 1), 2, '0') || ':' || SPLIT_PART(start_time, ':', 2))::time
         ELSE '00:00'::time END) ASC`,
    [department, level, normal.toLowerCase()]
  );
  return rows;
}

async function deleteOverride(id) {
  const { rows } = await pool.query(
    `DELETE FROM abukonn.timetable_overrides WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function getOverrideById(id) {
  const { rows } = await pool.query(
    `SELECT * FROM abukonn.timetable_overrides WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

module.exports = {
  CREATE_TIMETABLE_OVERRIDES_TABLE,
  createTimetableOverridesTable,
  createOverride,
  getOverridesForDate,
  getUpcomingOverrides,
  deleteOverride,
  getOverrideById,
};
