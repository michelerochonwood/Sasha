
const PursuitDocument = require('../models/pursuitDocument');
const cloudinary = require('../config/cloudinary');

const MAX_DOCUMENTS = 5;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_SINGLE_BYTES = 15 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]);



async function retrievePursuitDocuments({
  organizationId,
  pursuitId
}) {
  if (!organizationId || !pursuitId) {
    throw new Error('Organization and pursuit are required.');
  }

  const documents = await PursuitDocument.find({
    organization: organizationId,
    proposal: pursuitId,
    isCurrent: true,
    mimeType: { $in: [...ALLOWED_MIME_TYPES] }
  })
    .sort({ uploadedAt: -1 })
    .lean();

  // Fail explicitly rather than silently omitting evidence.
  if (documents.length > MAX_DOCUMENTS) {
    throw new Error(
      'Too many current pursuit documents for direct attachment.'
    );
  }

  const fileInputs = [];
  const sources = [];
  let totalBytes = 0;

  for (const document of documents) {
    if (!document.cloudinaryPublicId) {
      throw new Error(
        `Missing Cloudinary ID for ${document.title}.`
      );
    }

    const signedUrl = cloudinary.url(
      document.cloudinaryPublicId,
      {
        resource_type: document.cloudinaryResourceType || 'raw',
        type: 'upload',
        sign_url: true,
        secure: true
      }
    );

    const response = await fetch(signedUrl);

    if (!response.ok) {
      throw new Error(
        `Unable to retrieve ${document.title}: HTTP ${response.status}`
      );
    }

    const contentLength = Number(
      response.headers.get('content-length')
    );

    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_SINGLE_BYTES
    ) {
      throw new Error(
        `Document exceeds the retrieval limit: ${document.title}`
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.length > MAX_SINGLE_BYTES) {
      throw new Error(
        `Document exceeds the retrieval limit: ${document.title}`
      );
    }

    totalBytes += buffer.length;

    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        'Pursuit documents exceed the combined retrieval limit.'
      );
    }

    fileInputs.push({
      type: 'input_file',
      filename: document.originalFileName || document.title,
      file_data:
        `data:${document.mimeType};base64,${buffer.toString('base64')}`
    });

    sources.push({
      documentId: document._id.toString(),
      filename: document.originalFileName || document.title,
      documentType: document.documentType,
      sourceType: document.sourceType
    });
  }

  return { fileInputs, sources };
}

module.exports = {
  retrievePursuitDocuments
};
