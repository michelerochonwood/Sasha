
const multer = require('multer');

/* =====================================================
   PROPOSAL TEMPLATE UPLOAD
===================================================== */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 1,
    fileSize: 25 * 1024 * 1024
  },

  fileFilter(req, file, callback) {

    const allowed =
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (!allowed) {
      return callback(
        new Error(
          'Proposal templates must be Word DOCX files.'
        )
      );
    }

    return callback(null, true);
  }
});

module.exports = upload.single('proposalTemplate');
