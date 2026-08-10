const mongoose = require("mongoose");

const proposalSchema = new mongoose.Schema(
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
      ref: "Organization",
      required: true,
      index: true
    },


    /* =====================================================
       PROPOSAL IDENTITY
    ===================================================== */

    proposalName: {
      type: String,
      trim: true,
      required: true
    },

    clientName: {
      type: String,
      trim: true,
      default: ""
    },

    rfpNumber: {
      type: String,
      trim: true,
      default: ""
    },

    submissionDeadline: {
      type: Date,
      default: null
    },


    /* =====================================================
       STATUS
    ===================================================== */

    proposalStatus: {
      type: String,

      enum: [
        "new",
        "planning",
        "writing",
        "review",
        "submitted",
        "won",
        "lost",
        "withdrawn",
        "cancelled"
      ],

      default: "new"
    },


    /* =====================================================
       SOURCE DOCUMENTS
    ===================================================== */

    sourceDocuments: [
      {
        title: {
          type: String,
          trim: true,
          default: ""
        },

        documentType: {
          type: String,
          trim: true,
          default: ""
        },

        fileName: {
          type: String,
          trim: true,
          default: ""
        },

        fileUrl: {
          type: String,
          trim: true,
          default: ""
        },

        uploadedAt: {
          type: Date,
          default: Date.now
        },

        processedBySasha: {
          type: Boolean,
          default: false
        }
      }
    ],


    /* =====================================================
       SASHA WORK PRODUCTS
    ===================================================== */

    rfpAnalysis: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    outline: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    winStrategy: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    plan: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    reviews: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },


    /* =====================================================
       FINAL PROPOSAL
    ===================================================== */

    proposalDocuments: [
      {
        title: {
          type: String,
          trim: true,
          default: ""
        },

        fileName: {
          type: String,
          trim: true,
          default: ""
        },

        fileUrl: {
          type: String,
          trim: true,
          default: ""
        },

        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],


    /* =====================================================
       OUTCOME
    ===================================================== */

    outcome: {
      status: {
        type: String,

        enum: [
          "pending",
          "won",
          "lost",
          "withdrawn",
          "cancelled",
          "unknown"
        ],

        default: "pending"
      },

      decisionDate: {
        type: Date,
        default: null
      },

      notes: {
        type: String,
        trim: true,
        default: ""
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

    aiSummary: {
      type: String,
      trim: true,
      default: ""
    }

  },

  {
    timestamps: true
  }
);


module.exports =
  mongoose.model(
    "Proposal",
    proposalSchema
  );