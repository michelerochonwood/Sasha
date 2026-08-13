const Proposal = require(
  '../models/proposal'
);

const cloudinary =
  require('../config/cloudinary');


const OpenAI = require(
  'openai'
);


const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY
  });


/* =====================================================
   ANALYZE PURSUIT CHAT
===================================================== */

exports.postAnalyzeChat = async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       REQUEST INFORMATION
    ================================================== */

    const pursuitId =
      typeof req.body.pursuitId ===
        'string'
        ? req.body.pursuitId.trim()
        : '';


    const message =
      typeof req.body.message ===
        'string'
        ? req.body.message.trim()
        : '';


    if (
      !pursuitId
    ) {

      return res.redirect(
        '/pursuits'
      );

    }


    if (
      !message
    ) {

      return res.redirect(
        `/analyze?pursuit=${pursuitId}`
      );

    }


    if (
      message.length >
      10000
    ) {

      return res.status(400).send(
        'Please shorten your message and try again.'
      );

    }


    /* =================================================
       FIND PURSUIT
    ================================================== */

    const proposal =
      await Proposal.findOne({
        _id:
          pursuitId,

        organization:
          req.session.organizationId
      });


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
       EXISTING CONVERSATION
    ================================================== */

    const existingMessages =
      Array.isArray(
        proposal.analysisMessages
      )
        ? proposal.analysisMessages
        : [];


    /* =================================================
       PREPARE PURSUIT CONTEXT
    ================================================== */

    const pursuitContext = {

      proposalName:
        proposal.proposalName ||
        '',

      clientName:
        proposal.clientName ||
        '',

      rfpNumber:
        proposal.rfpNumber ||
        '',

      submissionDeadline:
        proposal.submissionDeadline ||
        null,

      proposalStatus:
        proposal.proposalStatus ||
        '',

      effortLevel:
        proposal.effortLevel ||
        '',

      aiSummary:
        proposal.aiSummary ||
        '',

      rfpAnalysis:
        proposal.rfpAnalysis ||
        {},

      searchKeywords:
        proposal.searchKeywords ||
        []

    };


    /* =================================================
       SASHA ANALYSIS INSTRUCTIONS
    ================================================== */

    const analysisInstructions = `
You are Sasha, an AI proposal and pursuit assistant for
technical consulting firms.

You are currently working inside the ANALYZE | GO NO GO
stage of one specific pursuit.

Your role is to work conversationally with the pursuit team
as an experienced proposal professional.

Help the user understand and assess the opportunity,
including where relevant:

- the RFP and procurement requirements
- mandatory requirements and compliance
- contractual and commercial risk
- delivery and technical risk
- submission requirements
- evaluation criteria
- client priorities
- competitive position
- Go / No Go considerations
- Go and Get position
- strengths and weaknesses
- unknowns and required clarifications
- appropriate proposal effort
- sensible next steps

Use the pursuit record and its source documents as evidence.

Do not invent requirements, dates, evaluation weights,
contract terms, client preferences, competitive intelligence,
or other facts.

When something is not supported by the pursuit record or
source documents, say so.

You may make professional observations and inferences, but
clearly distinguish an inference from a fact contained in
the source material.

Do not pretend that an analysis has been completed when the
available information does not support it.

Be practical and conversational. Work like an experienced
proposal colleague rather than an administrative form.

Recommend useful process when appropriate, but do not police
the proposal team or insist that every best practice be used.

If the user asks a direct question, answer it directly before
suggesting additional work.

The pursuit record currently contains:

${JSON.stringify(
  pursuitContext,
  null,
  2
)}
`;


    /* =================================================
       CONVERSATION HISTORY
    ================================================== */

    const conversationInput =
      existingMessages
        .slice(-20)
        .map(
          (
            savedMessage
          ) => {

            return {
              role:
                savedMessage.role,

              content:
                savedMessage.content
            };

          }
        );


    /* =================================================
       CURRENT USER MESSAGE
    ================================================== */

    const currentContent = [
      {
        type:
          'input_text',

        text:
          message
      }
    ];


    /* =================================================
       ATTACH PURSUIT SOURCE DOCUMENTS
    ================================================== */

    const sourceDocuments =
      Array.isArray(
        proposal.sourceDocuments
      )
        ? proposal.sourceDocuments
        : [];


/* =================================================
   ATTACH PURSUIT SOURCE DOCUMENTS
================================================== */

sourceDocuments.forEach(
  (
    document
  ) => {

    if (
      !document ||
      !document.fileUrl
    ) {
      return;
    }


    currentContent.push({
      type:
        'input_file',

      file_url:
        document.fileUrl
    });

  }
);


    conversationInput.push({
      role:
        'user',

      content:
        currentContent
    });


    /* =================================================
       ASK SASHA
    ================================================== */

    console.log(
      'SASHA ANALYZE CHAT REQUEST:',
      {
        pursuitId:
          proposal._id.toString(),

        pursuitName:
          proposal.proposalName,

        messageLength:
          message.length,

        previousMessageCount:
          existingMessages.length,

        sourceDocumentCount:
          sourceDocuments.length
      }
    );


/* =================================================
   SEND REQUEST TO OPENAI
================================================== */

console.log(
  'SASHA ANALYZE CHAT SENDING TO OPENAI'
);


const response =
  await openai.responses.create({
    model:
      'gpt-5-mini',

    reasoning: {
      effort:
        'minimal'
    },

    instructions:
      analysisInstructions,

    input:
      conversationInput,

    max_output_tokens:
      1800
  });


console.log(
  'SASHA ANALYZE CHAT OPENAI RESPONSE RECEIVED'
);


/* =================================================
   READ SASHA RESPONSE
================================================== */

const sashaResponse =
  response.output_text
    ? response.output_text.trim()
    : '';


console.log(
  'SASHA ANALYZE CHAT RESPONSE LENGTH:',
  sashaResponse.length
);


if (
  !sashaResponse
) {

  throw new Error(
    'OpenAI returned an empty Sasha analysis response.'
  );

}


    /* =================================================
       SAVE CONVERSATION
    ================================================== */

    proposal.analysisMessages.push(
      {
        role:
          'user',

        content:
          message,

        createdAt:
          new Date()
      },
      {
        role:
          'assistant',

        content:
          sashaResponse,

        createdAt:
          new Date()
      }
    );


    await proposal.save();


    /* =================================================
       KEEP PURSUIT ACTIVE
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


    /* =================================================
       RETURN TO ANALYZE
    ================================================== */

    return res.redirect(
      `/analyze?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'SASHA ANALYZE CHAT FAILED:',
      error
    );


    return next(
      error
    );

  }

};
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
   PREPARE ANALYSIS CONVERSATION
================================================== */

const analysisMessages =
  Array.isArray(
    proposal.analysisMessages
  )
    ? proposal.analysisMessages
    : [];

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

        analysisMessages,

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
