const Proposal = require(
  '../models/proposal'
);


/* =====================================================
GET CREATE PURSUIT
===================================================== */

exports.getCreatePursuit =
(req, res) => {

  return res.render(
    'create_pursuit',
    {
      layout:
        'mainlayout',

      pageTitle:
        'Create a Pursuit | Sasha'
    }
  );

};


/* =====================================================
ANALYZE PURSUIT
===================================================== */

exports.analyzePursuit =
async (req, res) => {

  /*
   * Sasha's AI analysis will be added here.
   *
   * For now this route exists so the application
   * can start successfully and the controller matches
   * the routes file.
   */

  return res.status(501).json({
    success:
      false,

    errorMessage:
      'Sasha’s pursuit analysis is not connected yet.'
  });

};


/* =====================================================
POST CREATE PURSUIT
===================================================== */

exports.postCreatePursuit =
async (
  req,
  res,
  next
) => {

  try {

    const {
      proposalName,
      clientName,
      rfpNumber,
      submissionDeadline,
      proposalStatus,
      searchKeywords,
      aiSummary
    } =
      req.body;


    /* =================================================
       VALIDATE REQUIRED INFORMATION
    ================================================== */

    if (
      !proposalName ||
      !proposalName.trim()
    ) {

      return res.status(400).render(
        'create_pursuit',
        {
          layout:
            'mainlayout',

          pageTitle:
            'Create a Pursuit | Sasha',

          errorMessage:
            'Enter a pursuit name before creating the pursuit.',

          formData:
            req.body
        }
      );

    }


    /* =================================================
       PREPARE SEARCH KEYWORDS
    ================================================== */

    const keywords =
      searchKeywords
        ? searchKeywords
            .split(',')
            .map(
              (keyword) =>
                keyword.trim()
            )
            .filter(Boolean)
        : [];


    /* =================================================
       CREATE PURSUIT
    ================================================== */

    const proposal =
      await Proposal.create(
        {
          organization:
            req.session.organizationId,

          proposalName:
            proposalName.trim(),

          clientName:
            clientName
              ? clientName.trim()
              : '',

          rfpNumber:
            rfpNumber
              ? rfpNumber.trim()
              : '',

          submissionDeadline:
            submissionDeadline ||
            null,

          proposalStatus:
            proposalStatus ||
            'new',

          searchKeywords:
            keywords,

          aiSummary:
            aiSummary ||
            ''
        }
      );


    /* =================================================
       REDIRECT TO PURSUIT DASHBOARD
    ================================================== */

    return res.redirect(
      `/pursuit/${proposal._id}`
    );

  } catch (
    error
  ) {

    console.error(
      'CREATE PURSUIT FAILED:',
      error
    );


    return next(
      error
    );

  }

};


/* =====================================================
GET PURSUITS
===================================================== */

exports.getPursuits =
async (
  req,
  res,
  next
) => {

  try {

    const proposals =
      await Proposal.find(
        {
          organization:
            req.session.organizationId
        }
      )
        .sort(
          {
            createdAt:
              -1
          }
        )
        .lean();


    return res.render(
      'pursuits',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Pursuits | Sasha',

        proposals
      }
    );

  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUITS FAILED:',
      error
    );


    return next(
      error
    );

  }

};


/* =====================================================
GET PURSUIT DASHBOARD
===================================================== */

exports.getPursuitDashboard =
async (
  req,
  res,
  next
) => {

  try {

    const proposal =
      await Proposal.findOne(
        {
          _id:
            req.params.id,

          organization:
            req.session.organizationId
        }
      )
        .lean();


    /* =================================================
       PURSUIT NOT FOUND
    ================================================== */

    if (
      !proposal
    ) {

      return res.status(404).render(
        'not_found',
        {
          layout:
            'mainlayout',

          pageTitle:
            'Pursuit Not Found | Sasha'
        }
      );

    }


    /* =================================================
       RENDER DASHBOARD
    ================================================== */

    return res.render(
      'pursuit_dashboard',
      {
        layout:
          'mainlayout',

        pageTitle:
          `${proposal.proposalName} | Sasha`,

        proposal
      }
    );

  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT FAILED:',
      error
    );


    return next(
      error
    );

  }

};