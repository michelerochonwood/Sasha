
const mongoose = require('mongoose');

/* =====================================================
   PROPOSAL TEMPLATE SCHEMA
===================================================== */

const proposalTemplateSchema =
  new mongoose.Schema(
    {
      organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
      },

      templateName: {
        type: String,
        required: true,
        trim: true
      },

      originalFileName: {
        type: String,
        required: true,
        trim: true
      },

      mimeType: {
        type: String,
        default:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },

      fileSize: {
        type: Number,
        default: 0
      },

      cloudinaryPublicId: {
        type: String,
        required: true
      },

      cloudinaryResourceType: {
        type: String,
        default: 'raw'
      },

      cloudinaryDeliveryType: {
        type: String,
        default: 'authenticated'
      },

      cloudinarySecureUrl: {
        type: String,
        default: ''
      },

      isActive: {
        type: Boolean,
        default: true,
        index: true
      },

      uploadedAt: {
        type: Date,
        default: Date.now
      }
    },
    {
      timestamps: true
    }
  );

/* =====================================================
   INDEXES
===================================================== */

proposalTemplateSchema.index({
  organization: 1,
  isActive: 1
});

/* =====================================================
   EXPORT
===================================================== */

module.exports =
  mongoose.model(
    'ProposalTemplate',
    proposalTemplateSchema
  );
