const OpenAI = require(
  'openai'
);


/* =====================================================
   CREATE OPENAI CLIENT
===================================================== */

function createClient(
  apiKey
) {

  if (!apiKey) {

    throw new Error(
      'OPENAI_API_KEY is not configured.'
    );

  }


  return new OpenAI({
    apiKey
  });

}


/* =====================================================
   EXPORT SERVICE
===================================================== */

module.exports = {
  createClient
};