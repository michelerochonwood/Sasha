
const mongoose = require('mongoose');

const ProposalTemplate = require(
  '../models/proposalTemplate'
);

const cloudinary = require(
  '../config/cloudinary'
);

/* =====================================================
   CONSTANTS
===================================================== */

const MAX_TEMPLATE_SIZE =
  25 * 1024 * 1024;

const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* =====================================================
   UPLOAD TEMPLATE TO CLOUDINARY
===================================================== */

function uploadTemplateToCloudinary(
  uploadedFile,
  organizationId
) {

  return new Promise((resolve, reject) => {

    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          type: 'authenticated',

          folder:
            `sasha/${organizationId}/proposal-templates`,

          use_filename: true,
          unique_filename: true,
          overwrite: false
        },

        (error, result) => {

          if (error) {
            return reject(error);
          }

          if (!result || !result.public_id) {
            return reject(
              new Error(
                'Cloudinary did not return a template file ID.'
              )
            );
          }

          return resolve(result);
        }
      );

    uploadStream.on('error', reject);

    uploadStream.end(uploadedFile.buffer);

  });

}

/* =====================================================
   VALIDATE TEMPLATE FILE
===================================================== */

function validateTemplateFile(file) {

  if (!file || !Buffer.isBuffer(file.buffer)) {
    return 'Select a Word proposal template to upload.';
  }

  if (
    file.mimetype !== DOCX_MIME_TYPE ||
    !file.originalname.toLowerCase().endsWith('.docx')
  ) {
    return 'Proposal templates must be DOCX files.';
  }

  if (
    file.size <= 0 ||
    file.size > MAX_TEMPLATE_SIZE
  ) {
    return 'The Word template must be 25 MB or smaller.';
  }

  // DOCX files are ZIP packages.
  const signature = file.buffer.subarray(0, 4);

  const isZip =
    signature.length === 4 &&
    signature[0] === 0x50 &&
    signature[1] === 0x4b &&
    [0x03, 0x05, 0x07].includes(signature[2]);

  if (!isZip) {
    return 'The selected file is not a valid Word document.';
  }

  return null;

}

/* =====================================================
   GET ACTIVE TEMPLATE
===================================================== */

async function getActiveTemplate(organizationId) {

  if (
    !organizationId ||
    !mongoose.isValidObjectId(organizationId)
  ) {
    throw new Error('A valid organization is required.');
  }

  return ProposalTemplate.findOne({
    organization: organizationId,
    isActive: true
  })
    .sort({ createdAt: -1 })
    .lean();

}

/* =====================================================
   POST UPLOAD PROPOSAL TEMPLATE
===================================================== */

async function postUploadProposalTemplate(req, res) {

  let uploadedCloudinaryFile = null;
  let savedTemplate = null;

  try {

    const organizationId =
      req.session?.organizationId;

    if (
      !organizationId ||
      !mongoose.isValidObjectId(organizationId)
    ) {
      return res.status(401).json({
        success: false,
        errorMessage:
          'Please log in before uploading a proposal template.'
      });
    }

    const uploadedFile = req.file;

    const validationError =
      validateTemplateFile(uploadedFile);

    if (validationError) {
      return res.status(400).json({
        success: false,
        errorMessage: validationError
      });
    }

    const templateName =
      typeof req.body?.templateName === 'string'
        ? req.body.templateName.trim()
        : '';

    if (!templateName || templateName.length > 150) {
      return res.status(400).json({
        success: false,
        errorMessage:
          'Enter a template name of 150 characters or fewer.'
      });
    }

    /* =================================================
       UPLOAD TO CLOUDINARY
    ================================================= */

    uploadedCloudinaryFile =
      await uploadTemplateToCloudinary(
        uploadedFile,
        organizationId
      );

    /* =================================================
       CREATE TEMPLATE RECORD
    ================================================= */

    savedTemplate =
      await ProposalTemplate.create({
        organization: organizationId,

        templateName,

        originalFileName:
          uploadedFile.originalname,

        mimeType:
          DOCX_MIME_TYPE,

        fileSize:
          uploadedFile.size,

        cloudinaryPublicId:
          uploadedCloudinaryFile.public_id,

        cloudinaryResourceType:
          'raw',

        cloudinaryDeliveryType:
          'authenticated',

        cloudinarySecureUrl:
          uploadedCloudinaryFile.secure_url || '',

        // Activate after older templates are deactivated.
        isActive: false,

        uploadedAt: new Date()
      });

    /* =================================================
       ACTIVATE NEW TEMPLATE
    ================================================= */

    await ProposalTemplate.updateMany(
      {
        organization: organizationId,
        _id: { $ne: savedTemplate._id },
        isActive: true
      },
      {
        $set: { isActive: false }
      }
    );

    savedTemplate.isActive = true;
    await savedTemplate.save();

    console.log(
      'SASHA PROPOSAL TEMPLATE UPLOADED:',
      {
        organizationId:
          organizationId.toString(),

        templateId:
          savedTemplate._id.toString(),

        templateName,

        originalFileName:
          uploadedFile.originalname
      }
    );

    return res.status(201).json({
      success: true,

      message:
        'Proposal template uploaded successfully.',

      template: {
        id:
          savedTemplate._id.toString(),

        templateName:
          savedTemplate.templateName,

        originalFileName:
          savedTemplate.originalFileName,

        isActive:
          savedTemplate.isActive,

        uploadedAt:
          savedTemplate.uploadedAt
      }
    });

  } catch (error) {

    console.error(
      'SASHA PROPOSAL TEMPLATE UPLOAD FAILED:',
      error
    );

    /*
     * Do not delete an already-saved active template
     * during error handling. A database operation may
     * have partially completed.
     *
     * An uploaded Cloudinary asset without a database
     * record can be cleaned up separately.
     */

    if (
      uploadedCloudinaryFile &&
      !savedTemplate
    ) {
      try {
        await cloudinary.uploader.destroy(
          uploadedCloudinaryFile.public_id,
          {
            resource_type: 'raw',
            type: 'authenticated',
            invalidate: true
          }
        );
      } catch (cleanupError) {
        console.error(
          'TEMPLATE CLOUDINARY CLEANUP FAILED:',
          cleanupError
        );
      }
    }

    return res.status(500).json({
      success: false,
      errorMessage:
        'Sasha could not save the proposal template. Please try again.'
    });

  }

}

/* =====================================================
   GET ACTIVE PROPOSAL TEMPLATE
===================================================== */

async function getActiveProposalTemplate(req, res) {

  try {

    const organizationId =
      req.session?.organizationId;

    if (
      !organizationId ||
      !mongoose.isValidObjectId(organizationId)
    ) {
      return res.status(401).json({
        success: false,
        errorMessage:
          'Please log in to view proposal templates.'
      });
    }

    const template =
      await getActiveTemplate(organizationId);

    if (!template) {
      return res.status(200).json({
        success: true,
        template: null
      });
    }

    return res.status(200).json({
      success: true,

      template: {
        id: template._id.toString(),
        templateName: template.templateName,
        originalFileName:
          template.originalFileName,
        uploadedAt: template.uploadedAt,
        isActive: template.isActive
      }
    });

  } catch (error) {

    console.error(
      'LOAD ACTIVE PROPOSAL TEMPLATE FAILED:',
      error
    );

    return res.status(500).json({
      success: false,
      errorMessage:
        'Sasha could not load the active proposal template.'
    });

  }

}

/* =====================================================
   EXPORTS
===================================================== */

module.exports = {
  postUploadProposalTemplate,
  getActiveProposalTemplate,
  getActiveTemplate
};
