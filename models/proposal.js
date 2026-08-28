const mongoose = require("mongoose");
const analysisConversationSchema =
  require(
    './analysisconversation'
  );

const proposalSchema = new mongoose.Schema(
  {

    /* =====================================================
       SCHEMA VERSION
    ===================================================== */

    schemaVersion: {
      type: Number,
      default: 2,
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

    pursuitDocuments: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PursuitDocument'
  }
],


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
   PURSUIT MANAGEMENT
===================================================== */



proposalManager: {
  name: {
    type: String,
    trim: true,
    default: ""
  },

  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ""
  }
},


proposalTeam: [
  {
    name: {
      type: String,
      trim: true,
      default: ""
    },

    role: {
      type: String,
      trim: true,
      default: ""
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: ""
    }
  }
],


effortLevel: {
  type: String,

  enum: [
    "minimal",
    "usual",
    "full"
  ],

  default: "usual"
},


/* =====================================================
   PURSUIT WORKFLOW
===================================================== */

workflowStages: [
  {
    stage: {
      type: String,

      enum: [
        "create",
        "analyze",
        "go_no_go",
        "plan",
        "win_strategy",
        "outline",
        "write",
        "review",
        "submission",
        "outcome"
      ],

      required: true
    },

    status: {
      type: String,

      enum: [
        "not_started",
        "in_progress",
        "complete",
        "skipped"
      ],

      default: "not_started"
    },

    completedAt: {
      type: Date,
      default: null
    },

    notes: {
      type: String,
      trim: true,
      default: ""
    }
  }
],


tasks: [
  {
    title: {
      type: String,
      trim: true,
      required: true
    },

    stage: {
      type: String,
      trim: true,
      default: ""
    },

    assignedTo: {
      type: String,
      trim: true,
      default: ""
    },

    dueDate: {
      type: Date,
      default: null
    },

    status: {
      type: String,

      enum: [
        "not_started",
        "in_progress",
        "complete",
        "skipped"
      ],

      default: "not_started"
    },

    completedAt: {
      type: Date,
      default: null
    }
  }
],

/* =====================================================
   CHANGE IMPACTS
===================================================== */

changeImpacts: [
  {
    changeType: {
      type: String,

      enum: [
        'submission_deadline',
        'evaluation_criteria',
        'submission_requirements',
        'scope',
        'team_requirements',
        'pricing_requirements',
        'other'
      ],

      required: true
    },


    sourceDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PursuitDocument',
      default: null
    },


    detectedAt: {
      type: Date,
      default: Date.now
    },


    previousValue: {
      type: String,
      trim: true,
      default: ''
    },


    newValue: {
      type: String,
      trim: true,
      default: ''
    },


    summary: {
      type: String,
      trim: true,
      default: ''
    },


    affectedAreas: [
      {
        type: String,

        enum: [
          'dashboard',
          'analysis',
          'schedule',
          'milestones',
          'production',
          'tasks',
          'outline',
          'content',
          'review'
        ]
      }
    ],


    status: {
      type: String,

      enum: [
        'pending_review',
        'accepted',
        'dismissed'
      ],

      default: 'pending_review'
    },


    reviewedAt: {
      type: Date,
      default: null
    },

    /* =================================================
   PROPOSED PLAN CHANGES
================================================= */

proposedChanges: {

  schedule: {
    type: String,
    default: ''
  },

  responsibilities: {
  type: String,
  default: ''
},


  milestones: {
    type: String,
    default: ''
  },


  production: {
    type: String,
    default: ''
  },


  tasks: [
    {
      taskId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
      },

      title: {
        type: String,
        trim: true,
        default: ''
      },

      previousDueDate: {
        type: Date,
        default: null
      },

      proposedDueDate: {
        type: Date,
        default: null
      }
    }
  ],

  generatedAt: {
    type: Date,
    default: null
  }
}
  }
],
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


/* =====================================================
   GO / NO GO
===================================================== */

goNoGo: {

  recommendation: {
    type: String,

    enum: [
      '',
      'go',
      'no_go',
      'go_and_get'
    ],

    default: ''
  },

  confidence: {
    type: String,

    enum: [
      '',
      'low',
      'medium',
      'high'
    ],

    default: ''
  },

  rationale: {
    type: String,
    trim: true,
    default: ''
  },

  strengths: [
    {
      type: String,
      trim: true
    }
  ],

  concerns: [
    {
      type: String,
      trim: true
    }
  ],

  conditions: [
    {
      type: String,
      trim: true
    }
  ],

  recommendedAt: {
    type: Date,
    default: null
  },


  /* =================================================
     PURSUIT TEAM DECISION
  ================================================== */

  decision: {
    type: String,

    enum: [
      '',
      'go',
      'no_go',
      'go_and_get'
    ],

    default: ''
  },

  decisionNotes: {
    type: String,
    trim: true,
    default: ''
  },

  decidedBy: {
    type: String,
    trim: true,
    default: ''
  },

  decidedAt: {
    type: Date,
    default: null
  }

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

    contentSections: [
  {
    sectionId: {
      type: String,
      trim: true,
      default: ""
    },

    title: {
      type: String,
      trim: true,
      required: true
    },

    order: {
      type: Number,
      default: 0
    },

    status: {
      type: String,

      enum: [
        "not_started",
        "drafting",
        "drafted",
        "reviewed",
        "final"
      ],

      default: "not_started"
    },

    content: {
      type: String,
      default: ""
    },

    notes: {
      type: String,
      default: ""
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  }
],


/* =====================================================
   ANALYSIS CONVERSATION
===================================================== */

analysisMessages: {
  type: [
    analysisConversationSchema
  ],

  default: []
},

/* =====================================================
   PLAN CONVERSATION
===================================================== */

planMessages: [
  analysisConversationSchema
],


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