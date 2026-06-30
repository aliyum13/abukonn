// Detects a file's real type from its magic bytes (the actual file content),
// rather than trusting the client-supplied Content-Type, which is trivial to
// spoof. multer's fileFilter only sees the declared mimetype before the file
// is read — this runs after, once req.file.buffer is populated.

const SIGNATURES = [
  { mime: 'image/jpeg', match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', match: (b) => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/gif', match: (b) => b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    mime: 'image/webp',
    match: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    // Covers MP4, MOV, QuickTime, M4V — all use the ISO base media 'ftyp' box at byte offset 4
    mime: 'video/mp4',
    match: (b) => b.length >= 8 && b.toString('ascii', 4, 8) === 'ftyp',
  },
  {
    mime: 'video/webm',
    match: (b) => b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3,
  },
  {
    mime: 'video/avi',
    match: (b) => b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'AVI ',
  },
];

/** Returns the detected mime type string, or null if the content doesn't match any known signature. */
function detectFileType(buffer) {
  if (!buffer || buffer.length < 4) return null;
  const found = SIGNATURES.find((sig) => sig.match(buffer));
  return found ? found.mime : null;
}

/**
 * Express middleware: rejects the request if req.file's actual content
 * doesn't match a real image/video signature. Apply right after
 * upload.single(...) on any route accepting image/video uploads.
 */
function verifyFileSignature(req, res, next) {
  if (!req.file) return next();
  const detected = detectFileType(req.file.buffer);
  if (!detected) {
    return res.status(400).json({ message: 'File content does not match a supported image or video format.' });
  }
  next();
}

module.exports = { detectFileType, verifyFileSignature };
