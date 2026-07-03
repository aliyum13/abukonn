const pool = require('../config/db');

const createAcademicCalendarTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.academic_calendar (
      id SERIAL PRIMARY KEY,
      session VARCHAR(20) NOT NULL,
      semester VARCHAR(20) NOT NULL CHECK (semester IN ('first', 'second')),
      activity VARCHAR(300) NOT NULL,
      from_date DATE,
      to_date DATE,
      period VARCHAR(100),
      sort_order INTEGER DEFAULT 0,
      created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_calendar_session ON abukonn.academic_calendar(session)`);
  console.log('Academic calendar table ready');
};

// Returns all distinct sessions, most recent first
async function getSessions() {
  const { rows } = await pool.query(
    `SELECT DISTINCT session FROM abukonn.academic_calendar ORDER BY session DESC`
  );
  return rows.map(r => r.session);
}

// Returns all entries for a session, grouped-friendly (ordered by semester then sort_order/date)
async function getEntriesBySession(session) {
  const { rows } = await pool.query(
    `SELECT id, session, semester, activity, from_date, to_date, period, sort_order, created_at
     FROM abukonn.academic_calendar
     WHERE session = $1
     ORDER BY
       CASE semester WHEN 'first' THEN 0 ELSE 1 END,
       sort_order ASC,
       from_date ASC NULLS LAST,
       id ASC`,
    [session]
  );
  return rows;
}

// Returns the most recent session's entries (what students see by default)
async function getLatestCalendar() {
  const sessions = await getSessions();
  if (sessions.length === 0) return { session: null, entries: [] };
  const session = sessions[0];
  const entries = await getEntriesBySession(session);
  return { session, entries };
}

async function addEntry({ session, semester, activity, fromDate, toDate, period, sortOrder, createdBy }) {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.academic_calendar
       (session, semester, activity, from_date, to_date, period, sort_order, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [session, semester, activity, fromDate || null, toDate || null, period || null, sortOrder || 0, createdBy]
  );
  return rows[0];
}

async function updateEntry(id, { semester, activity, fromDate, toDate, period, sortOrder }) {
  const { rows } = await pool.query(
    `UPDATE abukonn.academic_calendar
     SET semester = COALESCE($2, semester),
         activity = COALESCE($3, activity),
         from_date = $4,
         to_date = $5,
         period = $6,
         sort_order = COALESCE($7, sort_order)
     WHERE id = $1 RETURNING *`,
    [id, semester || null, activity || null, fromDate || null, toDate || null, period || null, sortOrder ?? null]
  );
  return rows[0] || null;
}

async function deleteEntry(id) {
  await pool.query(`DELETE FROM abukonn.academic_calendar WHERE id = $1`, [id]);
}

async function deleteSession(session) {
  await pool.query(`DELETE FROM abukonn.academic_calendar WHERE session = $1`, [session]);
}

module.exports = {
  createAcademicCalendarTable,
  getSessions,
  getEntriesBySession,
  getLatestCalendar,
  addEntry,
  updateEntry,
  deleteEntry,
  deleteSession,
};
