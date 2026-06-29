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
      created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
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
     ORDER BY start_time ASC`,
    [department, level, normalLevel, normalLevel.toLowerCase(), dayName]
  );
  return { classes: rows, day: dayName };
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
       start_time ASC`,
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
       start_time ASC`,
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
    const base = i * 9;
    return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
  }).join(',');
  const params = entries.flatMap(e => [
    e.department, e.level, e.day, e.start_time, e.end_time,
    e.course_code || null, e.course_title, e.venue || null, createdBy,
  ]);
  await pool.query(
    `INSERT INTO abukonn.timetables
     (department, level, day, start_time, end_time, course_code, course_title, venue, created_by)
     VALUES ${values}`,
    params
  );
  return entries.length;
};

const saveUploadRecord = async ({ department, level, uploadedBy, fileName, rowCount }) => {
  await pool.query(
    `INSERT INTO abukonn.timetable_uploads (department, level, uploaded_by, file_name, row_count)
     VALUES ($1, $2, $3, $4, $5)`,
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

module.exports = {
  createTimetableTable, getTodayClasses, getWeekClasses, getTimetable,
  clearTimetable, bulkInsert, saveUploadRecord, getUploads,
};
