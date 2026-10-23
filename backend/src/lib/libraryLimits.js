// Library files are stored on Cloudinary as `raw` assets, and Cloudinary's
// account cap on a single file is 10MB. Anything bigger is refused by Cloudinary
// itself with:
//   "File size too large. Got 22519144. Maximum is 10485760."
// Our own limit used to be 25MB, so any file between 10 and 25MB passed every
// check we have and only failed at the very last step, with Cloudinary's raw
// text wrapped in "Server error:" and a 500.
//
// This is the library's limit only. The CSV admin uploads (timetable, academic
// calendar, whitelist) share the multer setup but are parsed in memory and never
// reach Cloudinary, so they keep their own, larger cap in uploadAny.js.
const LIBRARY_MAX_FILE_SIZE = 10 * 1024 * 1024;

const LIBRARY_TOO_LARGE_MESSAGE =
  `Files over ${LIBRARY_MAX_FILE_SIZE / (1024 * 1024)}MB can't be uploaded yet`;

const CLOUDINARY_TOO_LARGE = /file size too large/i;

// Turns whatever the Cloudinary upload threw into the response we send.
//
// Our multer limit normally rejects an oversized file long before this point, so
// this is the safety net for when the two caps disagree (Cloudinary's cap is
// theirs to change, not ours). It maps their size error to the same friendly 400
// the multer path returns, instead of leaking their wording behind a 500.
// Everything else keeps the existing behaviour: a 500 with the underlying text.
function libraryUploadFailure(err) {
  const raw = String((err && (err.message || (err.error && err.error.message))) || '');
  if (CLOUDINARY_TOO_LARGE.test(raw)) {
    return { status: 400, message: LIBRARY_TOO_LARGE_MESSAGE };
  }
  return { status: 500, message: 'Server error: ' + raw };
}

module.exports = { LIBRARY_MAX_FILE_SIZE, LIBRARY_TOO_LARGE_MESSAGE, libraryUploadFailure };
