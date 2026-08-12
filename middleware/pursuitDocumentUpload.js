const multer = require(
  'multer'
);


/* =====================================================
   UPLOAD LIMITS
===================================================== */

const MAX_PURSUIT_DOCUMENTS =
  5;

const MAX_PURSUIT_DOCUMENT_SIZE =
  25 * 1024 * 1024;


/* =====================================================
   ALLOWED DOCUMENT TYPES
===================================================== */

const allowedMimeTypes =
  new Set([
    'application/pdf',

    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    'text/plain'
  ]);


/* =====================================================
   MULTER CONFIGURATION
===================================================== */

const upload =
  multer({

    /*
     * Files remain in memory so their buffers can
     * be sent directly to OpenAI for pursuit analysis.
     */

    storage:
      multer.memoryStorage(),

    limits: {
      files:
        MAX_PURSUIT_DOCUMENTS,

      fileSize:
        MAX_PURSUIT_DOCUMENT_SIZE
    },

    fileFilter(
      req,
      file,
      callback
    ) {

      if (
        !allowedMimeTypes.has(
          file.mimetype
        )
      ) {

        return callback(
          new multer.MulterError(
            'LIMIT_UNEXPECTED_FILE',
            file.fieldname
          )
        );

      }


      return callback(
        null,
        true
      );

    }

  });


const receivePursuitDocuments =
  upload.array(
    'sourceDocuments',
    MAX_PURSUIT_DOCUMENTS
  );


/* =====================================================
   FORMAT UPLOAD ERROR
===================================================== */

function getUploadErrorMessage(
  error
) {

  if (
    error.code ===
    'LIMIT_FILE_SIZE'
  ) {

    return (
      'Each pursuit document must be 25 MB or smaller.'
    );

  }


  if (
    error.code ===
    'LIMIT_FILE_COUNT'
  ) {

    return (
      'You may upload no more than five pursuit documents at a time.'
    );

  }


  if (
    error.code ===
    'LIMIT_UNEXPECTED_FILE'
  ) {

    return (
      'Pursuit documents must be PDF, DOCX, or TXT files.'
    );

  }


  return (
    'Sasha could not process the selected pursuit documents.'
  );

}


/* =====================================================
   PURSUIT DOCUMENT UPLOAD MIDDLEWARE
===================================================== */

function pursuitDocumentUpload(
  req,
  res,
  next
) {

  receivePursuitDocuments(
    req,
    res,
    (error) => {

      if (!error) {

        console.log(
          'PURSUIT DOCUMENT UPLOAD SUCCESS'
        );


        console.log(
          'REQUEST PATH:',
          req.originalUrl
        );


        console.log(
          'FILES RECEIVED:',
          Array.isArray(req.files)
            ? req.files.map(
                (file) => ({
                  fieldname:
                    file.fieldname,

                  originalname:
                    file.originalname,

                  mimetype:
                    file.mimetype,

                  size:
                    file.size,

                  hasBuffer:
                    Boolean(
                      file.buffer
                    )
                })
              )
            : []
        );


        return next();

      }


      console.error(
        'PURSUIT DOCUMENT UPLOAD ERROR:',
        error
      );


      const errorMessage =
        getUploadErrorMessage(
          error
        );


      /*
       * The pursuit analysis request is made
       * with fetch and expects JSON.
       */

      const isAnalysisRequest =
        req.originalUrl.includes(
          '/create_pursuit/analyze'
        );


      if (isAnalysisRequest) {

        return res.status(400).json({
          success:
            false,

          errorMessage
        });

      }


      /*
       * Any future non-analysis use can render
       * the pursuit form again with an error.
       */

      return res.status(400).render(
        'create_pursuit',
        {
          layout:
            'mainlayout',

          pageTitle:
            'Create a Pursuit',

          errorMessage,

          formData:
            req.body || {}
        }
      );

    }
  );

}


module.exports =
  pursuitDocumentUpload;