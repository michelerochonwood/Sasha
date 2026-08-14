const mongoose = require(
  'mongoose'
);


const pursuitDocumentSchema =
  new mongoose.Schema(
    {

      /* =====================================================
         SCHEMA VERSION
      ===================================================== */

      schemaVersion: {
        type: Number,
        default: 1,
        required: true
      },


      /* =====================================================
         ORGANIZATION
      ===================================================== */

      organization: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
      },


      /* =====================================================
         PURSUIT
      ===================================================== */

      proposal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proposal',
        required: true,
        index: true
      },


      /* =====================================================
         DOCUMENT IDENTITY
      ===================================================== */

      title: {
        type: String,
        trim: true,
        default: ''
      },

      documentType: {
        type: String,

        enum: [
          'rfp',
          'addendum',
          'contract',
          'scope',
          'client_document',
          'reference',
          'background',
          'notes',
          'other'
        ],

        default: 'other'
      },

      sourceType: {
        type: String,

        enum: [
          'client',
          'procurement_portal',
          'pursuit_team',
          'internal',
          'other'
        ],

        default: 'client'
      },


      /* =====================================================
         FILE INFORMATION
      ===================================================== */

      originalFileName: {
        type: String,
        trim: true,
        default: ''
      },

      storedFileName: {
        type: String,
        trim: true,
        default: ''
      },

      mimeType: {
        type: String,
        trim: true,
        default: ''
      },

      fileExtension: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
      },

      fileSize: {
        type: Number,
        default: 0,
        min: 0
      },

      pageCount: {
        type: Number,
        default: null,
        min: 0
      },


      /* =====================================================
         CLOUDINARY STORAGE
      ===================================================== */

      cloudinaryPublicId: {
        type: String,
        trim: true,
        default: ''
      },

      cloudinaryResourceType: {
        type: String,
        trim: true,
        default: 'raw'
      },

      cloudinaryUrl: {
        type: String,
        trim: true,
        default: ''
      },

      cloudinarySecureUrl: {
        type: String,
        trim: true,
        default: ''
      },


      /* =====================================================
         DOCUMENT DATES
      ===================================================== */

      documentDate: {
        type: Date,
        default: null
      },

      uploadedAt: {
        type: Date,
        default: Date.now
      },


      /* =====================================================
         VERSION / SUPERSESSION
      ===================================================== */

      versionLabel: {
        type: String,
        trim: true,
        default: ''
      },

      isCurrent: {
        type: Boolean,
        default: true,
        index: true
      },

      supersedes: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PursuitDocument',
        default: null
      },

      supersededBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PursuitDocument',
        default: null
      },


      /* =====================================================
         SASHA PROCESSING
      ===================================================== */

      processingStatus: {
        type: String,

        enum: [
          'not_started',
          'queued',
          'processing',
          'complete',
          'failed'
        ],

        default: 'not_started',
        index: true
      },

      processedBySasha: {
        type: Boolean,
        default: false
      },

      processedAt: {
        type: Date,
        default: null
      },

      processingError: {
        type: String,
        trim: true,
        default: ''
      },


      /* =====================================================
         DOCUMENT INTELLIGENCE
      ===================================================== */

      documentSummary: {
        type: String,
        trim: true,
        default: ''
      },

      documentPurpose: {
        type: String,
        trim: true,
        default: ''
      },

      extractedText: {
        type: String,
        default: ''
      },


      /* =====================================================
         DOCUMENT STRUCTURE
      ===================================================== */

      sections: [
        {
          heading: {
            type: String,
            trim: true,
            default: ''
          },

          pageStart: {
            type: Number,
            default: null
          },

          pageEnd: {
            type: Number,
            default: null
          },

          summary: {
            type: String,
            trim: true,
            default: ''
          }
        }
      ],


      /* =====================================================
         DOCUMENT CHUNKS
      ===================================================== */

      chunks: [
        {
          chunkIndex: {
            type: Number,
            required: true
          },

          pageStart: {
            type: Number,
            default: null
          },

          pageEnd: {
            type: Number,
            default: null
          },

          heading: {
            type: String,
            trim: true,
            default: ''
          },

          text: {
            type: String,
            default: ''
          }
        }
      ],


      /* =====================================================
         IMPORTANT DOCUMENT FINDINGS
      ===================================================== */

      keyFindings: [
        {
          category: {
            type: String,

            enum: [
              'mandatory_requirement',
              'evaluation_criterion',
              'risk',
              'scope',
              'submission_requirement',
              'deadline',
              'clarification',
              'contract_term',
              'other'
            ],

            default: 'other'
          },

          title: {
            type: String,
            trim: true,
            default: ''
          },

          summary: {
            type: String,
            trim: true,
            default: ''
          },

          pageNumber: {
            type: Number,
            default: null
          }
        }
      ],


      /* =====================================================
         OPENAI / AI PROCESSING
      ===================================================== */

      aiMetadata: {

        lastAnalyzedAt: {
          type: Date,
          default: null
        },

        model: {
          type: String,
          trim: true,
          default: ''
        },

        analysisVersion: {
          type: Number,
          default: 1
        },

        openaiFileId: {
          type: String,
          trim: true,
          default: ''
        }
      },


      /* =====================================================
         SEARCH
      ===================================================== */

      searchKeywords: [
        {
          type: String,
          trim: true
        }
      ],


      /* =====================================================
         NOTES
      ===================================================== */

      notes: {
        type: String,
        trim: true,
        default: ''
      }

    },

    {
      timestamps: true
    }
  );


/* =====================================================
   INDEXES
===================================================== */

pursuitDocumentSchema.index(
  {
    organization: 1,
    proposal: 1
  }
);


pursuitDocumentSchema.index(
  {
    proposal: 1,
    documentType: 1,
    isCurrent: 1
  }
);


/* =====================================================
   EXPORT MODEL
===================================================== */

module.exports =
  mongoose.model(
    'PursuitDocument',
    pursuitDocumentSchema
  );