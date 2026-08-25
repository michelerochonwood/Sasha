const Proposal = require(
  '../models/proposal'
);

const PursuitDocument = require(
  '../models/pursuitDocument'
);

const cloudinary =
  require('../config/cloudinary');

const planController =
  require(
    './planController'
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
   PURSUIT DOCUMENTS
================================================== */

const pursuitDocuments =
  await PursuitDocument.find({
    organization:
      req.session.organizationId,

    proposal:
      proposal._id,

    isCurrent:
      true
  })
    .sort({
      uploadedAt:
        -1
    })
    .lean();

    const sourceDocuments =
  pursuitDocuments.filter(
    document =>
      document.sourceType ===
      'client'
  );

  const proposalDocuments =
  pursuitDocuments.filter(
    document =>
      document.sourceType !==
      'client'
  );

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
      ? `${days} day${days === 1 ? '' : 's'}, ${hours} hour${hours === 1 ? '' : 's'}`
      : `${hours} hour${hours === 1 ? '' : 's'}`,

  days,

  hours
};

      }

    }


    /* =================================================
       WORKFLOW
    ================================================== */

const rawWorkflowStages =
  Array.isArray(
    proposal.workflowStages
  )
    ? proposal.workflowStages
    : [];


const workflowStageMeta = {

  create: {
    label:
      'Create',

    group:
      'CREATE',

    href:
      `/pursuit/${proposal._id}`
  },

  analyze: {
    label:
      'Analyze',

    group:
      'ANALYZE | GO / NO GO',

    href:
      `/analyze?pursuit=${proposal._id}`
  },

  go_no_go: {
    label:
      'Go / No Go',

    group:
      'ANALYZE | GO / NO GO',

    href:
      `/analyze?pursuit=${proposal._id}`
  },

  plan: {
    label:
      'Plan',

    group:
      'PLAN | WIN STRATEGY',

    href:
      `/plan?pursuit=${proposal._id}`
  },

    outline: {
    label:
      'Outline',

    group:
      'PLAN | WIN STRATEGY',

    href:
      `/plan?pursuit=${proposal._id}`
  },

  win_strategy: {
    label:
      'Win Strategy',

    group:
      'PLAN | WIN STRATEGY',

    href:
      `/plan?pursuit=${proposal._id}`
  },



  write: {
    label:
      'Write',

    group:
      'WRITE',

    href:
      `/write?pursuit=${proposal._id}`
  },

  review: {
    label:
      'Review',

    group:
      'REVIEW',

    href:
      `/review?pursuit=${proposal._id}`
  },

  submission: {
    label:
      'Submission',

    group:
      'FINALIZE',

    href:
      ''
  },

  outcome: {
    label:
      'Outcome',

    group:
      'OUTCOME',

    href:
      ''
  }

};


const workflowStages =
  rawWorkflowStages.map(
    (
      stage
    ) => {

      const meta =
        workflowStageMeta[
          stage.stage
        ] || {};

      let statusLabel =
        'Not Started';


      if (
        stage.status ===
        'in_progress'
      ) {

        statusLabel =
          'In Progress';

      }


      if (
        stage.status ===
        'complete'
      ) {

        statusLabel =
          'Complete';

      }


      if (
        stage.status ===
        'skipped'
      ) {

        statusLabel =
          'Skipped';

      }


      return {
        ...stage,

        label:
          meta.label ||
          stage.stage,

        group:
          meta.group ||
          '',

        href:
          meta.href ||
          '',

        statusLabel
      };

    }
  );


const workflowGroups = [
  {
    label:
      'CREATE',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'CREATE'
      )
  },

  {
    label:
      'ANALYZE | GO / NO GO',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'ANALYZE | GO / NO GO'
      )
  },

  {
    label:
      'PLAN | WIN STRATEGY',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'PLAN | WIN STRATEGY'
      )
  },

  {
    label:
      'WRITE',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'WRITE'
      )
  },

  {
    label:
      'REVIEW',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'REVIEW'
      )
  },

  {
    label:
      'FINALIZE',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'FINALIZE'
      )
  },

  {
    label:
      'OUTCOME',

    stages:
      workflowStages.filter(
        stage =>
          stage.group ===
          'OUTCOME'
      )
  }
];


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
   GO / NO GO
================================================== */

const goNoGo =
  proposal.goNoGo &&
  typeof proposal.goNoGo ===
    'object'
    ? proposal.goNoGo
    : {};


let goNoGoDecisionLabel =
  'Not decided';


if (
  goNoGo.decision ===
  'go'
) {

  goNoGoDecisionLabel =
    'Go';

}


if (
  goNoGo.decision ===
  'no_go'
) {

  goNoGoDecisionLabel =
    'No Go';

}


if (
  goNoGo.decision ===
  'go_and_get'
) {

  goNoGoDecisionLabel =
    'Go and Get';

}
    /* =================================================
       DASHBOARD DATA
    ================================================== */

    const dashboard = {

      deadline,

      timeRemaining,

      isOverdue,

workflowStages,

workflowGroups,

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
  'usual',

goNoGo,

goNoGoDecision:
  goNoGo.decision ||
  '',

goNoGoDecisionLabel

    };


    return res.render(
      'pursuit_dashboard',
      {
        layout:
          'mainlayout',

        pageTitle:
          `${proposal.proposalName} | Sasha`,

proposal,

dashboard,

pursuitDocuments,

sourceDocuments,

proposalDocuments
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
   POST PURSUIT DOCUMENTS
===================================================== */

exports.postPursuitDocuments =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       REQUEST INFORMATION
    ================================================== */

    const pursuitId =
      typeof req.params.id ===
        'string'
        ? req.params.id.trim()
        : '';


    const uploadedFiles =
      Array.isArray(
        req.files
      )
        ? req.files
        : [];


    const requestedDocumentType =
      typeof req.body.documentType ===
        'string'
        ? req.body.documentType.trim()
        : 'other';


    const requestedSourceType =
      typeof req.body.sourceType ===
        'string'
        ? req.body.sourceType.trim()
        : 'client';


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
       REQUIRE FILES
    ================================================== */

    if (
      uploadedFiles.length ===
      0
    ) {

      return res.redirect(
        `/pursuit/${pursuitId}`
      );

    }


    /* =================================================
       VALID DOCUMENT TYPE
    ================================================== */

    const allowedDocumentTypes =
      new Set([
        'rfp',
        'addendum',
        'contract',
        'scope',
        'client_document',
        'reference',
        'background',
        'notes',
        'other'
      ]);


    const documentType =
      allowedDocumentTypes.has(
        requestedDocumentType
      )
        ? requestedDocumentType
        : 'other';


    /* =================================================
       VALID SOURCE TYPE
    ================================================== */

    const allowedSourceTypes =
      new Set([
        'client',
        'procurement_portal',
        'pursuit_team',
        'internal',
        'other'
      ]);


    const sourceType =
      allowedSourceTypes.has(
        requestedSourceType
      )
        ? requestedSourceType
        : 'client';


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
       SAVE PURSUIT DOCUMENTS
    ================================================== */

    for (
      const file of uploadedFiles
    ) {

      /* ===============================================
         UPLOAD TO CLOUDINARY
      =============================================== */

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

                  if (
                    error
                  ) {

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


      /* ===============================================
         FILE EXTENSION
      =============================================== */

      const fileNameParts =
        file.originalname
          .split('.');


      const fileExtension =
        fileNameParts.length > 1
          ? fileNameParts
              .pop()
              .toLowerCase()
          : '';


      /* ===============================================
         CREATE PURSUIT DOCUMENT
      =============================================== */

      const pursuitDocument =
        await PursuitDocument.create({
          organization:
            req.session.organizationId,

          proposal:
            proposal._id,

          title:
            file.originalname,

          documentType,

          sourceType,

          originalFileName:
            file.originalname,

          storedFileName:
            uploadResult.public_id ||
            '',

          mimeType:
            file.mimetype ||
            '',

          fileExtension,

          fileSize:
            Number.isFinite(
              file.size
            )
              ? file.size
              : 0,

          cloudinaryPublicId:
            uploadResult.public_id ||
            '',

          cloudinaryResourceType:
            uploadResult.resource_type ||
            'raw',

          cloudinaryUrl:
            uploadResult.url ||
            '',

          cloudinarySecureUrl:
            uploadResult.secure_url ||
            '',

          uploadedAt:
            new Date(),

          processingStatus:
            'not_started',

          processedBySasha:
            false
        });


      /* ===============================================
         LINK DOCUMENT TO PURSUIT
      =============================================== */

      if (
        !Array.isArray(
          proposal.pursuitDocuments
        )
      ) {

        proposal.pursuitDocuments =
          [];

      }


      proposal.pursuitDocuments.push(
        pursuitDocument._id
      );


      console.log(
        'PURSUIT DASHBOARD DOCUMENT CREATED:',
        {
          pursuitId:
            proposal._id.toString(),

          documentId:
            pursuitDocument._id.toString(),

          documentType,

          sourceType,

          fileName:
            file.originalname
        }
      );

    }


    /* =================================================
       KEEP PURSUIT ACTIVE
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    /* =================================================
       RETURN TO DASHBOARD
    ================================================== */

    return res.redirect(
      `/pursuit/${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'PURSUIT DOCUMENT UPLOAD FAILED:',
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
   PREPARE UPLOADED FILES
================================================== */

const uploadedFiles =
  Array.isArray(
    req.files
  )
    ? req.files
    : [];


/* =================================================
   CREATE PURSUIT INSTANCE
================================================== */

/*
 * Create the Proposal instance now so it already
 * has an _id that can be referenced by each
 * PursuitDocument.
 *
 * We will save the Proposal after its documents
 * have been created and linked.
 */

const proposal =
  new Proposal({
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

sourceDocuments:
  [],

pursuitDocuments:
  [],

workflowStages: [
  {
    stage:
      'create',

    status:
      'complete',

    completedAt:
      new Date()
  },

  {
    stage:
      'analyze',

    status:
      'not_started'
  },

  {
    stage:
      'go_no_go',

    status:
      'not_started'
  },

  {
    stage:
      'plan',

    status:
      'not_started'
  },

  {
    stage:
      'win_strategy',

    status:
      'not_started'
  },

  {
    stage:
      'outline',

    status:
      'not_started'
  },

  {
    stage:
      'write',

    status:
      'not_started'
  },

  {
    stage:
      'review',

    status:
      'not_started'
  },

  {
    stage:
      'submission',

    status:
      'not_started'
  },

  {
    stage:
      'outcome',

    status:
      'not_started'
  }
]
  });


/* =================================================
   UPLOAD PURSUIT DOCUMENTS
================================================== */

for (
  const file of uploadedFiles
) {

  /* ===============================================
     UPLOAD FILE TO CLOUDINARY
  =============================================== */

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

              if (
                error
              ) {

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


  /* ===============================================
     FILE EXTENSION
  =============================================== */

  const fileNameParts =
    file.originalname
      .split('.');


  const fileExtension =
    fileNameParts.length > 1
      ? fileNameParts
          .pop()
          .toLowerCase()
      : '';


  /* ===============================================
     DOCUMENT TYPE
  =============================================== */

  /*
   * On Create Pursuit, the first uploaded
   * document is treated as the RFP.
   *
   * Additional documents can later be classified
   * more specifically.
   */

  const documentType =
    proposal.pursuitDocuments.length === 0
      ? 'rfp'
      : 'other';


  /* ===============================================
     CREATE PURSUIT DOCUMENT
  =============================================== */

  console.log(
    'CREATING PURSUIT DOCUMENT:',
    {
      proposalId:
        proposal._id.toString(),

      fileName:
        file.originalname
    }
  );


  const pursuitDocument =
    await PursuitDocument.create({
      organization:
        req.session.organizationId,

      proposal:
        proposal._id,

      title:
        file.originalname,

      documentType,

      sourceType:
        'client',

      originalFileName:
        file.originalname,

      storedFileName:
        uploadResult.public_id ||
        '',

      mimeType:
        file.mimetype ||
        '',

      fileExtension,

      fileSize:
        Number.isFinite(
          file.size
        )
          ? file.size
          : 0,

      cloudinaryPublicId:
        uploadResult.public_id ||
        '',

      cloudinaryResourceType:
        uploadResult.resource_type ||
        'raw',

      cloudinaryUrl:
        uploadResult.url ||
        '',

      cloudinarySecureUrl:
        uploadResult.secure_url ||
        '',

      uploadedAt:
        new Date(),

      processingStatus:
        aiSummary
          ? 'complete'
          : 'not_started',

      processedBySasha:
        Boolean(
          aiSummary
        ),

      processedAt:
        aiSummary
          ? new Date()
          : null,

      documentSummary:
        aiSummary ||
        '',

      aiMetadata: {
        lastAnalyzedAt:
          aiSummary
            ? new Date()
            : null,

        model:
          '',

        analysisVersion:
          1,

        openaiFileId:
          ''
      }
    });


  console.log(
    'PURSUIT DOCUMENT CREATED:',
    {
      documentId:
        pursuitDocument._id.toString(),

      proposalId:
        proposal._id.toString()
    }
  );


  /* ===============================================
     LINK DOCUMENT TO PURSUIT
  =============================================== */

  proposal.pursuitDocuments.push(
    pursuitDocument._id
  );


  /* ===============================================
     LEGACY SOURCE DOCUMENT RECORD
  =============================================== */

  /*
   * Keep this temporarily because the Analyze
   * controller still reads sourceDocuments.
   */

  proposal.sourceDocuments.push({
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
   SAVE PURSUIT
================================================== */

await proposal.save();
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


/* =================================================
   PREPARE PROPOSAL OUTLINE
================================================= */

const preparedOutline =
  planController.prepareOutlineForWrite(
    proposal.outline,
    contentSections
  );
  
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

outline:
  preparedOutline,

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
