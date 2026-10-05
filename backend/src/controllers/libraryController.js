const Library = require('../models/Library');
const { canUploadLibrary, deleteCapabilities, mayDelete } = require('../lib/libraryAccess');
const { deleteLibraryAsset } = require('../lib/libraryAsset');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function browse(req, res) {
  try {
    const { type, faculty, department, level, course_code, search, page } = req.query;
    const result = await Library.getMaterials({ type, faculty, department, level, course_code, search, page: parseInt(page) || 1 });
    // Per-viewer delete permission, computed by the same rule the DELETE
    // endpoint enforces, so a client shows a delete control exactly when the
    // server would accept it.
    const caps = await deleteCapabilities(req.user.id);
    result.materials = result.materials.map(m => ({ ...m, can_delete: mayDelete(caps, m, req.user.id) }));
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

    // Build a public_id that KEEPS the file extension. For resource_type 'raw',
    // Cloudinary does NOT append the extension to the delivery URL on its own —
    // use_filename only affects the base name, so files ended up at URLs with no
    // extension (e.g. .../file_fxzsj0), which browsers/viewers can't identify and
    // fall back to a raw download prompt. Setting public_id explicitly with the
    // extension fixes this. A random suffix keeps it unique.
    const path = require('path');
    const ext = path.extname(req.file.originalname);
    const base = path.basename(req.file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
    const suffix = Math.random().toString(36).slice(2, 8);
    const publicId = `${base}_${suffix}${ext}`;

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', folder: 'abukonn/library', public_id: publicId, use_filename: false, unique_filename: false },
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

// Delete rule: a full admin may delete any material; a Library Contributor may
// delete only materials they uploaded; nobody else may delete. Roles are read
// fresh on every request, so a revoked contributor is refused immediately, even
// for their own uploads.
//
// Order matters: someone with no delete rights at all is refused (403) before
// the material is looked up, so the status can't be used to probe which ids
// exist. After that, a missing material is 404 and a rule failure is 403.
async function deleteMaterial(req, res) {
  try {
    const userId = req.user.id;
    const caps = await deleteCapabilities(userId);
    if (!caps.all && !caps.own) {
      return res.status(403).json({ message: 'Forbidden. You do not have permission to delete library materials.' });
    }

    const id = parseInt(req.params.id, 10);
    const material = Number.isInteger(id) ? await Library.getMaterialById(id) : null;
    if (!material) return res.status(404).json({ message: 'Material not found' });

    if (!mayDelete(caps, material, userId)) {
      return res.status(403).json({ message: 'Forbidden. You can only delete materials you uploaded.' });
    }

    await Library.deleteMaterial(id);
    res.json({ message: 'Deleted' });
    // After the response, so storage cleanup can never delay or fail the delete.
    // The row is already gone; this only stops the file being orphaned.
    deleteLibraryAsset(material.file_url);
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

// Lets a client decide whether to show its upload button. Uses the same check
// the upload gate enforces; hiding the button is a convenience, the endpoint is
// what actually refuses.
async function permissions(req, res) {
  try {
    res.json({ can_upload: await canUploadLibrary(req.user.id) });
  } catch (err) {
    console.error('library permissions:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = { browse, getMaterial, upload, deleteMaterial, adminList, permissions };
