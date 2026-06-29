const Library = require('../models/Library');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function browse(req, res) {
  try {
    const { type, department, level, course_code, search, page } = req.query;
    const result = await Library.getMaterials({ type, department, level, course_code, search, page: parseInt(page) || 1 });
    res.json(result);
  } catch (err) {
    console.error('browse library:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function getMaterial(req, res) {
  try {
    const material = await Library.getMaterialById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });
    await Library.incrementDownload(req.params.id);
    res.json({ material });
  } catch (err) {
    console.error('getMaterial:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function upload(req, res) {
  try {
    const { title, description, type, faculty, department, level, course_code, course_title } = req.body;
    if (!title || !type || !req.file) {
      return res.status(400).json({ message: 'title, type and file are required' });
    }

    // Upload to Cloudinary as raw file
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'abukonn/library', use_filename: true, unique_filename: true },
        (error, result) => error ? reject(error) : resolve(result)
      );
      stream.end(req.file.buffer);
    });

    const material = await Library.createMaterial({
      title, description, type, faculty, department, level,
      course_code, course_title,
      file_url: result.secure_url,
      file_name: req.file.originalname,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      uploaded_by: req.user.id,
    });

    res.json({ material });
  } catch (err) {
    console.error('upload library:', err.message);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
}

async function deleteMaterial(req, res) {
  try {
    await Library.deleteMaterial(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('deleteMaterial:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

async function adminList(req, res) {
  try {
    const materials = await Library.getAllMaterials();
    res.json({ materials });
  } catch (err) {
    console.error('adminList:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { browse, getMaterial, upload, deleteMaterial, adminList };
