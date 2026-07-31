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

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Every date between startDate and endDate (inclusive), paired with its
// day-of-week name -- e.g. a Mid-Semester Break spanning Mon-Fri needs a
// cancel override created against whichever recurring class actually falls
// on each of those specific calendar dates, not just "cancel Monday's slot
// once." Dates are UTC-based (YYYY-MM-DD strings in, out) to avoid
// timezone drift shifting a date to the wrong day-of-week.
function datesInRange(startDate, endDate) {
  const out = [];
  const cur = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cur <= end) {
    out.push({ date: cur.toISOString().slice(0, 10), day: DAY_NAMES[cur.getUTCDay()] });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

// Admin bulk-cancel: an entire date range, scoped to the whole university, one
// faculty (via departmentsInSameFaculty-style lookup, passed in as an array
// by the caller so this file doesn't need to import departments.js directly),
// or a single department (+ optional level -- all levels of that department
// if omitted). Reuses the exact same override mechanism class reps already
// use for single-class overrides -- this is just the same 'cancel' kind,
// created for every (class, date) pair the scope+range matches, in one pass.
//
// dryRun computes the count/breakdown without writing anything, for the
// admin UI's "this will cancel N classes across M departments -- confirm?"
// preview step. Same query either way, just SELECT vs INSERT.
async function bulkCancel({
  startDate, endDate, scope, departments = null, level = null, note = null, createdBy = null, dryRun = false,
}) {
  const range = datesInRange(startDate, endDate);
  if (range.length === 0) return { count: 0, byDepartment: {} };

  let deptFilter = '';
  const baseParams = [];
  if (scope === 'faculty' || scope === 'department') {
    baseParams.push(departments); // array of department names
    deptFilter = `AND t.department = ANY($${baseParams.length})`;
  }
  let levelFilter = '';
  if (scope === 'department' && level) {
    baseParams.push(normalizeLevel(level).toLowerCase());
    levelFilter = `AND REPLACE(LOWER(t.level), ' level', '') = $${baseParams.length}`;
  }

  let totalCount = 0;
  const byDepartment = {};

  for (const { date, day } of range) {
    const params = [...baseParams, day, date];
    const dayParamIdx = params.length - 1; // day is second-to-last
    const dateParamIdx = params.length; // date is last

    if (dryRun) {
      const { rows } = await pool.query(
        `SELECT t.department, COUNT(*)::int AS n
         FROM abukonn.timetables t
         WHERE t.day = $${dayParamIdx} ${deptFilter} ${levelFilter}
           AND NOT EXISTS (
             SELECT 1 FROM abukonn.timetable_overrides o
             WHERE o.original_class_id = t.id AND o.override_date = $${dateParamIdx} AND o.kind = 'cancel'
           )
         GROUP BY t.department`,
        params
      );
      for (const r of rows) {
        byDepartment[r.department] = (byDepartment[r.department] || 0) + r.n;
        totalCount += r.n;
      }
    } else {
      params.push(note, createdBy);
      const noteIdx = params.length - 1;
      const createdByIdx = params.length;
      const { rows } = await pool.query(
        `INSERT INTO abukonn.timetable_overrides
           (department, level, override_date, kind, original_class_id, note, created_by)
         SELECT t.department, t.level, $${dateParamIdx}, 'cancel', t.id, $${noteIdx}, $${createdByIdx}
         FROM abukonn.timetables t
         WHERE t.day = $${dayParamIdx} ${deptFilter} ${levelFilter}
           AND NOT EXISTS (
             SELECT 1 FROM abukonn.timetable_overrides o
             WHERE o.original_class_id = t.id AND o.override_date = $${dateParamIdx} AND o.kind = 'cancel'
           )
         RETURNING department`,
        params
      );
      for (const r of rows) {
        byDepartment[r.department] = (byDepartment[r.department] || 0) + 1;
        totalCount += 1;
      }
    }
  }

  return { count: totalCount, byDepartment };
}

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
  bulkCancel,
};
