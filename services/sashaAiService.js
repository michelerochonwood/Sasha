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
      'An OpenAI API key was not provided.'
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