const Proposal = require(
  '../models/proposal'
);

const cloudinary =
  require('../config/cloudinary');


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
   SET ACTIVE PURSUIT
================================================== */

req.session.activePursuitId =
  proposal._id.toString();

req.session.activePursuitName =
  proposal.proposalName;

    /* =================================================
       DEADLINE
    ================================================== */

    const deadline =
      proposal.submissionDeadline
        ? new Date(
            proposal.submissionDeadline
          )
        : null;


    const now =
      new Date();


    let timeRemaining =
      null;


    let isOverdue =
      false;


    if (
      deadline &&
      !Number.isNaN(
        deadline.getTime()
      )
    ) {

      const difference =
        deadline.getTime() -
        now.getTime();


      isOverdue =
        difference <
        0;


      const absoluteDifference =
        Math.abs(
          difference
        );


      const totalHours =
        Math.floor(
          absoluteDifference /
          (
            1000 *
            60 *
            60
          )
        );


      const days =
        Math.floor(
          totalHours /
          24
        );


      const hours =
        totalHours %
        24;


      if (
        isOverdue
      ) {

        timeRemaining = {
          label:
            'Deadline passed',

          days,

          hours
        };

      } else {

        timeRemaining = {
          label:
            days > 0
              ? `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`
              : `${hours} hour${hours === 1 ? '' : 's'}`,

          days,

          hours
        };

      }

    }


    /* =================================================
       WORKFLOW
    ================================================== */

    const workflowStages =
      Array.isArray(
        proposal.workflowStages
      )
        ? proposal.workflowStages
        : [];


    const completedStages =
      workflowStages.filter(
        (
          stage
        ) =>
          stage.status ===
          'complete'
      );


    const inProgressStages =
      workflowStages.filter(
        (
          stage
        ) =>
          stage.status ===
          'in_progress'
      );


    /* =================================================
       TASKS
    ================================================== */

    const tasks =
      Array.isArray(
        proposal.tasks
      )
        ? proposal.tasks
        : [];


    const completedTasks =
      tasks.filter(
        (
          task
        ) =>
          task.status ===
          'complete'
      );


    /* =================================================
       TEAM
    ================================================== */

    const proposalTeam =
      Array.isArray(
        proposal.proposalTeam
      )
        ? proposal.proposalTeam
        : [];


    /* =================================================
       DASHBOARD DATA
    ================================================== */

    const dashboard = {

      deadline,

      timeRemaining,

      isOverdue,

      workflowStages,

      completedStageCount:
        completedStages.length,

      totalStageCount:
        workflowStages.length,

      inProgressStageCount:
        inProgressStages.length,

      tasks,

      completedTaskCount:
        completedTasks.length,

      totalTaskCount:
        tasks.length,

      proposalManager:
        proposal.proposalManager ||
        {},

      proposalTeam,

      proposalTeamCount:
        proposalTeam.length,

      effortLevel:
        proposal.effortLevel ||
        'usual'

    };


    return res.render(
      'pursuit_dashboard',
      {
        layout:
          'mainlayout',

        pageTitle:
          `${proposal.proposalName} | Sasha`,

        proposal,

        dashboard
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
       PREPARE SOURCE DOCUMENTS
    ================================================== */

    const uploadedFiles =
      Array.isArray(req.files)
        ? req.files
        : [];


    const sourceDocuments =
      [];


    /* =================================================
       UPLOAD SOURCE DOCUMENTS
    ================================================== */

    for (
      const file of uploadedFiles
    ) {

      const uploadResult =
        await new Promise(
          (
            resolve,
            reject
          ) => {

            const uploadStream =
              cloudinary.uploader.upload_stream(
                {
                  resource_type:
                    'raw',

                  folder:
                    `sasha/${req.session.organizationId}/pursuit-documents`,

                  public_id:
                    `${Date.now()}-${file.originalname}`,

                  use_filename:
                    true,

                  unique_filename:
                    true
                },

                (
                  error,
                  result
                ) => {

                  if (error) {

                    return reject(
                      error
                    );

                  }


                  return resolve(
                    result
                  );

                }
              );


            uploadStream.end(
              file.buffer
            );

          }
        );


      sourceDocuments.push({
        title:
          file.originalname,

        documentType:
          file.mimetype,

        fileName:
          file.originalname,

        fileUrl:
          uploadResult.secure_url,

        uploadedAt:
          new Date(),

        processedBySasha:
          Boolean(
            aiSummary
          )
      });

    }


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
            '',

          sourceDocuments
        }
      );


    /* =================================================
       SET ACTIVE PURSUIT
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


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
ANALYZE PURSUIT
===================================================== */

exports.analyzePursuit =
async (
  req,
  res
) => {

  /*
   * Sasha's AI analysis will be added here.
   *
   * For now this route exists so the application
   * can start successfully and the controller matches
   * the routes file.
   */

  return res.status(501).json(
    {
      success:
        false,

      errorMessage:
        'Sasha’s pursuit analysis is not connected yet.'
    }
  );

};


/* =====================================================
GET ANALYZE | GO NO GO
===================================================== */

exports.getAnalyzePursuit =
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

      /*
       * Clear a stale pursuit from the session
       * so the user is not repeatedly sent to
       * a pursuit that no longer exists.
       */

      if (
        req.session.activePursuitId ===
        pursuitId
      ) {

        delete req.session.activePursuitId;

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

    let pursuitNotification =
      null;


    /*
     * If the user explicitly selected a pursuit,
     * make it the active pursuit for this session.
     */

    if (
      requestedPursuitId
    ) {

      const previousPursuitId =
        req.session.activePursuitId ||
        null;


      req.session.activePursuitId =
        proposal._id.toString();


      /*
       * Only show the notification when the
       * active pursuit actually changes.
       */

      if (
        previousPursuitId !==
        proposal._id.toString()
      ) {

        pursuitNotification = {
          type:
            'success',

          title:
            'Pursuit selected',

          message:
            `You are now working on Pursuit ${proposal._id}: ${proposal.proposalName}.`
        };

      }

    }


    /* =================================================
       PREPARE ANALYSIS
    ================================================== */

    const rfpAnalysis =
      proposal.rfpAnalysis &&
      typeof proposal.rfpAnalysis ===
        'object'
        ? proposal.rfpAnalysis
        : {};


    const mandatoryRequirements =
      Array.isArray(
        rfpAnalysis.mandatoryRequirements
      )
        ? rfpAnalysis.mandatoryRequirements
        : [];


    const evaluationCriteria =
      Array.isArray(
        rfpAnalysis.evaluationCriteria
      )
        ? rfpAnalysis.evaluationCriteria
        : [];


    const risks =
      Array.isArray(
        rfpAnalysis.risks
      )
        ? rfpAnalysis.risks
        : [];


    const unknowns =
      Array.isArray(
        rfpAnalysis.unknowns
      )
        ? rfpAnalysis.unknowns
        : [];


    /* =================================================
       RENDER
    ================================================== */

    return res.render(
      'sasha_analyze',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Analyze ${proposal.proposalName} | Sasha`,

        proposal,

        rfpAnalysis,

        mandatoryRequirements,

        evaluationCriteria,

        risks,

        unknowns,

        pursuitNotification
      }
    );

  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT ANALYSIS FAILED:',
      error
    );


    return next(
      error
    );

  }

};


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
            'win_strategy'
      );


    /* =================================================
       PREPARE EFFORT LEVEL
    ================================================== */

    const effortLevel =
      proposal.effortLevel ||
      'usual';


    /*
     * These booleans give Handlebars simple values
     * to use later if we want to reduce reliance
     * on helper comparisons.
     */

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

        planTasks,

        effortLevel,

        isMinimalEffort,

        isUsualEffort,

        isFullEffort
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
GET WRITE
===================================================== */

exports.getWritePursuit =
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
       PREPARE CONTENT SECTIONS
    ================================================== */

    const contentSections =
      Array.isArray(
        proposal.contentSections
      )
        ? proposal.contentSections
        : [];


    /* =================================================
       DETERMINE ACTIVE SECTION
    ================================================== */

    const requestedSectionId =
      req.query.section ||
      null;


    let activeSection =
      null;


    if (
      requestedSectionId
    ) {

      activeSection =
        contentSections.find(
          (
            section
          ) =>
            section.sectionId ===
            requestedSectionId
        ) ||
        null;

    }


    /*
     * If no section was requested, use the first
     * proposal section when one exists.
     */

    if (
      !activeSection &&
      contentSections.length >
      0
    ) {

      activeSection =
        contentSections[0];

    }


    /* =================================================
       MARK ACTIVE SECTION FOR HANDLEBARS
    ================================================== */

    const preparedSections =
      contentSections.map(
        (
          section
        ) => {

          return {
            ...section,

            isActive:
              activeSection
                ? section.sectionId ===
                  activeSection.sectionId
                : false
          };

        }
      );


    /*
     * Use the prepared version as the active section too
     * so the view receives the same normalized object.
     */

    if (
      activeSection
    ) {

      activeSection =
        preparedSections.find(
          (
            section
          ) =>
            section.sectionId ===
            activeSection.sectionId
        ) ||
        null;

    }


    /* =================================================
       PREPARE EXISTING PURSUIT WORK
    ================================================== */

    const rfpAnalysis =
      proposal.rfpAnalysis &&
      typeof proposal.rfpAnalysis ===
        'object'
        ? proposal.rfpAnalysis
        : {};


    const plan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    const winStrategy =
      proposal.winStrategy &&
      typeof proposal.winStrategy ===
        'object'
        ? proposal.winStrategy
        : {};


    const outline =
      proposal.outline &&
      typeof proposal.outline ===
        'object'
        ? proposal.outline
        : {};


    /* =================================================
       RENDER
    ================================================== */

    return res.render(
      'sasha_write',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Write ${proposal.proposalName} | Sasha`,

        proposal,

        contentSections:
          preparedSections,

        activeSection,

        rfpAnalysis,

        plan,

        winStrategy,

        outline,

        /*
         * Saved multi-turn writing conversations
         * will be wired in later.
         */

        writeMessages:
          []
      }
    );

  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT WRITE FAILED:',
      error
    );


    return next(
      error
    );

  }

};


/* =====================================================
GET REVIEW
===================================================== */

exports.getReviewPursuit =
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
       PREPARE CONTENT SECTIONS
    ================================================== */

    const contentSections =
      Array.isArray(
        proposal.contentSections
      )
        ? proposal.contentSections
        : [];


    /* =================================================
       PREPARE REVIEWS
    ================================================== */

    const reviews =
      proposal.reviews &&
      typeof proposal.reviews ===
        'object'
        ? proposal.reviews
        : {};


    /* =================================================
       PREPARE REVIEW FINDINGS
    ================================================== */

    const reviewFindings =
      Array.isArray(
        reviews.findings
      )
        ? reviews.findings
        : [];


    const openReviewFindings =
      reviewFindings.filter(
        (
          finding
        ) =>
          finding.status !==
          'resolved'
      );


    /* =================================================
       PREPARE REVIEW STATUS
    ================================================== */

    const reviewStatus =
      reviews.status &&
      typeof reviews.status ===
        'object'
        ? reviews.status
        : {};


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
      'sasha_review',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Review ${proposal.proposalName} | Sasha`,

        proposal,

        contentSections,

        reviews,

        reviewFindings,

        openReviewFindingCount:
          openReviewFindings.length,

        reviewStatus,

        effortLevel,

        isMinimalEffort,

        isUsualEffort,

        isFullEffort,

        /*
         * Multi-turn review conversation
         * will be connected later.
         */

        reviewMessages:
          []
      }
    );

  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT REVIEW FAILED:',
      error
    );


    return next(
      error
    );

  }

};
