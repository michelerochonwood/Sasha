/* =====================================================
   GET ADD INSTRUCTIONS
===================================================== */

exports.getAddInstructions =
(
  req,
  res
) => {

  return res.render(
    'add_instructions',
    {
      layout:
        'mainlayout',

      pageTitle:
        'Add Instructions | Sasha'
    }
  );

};


/* =====================================================
   ANALYZE INSTRUCTION RESOURCE
===================================================== */

exports.analyzeInstruction =
async (
  req,
  res
) => {

  /*
   * Sasha's document analysis will be connected here.
   *
   * Eventually this function will:
   *
   * 1. Receive uploaded files.
   * 2. Send them to Sasha/OpenAI for analysis.
   * 3. Prepare suggested form values.
   * 4. Return an analysis token.
   * 5. NOT permanently save anything yet.
   */

  return res.status(501).json(
    {
      success:
        false,

      errorMessage:
        'Sasha’s instruction analysis is not connected yet.'
    }
  );

};


/* =====================================================
   POST ADD INSTRUCTIONS
===================================================== */

exports.postAddInstructions =
async (
  req,
  res
) => {

  /*
   * Permanent resource storage will be connected here.
   *
   * This should eventually save the resource only after
   * the user has reviewed Sasha's suggestions and
   * confirmed authority and confidentiality.
   */

  return res.status(501).render(
    'add_instructions',
    {
      layout:
        'mainlayout',

      pageTitle:
        'Add Instructions | Sasha',

      errorMessage:
        'Saving Sasha resources is not connected yet.',

      formData:
        req.body
    }
  );

};