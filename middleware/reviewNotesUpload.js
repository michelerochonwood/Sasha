
const multer = require('multer');

/* =====================================================
   REVIEW NOTES UPLOAD LIMITS
===================================================== */

const MAX_REVIEW_NOTE_SIZE =
  25 * 1024 * 1024;

/* =====================================================
   ALLOWED DOCUMENT TYPES
===================================================== */

const allowedMimeTypes = new Set([
  'application/pdf',

  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  'text/plain'
]);

/* =====================================================
   MULTER CONFIGURATION
===================================================== */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 1,
    fileSize: MAX_REVIEW_NOTE_SIZE
  },

  fileFilter(req, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new multer.MulterError(
          'LIMIT_UNEXPECTED_FILE',
          file.fieldname
        )
      );
    }

    return callback(null, true);
  }
});

/* =====================================================
   RECEIVE REVIEW NOTES
===================================================== */

const receiveReviewNotes =
  upload.single('reviewNotes');

/* =====================================================
   FORMAT UPLOAD ERRORS
===================================================== */

function getUploadErrorMessage(error) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return 'Review notes must be 25 MB or smaller.';
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return 'Review notes must be PDF, DOCX, or TXT files.';
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return 'Upload one review notes document at a time.';
  }

  return 'Sasha could not receive the review notes.';
}

/* =====================================================
   REVIEW NOTES UPLOAD MIDDLEWARE
===================================================== */

function reviewNotesUpload(req, res, next) {
  receiveReviewNotes(req, res, (error) => {
    if (error) {
      console.error(
        'REVIEW NOTES UPLOAD ERROR:',
        error
      );

      return res.status(400).send(
        getUploadErrorMessage(error)
      );
    }

    if (!req.file) {
      return res.status(400).send(
        'Please select a review notes document.'
      );
    }

    console.log('REVIEW NOTES RECEIVED:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: Boolean(req.file.buffer)
    });

    return next();
  });
}

module.exports = reviewNotesUpload;
