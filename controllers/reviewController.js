
const mongoose = require('mongoose');

const Proposal = require('../models/proposal');

const cloudinary = require('../config/cloudinary');


/* =====================================================
   REVIEW CONFIGURATION
===================================================== */

const VALID_REVIEW_TYPES = [
  'blue',
  'pink',
  'gold',
  'red'
];

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);

const MAX_REVIEW_NOTES_BYTES =
  25 * 1024 * 1024;


/* =====================================================
   HELPERS
===================================================== */

function getOrganizationId(req) {
  return (
    req.organization?._id ||
    req.organization?.id ||
    req.session?.organizationId
  );
}


function reviewRedirect(pursuitId) {
  return `/review?pursuit=${encodeURIComponent(pursuitId)}`;
}


/* =====================================================
   UPLOAD REVIEW DOCUMENT TO CLOUDINARY
===================================================== */

function uploadReviewDocument(
  file,
  organizationId,
  pursuitId,
  reviewType
) {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',

          folder:
            `sasha/reviews/${organizationId}/${pursuitId}/${reviewType}`,

          use_filename: false,
          unique_filename: true,
          overwrite: false
        },

        (error, result) => {
          if (error) {
            return reject(error);
          }

          if (
            !result ||
            !result.public_id ||
            !result.secure_url
          ) {
            return reject(
              new Error(
                'Cloudinary did not return a valid upload result.'
              )
            );
          }

          return resolve(result);
        }
      );

    uploadStream.on('error', reject);

    uploadStream.end(file.buffer);
  });
}


/* =====================================================
   REMOVE CLOUDINARY DOCUMENT AFTER FAILED SAVE
===================================================== */

async function cleanupReviewDocument(uploadedFile) {
  if (!uploadedFile?.public_id) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(
      uploadedFile.public_id,
      {
        resource_type:
          uploadedFile.resource_type || 'raw',

        type:
          uploadedFile.type || 'authenticated'
      }
    );

  } catch (cleanupError) {
    console.error(
      'REVIEW DOCUMENT CLEANUP FAILED:',
      cleanupError
    );
  }
}


/* =====================================================
   UPLOAD COLOR TEAM REVIEW NOTES
===================================================== */

exports.postUploadReviewNotes = async (req, res) => {
  let uploadedFile = null;
  let documentSaved = false;

  try {

    /* ===============================================
       IDENTIFY REQUEST
    =============================================== */

    const {
      pursuitId,
      reviewType
    } = req.body || {};

    const organizationId =
      getOrganizationId(req);


    /* ===============================================
       VALIDATE ORGANIZATION
    =============================================== */

    if (
      !organizationId ||
      !mongoose.isValidObjectId(organizationId)
    ) {
      return res.status(401).send(
        'Organization authentication required.'
      );
    }


    /* ===============================================
       VALIDATE PURSUIT AND REVIEW TYPE
    =============================================== */

    if (
      !mongoose.isValidObjectId(pursuitId) ||
      !VALID_REVIEW_TYPES.includes(reviewType)
    ) {
      return res.status(400).send(
        'Invalid pursuit or review type.'
      );
    }


    /* ===============================================
       VALIDATE UPLOADED DOCUMENT
    =============================================== */

    const file = req.file;

    if (!file || !file.buffer) {
      return res.status(400).send(
        'Please select a review notes document.'
      );
    }

    if (
      file.fieldname !== 'reviewNotes' ||
      !ALLOWED_MIME_TYPES.has(file.mimetype)
    ) {
      return res.status(400).send(
        'Review notes must be PDF, DOCX, or TXT files.'
      );
    }

    if (
      file.size <= 0 ||
      file.size > MAX_REVIEW_NOTES_BYTES
    ) {
      return res.status(413).send(
        'Review notes must be nonempty and 25 MB or smaller.'
      );
    }


    /* ===============================================
       VERIFY PURSUIT OWNERSHIP
    =============================================== */

    const proposal = await Proposal.findOne({
      _id: pursuitId,
      organization: organizationId
    }).select('_id organization');

    if (!proposal) {
      return res.status(404).send(
        'Pursuit not found.'
      );
    }


    /* ===============================================
       UPLOAD DOCUMENT TO CLOUDINARY
    =============================================== */

    uploadedFile = await uploadReviewDocument(
      file,
      organizationId,
      pursuitId,
      reviewType
    );


    /* ===============================================
       PREPARE DOCUMENT RECORD
    =============================================== */

    const documentRecord = {
      originalName: file.originalname,

      cloudinaryPublicId:
        uploadedFile.public_id,

      cloudinaryUrl:
        uploadedFile.secure_url,

      cloudinaryResourceType:
        uploadedFile.resource_type || 'raw',

      cloudinaryDeliveryType:
        uploadedFile.type || 'authenticated',

      mimeType: file.mimetype,

      size: file.size,

      uploadedAt: new Date(),

      reviewType
    };


    /* ===============================================
       SAVE DOCUMENT TO PROPOSAL
    =============================================== */

    const result = await Proposal.updateOne(
      {
        _id: proposal._id,
        organization: organizationId
      },

      {
        $push: {
          [`reviews.${reviewType}.reviewNotes`]:
            documentRecord
        },

        $set: {
          [`reviews.${reviewType}.status`]:
            'notes_uploaded'
        }
      },

      {
        runValidators: true
      }
    );


    if (
      result.acknowledged !== true ||
      result.matchedCount !== 1 ||
      result.modifiedCount !== 1
    ) {
      throw new Error(
        'The review document could not be saved to the pursuit.'
      );
    }

    documentSaved = true;


    /* ===============================================
       LOG SUCCESS
    =============================================== */

    console.log('REVIEW NOTES UPLOAD SUCCESS:', {
      pursuitId: String(pursuitId),
      reviewType,
      fileName: file.originalname,
      size: file.size,
      cloudinaryPublicId:
        uploadedFile.public_id
    });


    /* ===============================================
       RETURN TO REVIEW VIEW
    =============================================== */

    return res.redirect(
      reviewRedirect(pursuitId)
    );

  } catch (error) {

    console.error(
      'REVIEW NOTES UPLOAD ERROR:',
      error
    );


    /* ===============================================
       CLEAN UP IF DATABASE SAVE FAILED
    =============================================== */

    if (
      uploadedFile &&
      !documentSaved
    ) {
      await cleanupReviewDocument(uploadedFile);
    }


    return res.status(500).send(
      'Unable to save review notes. Please try again.'
    );
  }
};
