const pool = require('../config/db');

const createLibraryTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS abukonn.library_materials (
      id SERIAL PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      description TEXT,
      type VARCHAR(20) NOT NULL DEFAULT 'other',
      faculty VARCHAR(200),
      department VARCHAR(200),
      level VARCHAR(50),
      course_code VARCHAR(20),
      course_title VARCHAR(200),
      file_url TEXT NOT NULL,
      file_name VARCHAR(255),
      file_size INTEGER,
      file_type VARCHAR(50),
      download_count INT DEFAULT 0,
      uploaded_by INTEGER REFERENCES abukonn.users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('Library table ready');
};

const getMaterials = async ({ type, department, level, course_code, search, page = 1 }) => {
  console.log('[Library] getMaterials called with:', { type, department, level, course_code, search, page });
  const limit = 20;
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  let idx = 1;

  if (type && type !== 'all') { conditions.push(`type = $${idx++}`); params.push(type); }
  if (department) { conditions.push(`department ILIKE $${idx++}`); params.push(`%${department}%`); }
  if (level) { conditions.push(`level ILIKE $${idx++}`); params.push(`%${level.replace(' Level', '')}%`); }
  if (course_code) { conditions.push(`course_code ILIKE $${idx++}`); params.push(`%${course_code}%`); }
  if (search) {
    conditions.push(`(title ILIKE $${idx} OR course_title ILIKE $${idx} OR course_code ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${search}%`); idx++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  console.log('[Library] WHERE clause:', where, 'params:', params);
  const { rows } = await pool.query(
    `SELECT lm.*, u.full_name AS uploader_name
     FROM abukonn.library_materials lm
     LEFT JOIN abukonn.users u ON lm.uploaded_by = u.id
     ${where}
     ORDER BY lm.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );
  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*) FROM abukonn.library_materials ${where}`, params
  );
  return { materials: rows, total: parseInt(countRows[0].count), page, limit };
};

const getMaterialById = async (id) => {
  const { rows } = await pool.query(
    `SELECT lm.*, u.full_name AS uploader_name
     FROM abukonn.library_materials lm
     LEFT JOIN abukonn.users u ON lm.uploaded_by = u.id
     WHERE lm.id = $1`, [id]
  );
  return rows[0];
};

const incrementDownload = async (id) => {
  await pool.query('UPDATE abukonn.library_materials SET download_count = download_count + 1 WHERE id = $1', [id]);
};

const createMaterial = async ({ title, description, type, faculty, department, level, course_code, course_title, file_url, file_name, file_size, file_type, uploaded_by }) => {
  const { rows } = await pool.query(
    `INSERT INTO abukonn.library_materials
     (title, description, type, faculty, department, level, course_code, course_title, file_url, file_name, file_size, file_type, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [title, description || null, type, faculty || null, department || null, level || null, course_code || null, course_title || null, file_url, file_name || null, file_size || null, file_type || null, uploaded_by]
  );
  return rows[0];
};

const deleteMaterial = async (id) => {
  await pool.query('DELETE FROM abukonn.library_materials WHERE id = $1', [id]);
};

const getAllMaterials = async () => {
  const { rows } = await pool.query(
    `SELECT lm.*, u.full_name AS uploader_name
     FROM abukonn.library_materials lm
     LEFT JOIN abukonn.users u ON lm.uploaded_by = u.id
     ORDER BY lm.created_at DESC`
  );
  return rows;
};

module.exports = { createLibraryTable, getMaterials, getMaterialById, incrementDownload, createMaterial, deleteMaterial, getAllMaterials };


