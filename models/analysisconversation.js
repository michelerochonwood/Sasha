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