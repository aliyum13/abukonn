const pool = require('../config/db');

const createHighlightsTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.highlights (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(30) NOT NULL DEFAULT 'announcement',
      icon VARCHAR(10) NOT NULL DEFAULT '📌',
      color VARCHAR(20) NOT NULL DEFAULT 'blue',
      start_date TIMESTAMP WITH TIME ZONE,
      end_date TIMESTAMP WITH TIME ZONE,
      priority INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migrate older deployments: drop the old hardcoded type CHECK constraint
  // and widen the column, then backfill icon/color for existing rows.
  await pool.query(`
    DO $$
    DECLARE c RECORD;
    BEGIN
      FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'abukonn.highlights'::regclass
        AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%type%IN%'
      LOOP
        EXECUTE format('ALTER TABLE abukonn.highlights DROP CONSTRAINT %I', c.conname);
      END LOOP;
    END $$;
  `).catch(() => {});
  await pool.query(`ALTER TABLE abukonn.highlights ALTER COLUMN type TYPE VARCHAR(30)`).catch(() => {});
  await pool.query(`ALTER TABLE abukonn.highlights ADD COLUMN IF NOT EXISTS icon VARCHAR(10) NOT NULL DEFAULT '📌'`).catch(() => {});
  await pool.query(`ALTER TABLE abukonn.highlights ADD COLUMN IF NOT EXISTS color VARCHAR(20) NOT NULL DEFAULT 'blue'`).catch(() => {});
  await pool.query(`
    UPDATE abukonn.highlights SET icon = CASE type
      WHEN 'announcement' THEN '📢' WHEN 'exam' THEN '📝'
      WHEN 'deadline' THEN '⏰' WHEN 'event' THEN '🎉' ELSE icon END
    WHERE icon = '📌'
  `).catch(() => {});
  await pool.query(`
    UPDATE abukonn.highlights SET color = CASE type
      WHEN 'announcement' THEN 'blue' WHEN 'exam' THEN 'red'
      WHEN 'deadline' THEN 'orange' WHEN 'event' THEN 'green' ELSE color END
    WHERE color = 'blue' AND type NOT IN ('announcement')
  `).catch(() => {});
};

const getActiveHighlights = async () => {
  const result = await pool.query(`
    SELECT h.*, u.full_name AS creator_name
    FROM abukonn.highlights h
    LEFT JOIN abukonn.users u ON u.id = h.created_by
    WHERE h.is_active = TRUE
    ORDER BY h.priority DESC, h.created_at DESC
    LIMIT 5
  `);
  return result.rows;
};

const getAllHighlights = async () => {
  const result = await pool.query(`
    SELECT h.*, u.full_name AS creator_name
    FROM abukonn.highlights h
    LEFT JOIN abukonn.users u ON u.id = h.created_by
    ORDER BY h.priority DESC, h.created_at DESC
  `);
  return result.rows;
};

const createHighlight = async ({ title, description, type, icon, color, startDate, endDate, priority, createdBy }) => {
  const result = await pool.query(
    `INSERT INTO abukonn.highlights (title, description, type, icon, color, start_date, end_date, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [title, description || null, type, icon || '📌', color || 'blue', startDate || null, endDate || null, priority || 0, createdBy]
  );
  return result.rows[0];
};

const updateHighlight = async (id, fields) => {
  const cols = ['title', 'description', 'type', 'icon', 'color', 'start_date', 'end_date', 'priority', 'is_active'];
  const keys = ['title', 'description', 'type', 'icon', 'color', 'startDate', 'endDate', 'priority', 'isActive'];
  const setClauses = [];
  const values = [];
  let idx = 1;
  cols.forEach((col, i) => {
    const val = fields[keys[i]];
    if (val !== undefined) {
      setClauses.push(`${col} = $${idx++}`);
      values.push(val);
    }
  });
  if (!setClauses.length) return null;
  values.push(id);
  const result = await pool.query(
    `UPDATE abukonn.highlights SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] || null;
};

const deleteHighlight = async (id) => {
  const result = await pool.query('DELETE FROM abukonn.highlights WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
};

module.exports = { createHighlightsTable, getActiveHighlights, getAllHighlights, createHighlight, updateHighlight, deleteHighlight };
