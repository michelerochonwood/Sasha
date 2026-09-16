const Proposal = require(
  '../models/proposal'
);


/* =====================================================
   GET OUTCOME PURSUIT
===================================================== */

exports.getOutcomePursuit =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       DETERMINE ACTIVE PURSUIT
    ================================================== */

    const pursuitId =
      req.session.activePursuitId ||
      null;


    /* =================================================
       REQUIRE ACTIVE PURSUIT
    ================================================== */

    if (
      !pursuitId
    ) {

      return res.redirect(
        '/pursuits'
      );

    }


    /* =================================================
       REQUIRE ORGANIZATION
    ================================================== */

    const organizationId =
      req.session.organizationId ||
      null;


    if (
      !organizationId
    ) {

      return res.redirect(
        '/login'
      );

    }


    /* =================================================
       LOAD PURSUIT
    ================================================== */

    const pursuit =
      await Proposal.findOne(
        {
          _id:
            pursuitId,

          organization:
            organizationId
        }
      )
      .lean();


    /* =================================================
       PURSUIT NOT FOUND
    ================================================== */

    if (
      !pursuit
    ) {

      req.session.activePursuitId =
        null;

      return res.redirect(
        '/pursuits'
      );

    }


    /* =================================================
       NORMALIZE OUTCOME DATA FOR VIEW
    ================================================== */

    pursuit.outcome =
      pursuit.outcome ||
      {};


    pursuit.outcome.debrief =
      pursuit.outcome.debrief ||
      {};


    pursuit.outcome.evaluationResults =
      Array.isArray(
        pursuit.outcome.evaluationResults
      )
        ? pursuit.outcome.evaluationResults
        : [];


    pursuit.outcome.outcomeFactors =
      Array.isArray(
        pursuit.outcome.outcomeFactors
      )
        ? pursuit.outcome.outcomeFactors
        : [];


    pursuit.outcome.lessons =
      pursuit.outcome.lessons ||
      {};


    pursuit.outcome.lessons.repeat =
      Array.isArray(
        pursuit.outcome.lessons.repeat
      )
        ? pursuit.outcome.lessons.repeat
        : [];


    pursuit.outcome.lessons.change =
      Array.isArray(
        pursuit.outcome.lessons.change
      )
        ? pursuit.outcome.lessons.change
        : [];


    pursuit.outcome.lessons.watchFor =
      Array.isArray(
        pursuit.outcome.lessons.watchFor
      )
        ? pursuit.outcome.lessons.watchFor
        : [];


    pursuit.proposalDocuments =
      Array.isArray(
        pursuit.proposalDocuments
      )
        ? pursuit.proposalDocuments
        : [];


    /* =================================================
       RENDER OUTCOME WORKSPACE
    ================================================== */

    return res.render(
      'outcome_view',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Outcome | ${pursuit.proposalName} | Sasha`,

        pursuit
      }
    );

  } catch (
    error
  ) {

    console.error(
      'GET OUTCOME PURSUIT ERROR:',
      error
    );

    return next(
      error
    );

  }

};