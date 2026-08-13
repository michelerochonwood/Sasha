/* =====================================================
   ANALYSIS CONVERSATION MESSAGE
===================================================== */

const analysisMessageSchema =
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