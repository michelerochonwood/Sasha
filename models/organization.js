const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const organizationSchema = new mongoose.Schema(
  {
    /* =====================================================
       ORGANIZATION IDENTITY
    ===================================================== */

    organizationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },

    organizationType: {
      type: String,
      enum: [
        'engineering',
        'architecture',
        'construction',
        'planning',
        'environmental',
        'consulting',
        'government',
        'other'
      ],
      default: 'engineering'
    },

    website: {
      type: String,
      trim: true
    },

    primaryContactName: {
      type: String,
      trim: true
    },

    primaryContactEmail: {
      type: String,
      trim: true,
      lowercase: true
    },

    primaryContactPhone: {
      type: String,
      trim: true
    },


    /* =====================================================
       SHARED ORGANIZATION LOGIN
    ===================================================== */

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 4,
      maxlength: 80,
      index: true
    },

    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false
    },

    passwordChangedAt: {
      type: Date
    },

    lastLoginAt: {
      type: Date
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0
    },

    loginLockedUntil: {
      type: Date
    },


    /* =====================================================
       ACCOUNT STATUS
    ===================================================== */

accountStatus: {
  type: String,
  enum: [
    'pending_payment',
    'trial',
    'active',
    'past_due',
    'suspended',
    'cancelled'
  ],
  default: 'pending_payment',
  index: true
},

isActive: {
  type: Boolean,
  default: false
},

    trialEndsAt: {
      type: Date
    },

    activatedAt: {
      type: Date
    },

    cancelledAt: {
      type: Date
    },


    /* =====================================================
       AI CONNECTION
    ===================================================== */

    aiSettings: {
      accessMode: {
        type: String,
        enum: [
          'disabled',
          'twennie',
          'organization'
        ],
        default: 'disabled'
      },

      provider: {
        type: String,
        enum: [
          'openai'
        ],
        default: 'openai'
      },

      encryptedApiKey: {
        type: String,
        default: null,
        select: false
      },

      apiKeyIv: {
        type: String,
        default: null,
        select: false
      },

      apiKeyAuthTag: {
        type: String,
        default: null,
        select: false
      },

      apiKeyLastFour: {
        type: String,
        default: null
      },

      connectionStatus: {
        type: String,
        enum: [
          'not_configured',
          'active',
          'invalid'
        ],
        default: 'not_configured'
      },

      lastConnectionTestAt: {
        type: Date,
        default: null
      },

      twennieAccessExpiresAt: {
        type: Date,
        default: null
      },


      /* =================================================
         OPENAI KNOWLEDGE BASE
      ================================================== */

      vectorStoreId: {
        type: String,
        trim: true,
        default: null
      },

      vectorStoreStatus: {
        type: String,

        enum: [
          'not_created',
          'creating',
          'ready',
          'error'
        ],

        default: 'not_created'
      },

      vectorStoreCreatedAt: {
        type: Date,
        default: null
      },

      vectorStoreLastUpdatedAt: {
        type: Date,
        default: null
      },

      vectorStoreError: {
        type: String,
        trim: true,
        maxlength: 2000,
        default: null
      }
    },

/* =====================================================
   SUBSCRIPTION AND BILLING
===================================================== */

subscriptionPlan: {
  type: String,
  enum: [
    'phil_monthly',
    'phil_annual',
    'custom',
    'complimentary'
  ],
  default: 'phil_monthly'
},

monthlyPrice: {
  type: Number,
  default: 399,
  min: 0
},

discountPercentage: {
  type: Number,
  default: 0,
  min: 0,
  max: 100
},

stripeCustomerId: {
  type: String,
  trim: true,
  index: true
},

stripeCheckoutSessionId: {
  type: String,
  trim: true,
  index: true
},

stripeSubscriptionId: {
  type: String,
  trim: true,
  index: true
},

stripePriceId: {
  type: String,
  trim: true
},

stripeSubscriptionStatus: {
  type: String,
  enum: [
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  ],
  default: null,
  index: true
},

billingEmail: {
  type: String,
  trim: true,
  lowercase: true
},

subscriptionStartedAt: {
  type: Date
},

subscriptionRenewsAt: {
  type: Date
},

cancelAtPeriodEnd: {
  type: Boolean,
  default: false
},

scheduledCancellationAt: {
  type: Date
},

lastStripeEventId: {
  type: String,
  trim: true
},

lastStripeEventAt: {
  type: Date
},

/* =====================================================
   TWENNIE CONNECTION
===================================================== */

twennieOrganizationId: {
  type: String,
  trim: true,
  default: null
},

twennieSeatCount: {
  type: Number,
  default: 0,
  min: 0
},

twennieDiscountTier: {
  type: String,
  enum: [
    'none',
    'tier_1',
    'tier_2',
    'tier_3',
    'custom'
  ],
  default: 'none'
},

    /* =====================================================
       ORGANIZATION PROFILE
    ===================================================== */

    headquartersCity: {
      type: String,
      trim: true
    },

    headquartersProvinceState: {
      type: String,
      trim: true
    },

    headquartersCountry: {
      type: String,
      trim: true,
      default: 'Canada'
    },

    operatingRegions: [{
      type: String,
      trim: true
    }],

    marketSectors: [{
      type: String,
      trim: true
    }],

    disciplines: [{
      type: String,
      trim: true
    }],

    services: [{
      type: String,
      trim: true
    }],


    /* =====================================================
       BRANDING
    ===================================================== */

    logoUrl: {
      type: String,
      trim: true
    },

    primaryBrandColour: {
      type: String,
      trim: true
    },

    secondaryBrandColour: {
      type: String,
      trim: true
    },

    preferredFont: {
      type: String,
      trim: true
    },

    defaultWritingStyle: {
      type: String,
      enum: [
        'professional',
        'casual',
        'fun',
        'interactive',
        'idea'
      ],
      default: 'professional'
    },

    spellingPreference: {
      type: String,
      enum: [
        'canadian',
        'american',
        'british'
      ],
      default: 'canadian'
    },


    /* =====================================================
       PHIL SETTINGS
    ===================================================== */

    philSettings: {
      allowProjectCreation: {
        type: Boolean,
        default: true
      },

      allowProjectEditing: {
        type: Boolean,
        default: true
      },

      allowProjectDeletion: {
        type: Boolean,
        default: false
      },

      allowDocumentUploads: {
        type: Boolean,
        default: true
      },

      allowAiAnalysis: {
        type: Boolean,
        default: true
      },

      requireDeletionConfirmation: {
        type: Boolean,
        default: true
      },

      defaultProjectVisibility: {
        type: String,
        enum: [
          'organization',
          'restricted'
        ],
        default: 'organization'
      }
    },


    /* =====================================================
       AI CONNECTION
    ===================================================== */

    aiProvider: {
      type: String,
      enum: [
        'openai',
        'anthropic',
        'microsoft',
        'google',
        'other',
        'not_configured'
      ],
      default: 'not_configured'
    },

    aiConnectionStatus: {
      type: String,
      enum: [
        'not_configured',
        'connected',
        'error',
        'disabled'
      ],
      default: 'not_configured'
    },

    aiModelPreference: {
      type: String,
      trim: true
    },

    /*
     * Do not store a client's raw AI API key here.
     * Store an encrypted credential reference or secret-manager ID.
     */
    aiCredentialReference: {
      type: String,
      select: false
    },


    /* =====================================================
       USAGE INFORMATION
    ===================================================== */

    lastActivityAt: {
      type: Date
    },

    totalLoginCount: {
      type: Number,
      default: 0,
      min: 0
    },

    totalProjectsCreated: {
      type: Number,
      default: 0,
      min: 0
    },

    totalAiRequests: {
      type: Number,
      default: 0,
      min: 0
    },


    /* =====================================================
       ADMINISTRATION
    ===================================================== */

    internalNotes: {
      type: String,
      trim: true,
      select: false
    },

    onboardingStatus: {
      type: String,
      enum: [
        'not_started',
        'in_progress',
        'complete'
      ],
      default: 'not_started'
    },

    onboardingCompletedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);


/* =====================================================
   PASSWORD HASHING
===================================================== */

organizationSchema.pre(
  'save',
  async function saveOrganization() {

    if (!this.isModified('password')) {
      return;
    }

    const saltRounds = 12;

    this.password = await bcrypt.hash(
      this.password,
      saltRounds
    );

    this.passwordChangedAt = new Date();

  }
);


/* =====================================================
   PASSWORD COMPARISON
===================================================== */

organizationSchema.methods.comparePassword =
  async function comparePassword(candidatePassword) {
    return bcrypt.compare(
      candidatePassword,
      this.password
    );
  };


/* =====================================================
   ACCOUNT ACCESS CHECK
===================================================== */

organizationSchema.methods.canSignIn =
  function canSignIn() {

    if (!this.isActive) {
      return false;
    }

    if (this.accountStatus !== 'active') {
      return false;
    }

    if (
      this.loginLockedUntil &&
      this.loginLockedUntil > new Date()
    ) {
      return false;
    }

    return true;
  };

  


/* =====================================================
   VIRTUALS
===================================================== */

organizationSchema.virtual('effectiveMonthlyPrice').get(function getPrice() {
  const basePrice = this.monthlyPrice || 0;
  const discount = this.discountPercentage || 0;

  return Number(
    (basePrice * (1 - discount / 100)).toFixed(2)
  );
});


organizationSchema.virtual('projectCount', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'organization',
  count: true
});


organizationSchema.virtual('instructionCount', {
  ref: 'InstructionResource',
  localField: '_id',
  foreignField: 'organization',
  count: true
});


organizationSchema.set('toJSON', {
  virtuals: true,
  transform: function transformDocument(document, returnedObject) {
    delete returnedObject.password;
    delete returnedObject.aiCredentialReference;
    delete returnedObject.internalNotes;

    return returnedObject;
  }
});


module.exports = mongoose.model(
  'PhilOrganization',
  organizationSchema
);