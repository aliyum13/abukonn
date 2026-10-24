const { createUploader } = require('./uploadAny');
const { LIBRARY_MAX_FILE_SIZE, LIBRARY_TOO_LARGE_MESSAGE } = require('../lib/libraryLimits');

// Same accepted types and the same clean JSON errors as uploadAny, but capped at
// what Cloudinary will actually accept, so an oversized file is refused here --
// before it is buffered whole and sent on -- with a message a student can act on.
module.exports = createUploader({
  maxFileSize: LIBRARY_MAX_FILE_SIZE,
  tooLargeMessage: LIBRARY_TOO_LARGE_MESSAGE,
});
