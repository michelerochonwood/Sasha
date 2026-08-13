const mongoose =
  require(
    'mongoose'
  );


/* =====================================================
   ANALYSIS CONVERSATION MESSAGE
===================================================== */

const analysisConversationSchema =
  new mongoose.Schema(
    {
      role: {
        type: String,

        enum: [
          'user',
          'assistant'
        ],

        required: true
      },

      content: {
        type: String,

        required: true,

        trim: true
      },


      /* =================================================
         WORK PRODUCT UPDATE
      ================================================== */

      workProduct: {

        type: {
          type: String,

          trim: true,

          default: ''
        },

        updated: {
          type: Boolean,

          default: false
        },

        label: {
          type: String,

          trim: true,

          default: ''
        },

        href: {
          type: String,

          trim: true,

          default: ''
        }
      },


      /* =================================================
         CREATED
      ================================================== */

      createdAt: {
        type: Date,

        default:
          Date.now
      }
    },
    {
      _id:
        true
    }
  );


/* =====================================================
   EXPORT SCHEMA
===================================================== */

module.exports =
  analysisConversationSchema;