const mongoose = require('mongoose');

const { Schema } = mongoose;


/* =====================================================
   UPLOADED FILE SCHEMA
===================================================== */

const resourceFileSchema = new Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true
    },

    originalFilename: {
      type: String,
      trim: true
    },

    url: {
      type: String,
      required: true,
      trim: true
    },

    publicId: {
      type: String,
      trim: true
    },

    mimeType: {
      type: String,
      trim: true
    },

    fileSize: {
      type: Number,
      min: 0
    },


    /* =================================================
       OPENAI FILE PROCESSING
    ================================================== */

    openAiFileId: {
      type: String,
      trim: true
    },

    vectorStoreFileId: {
      type: String,
      trim: true
    },

    processingStatus: {
      type: String,

      enum: [
        'not submitted',
        'uploading',
        'processing',
        'ready',
        'failed'
      ],

      default: 'not submitted'
    },

    processingError: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    submittedToOpenAiAt: {
      type: Date
    },

    indexedAt: {
      type: Date
    }
  },
  {
    _id: true
  }
);


/* =====================================================
   INSTRUCTION RESOURCE SCHEMA
===================================================== */

const instructionResourceSchema = new Schema(
  {
    /* =================================================
       RESOURCE IDENTITY
    ================================================= */

    resourceTitle: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250
    },

    resourceCategory: {
      type: String,
      required: true,
      enum: [
        'strategic or business plan',
        'branding or writing guideline',
        'proposal or qualifications document',
        'RFP or RFQ',
        'historic project information',
        'client or market intelligence',
        'technical standard or procedure',
        'lessons learned or closeout material',
        'performance or evidence report',
        'template or approved example',
        'other'
      ]
    },

    documentOwner: {
      type: String,
      trim: true,
      maxlength: 200
    },

    resourceDescription: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },


    /* =================================================
       HOW PHIL SHOULD USE THE RESOURCE
    ================================================= */

    useType: {
      type: String,
      required: true,
      enum: [
        'standing instruction',
        'organizational context',
        'writing or branding reference',
        'searchable background material',
        'specific task or project'
      ]
    },

    usageInstructions: {
      type: String,
      trim: true,
      maxlength: 5000
    },

    limitations: {
      type: String,
      trim: true,
      maxlength: 5000
    },


    /* =================================================
       RELEVANCE
    ================================================= */

    relevantMarketSector: {
      type: String,
      trim: true,
      maxlength: 250
    },

    relevantDiscipline: {
      type: String,
      trim: true,
      maxlength: 250
    },

    relevantClient: {
      type: String,
      trim: true,
      maxlength: 250
    },

    relevantRegion: {
      type: String,
      trim: true,
      maxlength: 250
    },

    resourceKeywords: {
      type: [String],
      default: []
    },


    /* =================================================
       AUTHORITY AND PERMISSIONS
    ================================================= */

    authorityLevel: {
      type: String,
      required: true,
      enum: [
        'approved corporate standard',
        'approved reference',
        'useful example',
        'historic information',
        'unverified background'
      ]
    },

    confidentiality: {
      type: String,
      enum: [
        'internal',
        'restricted',
        'approved for proposals',
        'approved for public use'
      ],
      default: 'internal'
    },


    /* =================================================
       EFFECTIVE DATES
    ================================================= */

    effectiveDate: {
      type: Date
    },

    reviewDate: {
      type: Date
    },

    supersedesResource: {
      type: String,
      trim: true,
      maxlength: 250
    },


    /* =================================================
       UPLOADED FILES
    ================================================= */

    resourceFiles: {
      type: [resourceFileSchema],
      default: []
    },


    /* =================================================
       INTERNAL MANAGEMENT
    ================================================= */

    internalNotes: {
      type: String,
      trim: true,
      maxlength: 5000
    },

    status: {
      type: String,
      enum: [
        'active',
        'under review',
        'superseded',
        'expired',
        'archived'
      ],
      default: 'active'
    },

processedByPhil: {
  type: Boolean,
  default: false,
  index: true
},

    processingNotes: {
      type: String,
      trim: true,
      maxlength: 5000
    },


    /* =================================================
       OWNERSHIP
    ================================================= */

organization: {
  type: Schema.Types.ObjectId,
  ref: 'PhilOrganization',
  required: true,
  index: true
},

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);


/* =====================================================
   SEARCH INDEX
===================================================== */

instructionResourceSchema.index({
  resourceTitle: 'text',
  resourceDescription: 'text',
  documentOwner: 'text',
  usageInstructions: 'text',
  limitations: 'text',
  relevantMarketSector: 'text',
  relevantDiscipline: 'text',
  relevantClient: 'text',
  relevantRegion: 'text',
  resourceKeywords: 'text',
  internalNotes: 'text'
});


instructionResourceSchema.index({
  organization: 1,
  status: 1,
  resourceCategory: 1
});


instructionResourceSchema.index({
  organization: 1,
  useType: 1,
  authorityLevel: 1
});




module.exports = mongoose.model(
  'InstructionResource',
  instructionResourceSchema
);