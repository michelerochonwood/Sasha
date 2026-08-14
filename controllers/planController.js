const Proposal = require(
  '../models/proposal'
);


/* =====================================================
   GET PLAN | WIN STRATEGY
===================================================== */

exports.getPlanPursuit =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       DETERMINE PURSUIT
    ================================================== */

    const requestedPursuitId =
      req.query.pursuit ||
      null;


    const pursuitId =
      requestedPursuitId ||
      req.session.activePursuitId ||
      null;


    /* =================================================
       REQUIRE PURSUIT
    ================================================== */

    if (
      !pursuitId
    ) {

      return res.redirect(
        '/pursuits'
      );

    }


    /* =================================================
       FIND PURSUIT
    ================================================== */

    const proposal =
      await Proposal.findOne(
        {
          _id:
            pursuitId,

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

      if (
        req.session.activePursuitId ===
        pursuitId
      ) {

        delete req.session.activePursuitId;
        delete req.session.activePursuitName;

      }


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
       SET ACTIVE PURSUIT
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


    /* =================================================
       PREPARE PLAN
    ================================================== */

    const plan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    /* =================================================
       PREPARE WIN STRATEGY
    ================================================== */

    const winStrategy =
      proposal.winStrategy &&
      typeof proposal.winStrategy ===
        'object'
        ? proposal.winStrategy
        : {};


    /* =================================================
       PREPARE OUTLINE
    ================================================== */

    const outline =
      proposal.outline &&
      typeof proposal.outline ===
        'object'
        ? proposal.outline
        : {
            title:
              'Proposal Outline',

            notes:
              '',

            sections:
              []
          };


    if (
      !Array.isArray(
        outline.sections
      )
    ) {

      outline.sections =
        [];

    }


    /* =================================================
       PREPARE PLAN TASKS
    ================================================== */

    const tasks =
      Array.isArray(
        proposal.tasks
      )
        ? proposal.tasks
        : [];


    const planTasks =
      tasks.filter(
        (
          task
        ) =>
          task.stage ===
            'plan' ||
          task.stage ===
            'win_strategy' ||
          task.stage ===
            'outline'
      );


    /* =================================================
       PREPARE EFFORT LEVEL
    ================================================== */

    const effortLevel =
      proposal.effortLevel ||
      'usual';


    const isMinimalEffort =
      effortLevel ===
      'minimal';


    const isUsualEffort =
      effortLevel ===
      'usual';


    const isFullEffort =
      effortLevel ===
      'full';


    /* =================================================
       RENDER
    ================================================== */

    return res.render(
      'sasha_plan',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Plan ${proposal.proposalName} | Sasha`,

        proposal,

        plan,

        winStrategy,

        outline,

        planTasks,

        effortLevel,

        isMinimalEffort,

        isUsualEffort,

        isFullEffort,

        planMessages:
          []
      }
    );


  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT PLAN FAILED:',
      error
    );


    return next(
      error
    );

  }

};


/* =====================================================
   PLAN | WIN STRATEGY CHAT
===================================================== */

exports.postPlanChat =
async (
  req,
  res,
  next
) => {

  try {

    console.log(
      'SASHA PLAN CHAT RECEIVED'
    );

    console.log(
      'PURSUIT ID:',
      req.body.pursuitId
    );

    console.log(
      'MESSAGE:',
      req.body.message
    );


    return res.redirect(
      `/plan?pursuit=${req.body.pursuitId}`
    );


  } catch (
    error
  ) {

    console.error(
      'SASHA PLAN CHAT FAILED:',
      error
    );


    return next(
      error
    );

  }

};