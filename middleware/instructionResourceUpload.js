const multer = require(
  'multer'
);


/* =====================================================
   STORAGE
===================================================== */

const storage =
  multer.memoryStorage();


/* =====================================================
   ALLOWED FILE TYPES
===================================================== */

const allowedMimeTypes =
  new Set([
    'application/pdf',

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    'text/plain'
  ]);


/* =====================================================
   FILE FILTER
===================================================== */

function instructionResourceFileFilter(
  req,
  file,
  cb
) {

  if (
    allowedMimeTypes.has(
      file.mimetype
    )
  ) {

    return cb(
      null,
      true
    );

  }


  return cb(
    new multer.MulterError(
      'LIMIT_UNEXPECTED_FILE',
      file.fieldname
    )
  );

}


/* =====================================================
   MULTER CONFIGURATION
===================================================== */

const instructionResourceUpload =
  multer(
    {
      storage,

      fileFilter:
        instructionResourceFileFilter,

      limits: {
        files: 10,

        fileSize:
          25 * 1024 * 1024
      }
    }
  ).array(
    'resourceFiles',
    10
  );


/* =====================================================
   EXPORT
===================================================== */

module.exports =
  instructionResourceUpload;