const Proposal = require(
  '../models/proposal'
);

const PursuitDocument = require(
  '../models/pursuitDocument'
);


const cloudinary =
  require(
    '../config/cloudinary'
  );


const sashaAiService = require(
  '../services/sashaAiService'
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
   PREPARE CHANGE IMPACTS
================================================= */

const changeImpacts =
  Array.isArray(
    proposal.changeImpacts
  )
    ? proposal.changeImpacts
    : [];


const pendingChangeImpacts =
  changeImpacts.filter(
    (
      impact
    ) =>
      impact &&
      impact.status ===
        'pending_review'
  );


const deadlineChangeImpact =
  pendingChangeImpacts.find(
    (
      impact
    ) =>
      impact.changeType ===
        'submission_deadline'
  ) ||
  null;

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
   PREPARE PLAN CONVERSATION
================================================== */

const planMessages =
  Array.isArray(
    proposal.planMessages
  )
    ? proposal.planMessages
    : [];
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

        changeImpacts,

        pendingChangeImpacts,

        deadlineChangeImpact,

        planTasks,

        effortLevel,

        isMinimalEffort,

        isUsualEffort,

        isFullEffort,

        planMessages
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


const uploadedFiles =
  Array.isArray(
    req.files
  )
    ? req.files
    : [];


if (
  !pursuitId
) {

  return res.redirect(
    '/pursuits'
  );

}


if (
  !message &&
  uploadedFiles.length === 0
) {

  return res.redirect(
    `/plan?pursuit=${pursuitId}`
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
   SAVE UPLOADED PURSUIT DOCUMENTS
================================================= */

const uploadedFiles =
  Array.isArray(
    req.files
  )
    ? req.files
    : [];


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

      documentType:
        'addendum',

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
        'not_started',

      processedBySasha:
        false
    });


  /* ===============================================
     LINK DOCUMENT TO PURSUIT
  =============================================== */

  proposal.pursuitDocuments.push(
    pursuitDocument._id
  );


  console.log(
    'PLAN PURSUIT DOCUMENT CREATED:',
    {
      pursuitId:
        proposal._id.toString(),

      documentId:
        pursuitDocument._id.toString(),

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
   EXISTING PLAN CONVERSATION
================================================== */

const existingMessages =
  Array.isArray(
    proposal.planMessages
  )
    ? proposal.planMessages
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
    'usual',

  goNoGo:
    proposal.goNoGo ||
    {},

  rfpAnalysis:
    proposal.rfpAnalysis ||
    {},

  plan:
    proposal.plan ||
    {},

  winStrategy:
    proposal.winStrategy ||
    {},

  outline:
    proposal.outline ||
    {},

  proposalManager:
    proposal.proposalManager ||
    {},

  proposalTeam:
    Array.isArray(
      proposal.proposalTeam
    )
      ? proposal.proposalTeam
      : [],

  tasks:
    Array.isArray(
      proposal.tasks
    )
      ? proposal.tasks
      : []
};


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
   LOAD PURSUIT DOCUMENTS
================================================= */

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
        1
    })
    .lean();


/* =================================================
   ATTACH PURSUIT DOCUMENTS TO CURRENT MESSAGE
================================================= */

pursuitDocuments.forEach(
  (
    document
  ) => {

    if (
      !document
    ) {

      return;

    }


    const fileUrl =
      document.cloudinarySecureUrl ||
      document.cloudinaryUrl ||
      '';


    if (
      !fileUrl
    ) {

      return;

    }


    currentContent.push({
      type:
        'input_file',

      file_url:
        fileUrl
    });

  }
);


conversationInput.push({
  role:
    'user',

  content:
    currentContent
});


console.log(
  'SASHA PLAN CHAT CONTEXT READY:',
  {
    pursuitId:
      proposal._id.toString(),

    messageLength:
      message.length,

    previousMessageCount:
      existingMessages.length,

    pursuitDocumentCount:
  pursuitDocuments.length
  }
);




/* =================================================
   SASHA PLAN INSTRUCTIONS
================================================== */

const planInstructions = `
You are Sasha, an AI proposal and pursuit assistant for
technical consulting firms.

You are currently working inside the PLAN | WIN STRATEGY
stage of one specific pursuit.

Your role is to work conversationally with the pursuit team
as an experienced proposal professional.

Help the user develop and maintain, where relevant:

- the proposal schedule
- responsibilities and assignments
- internal milestones
- final production activities
- the win strategy
- client priorities
- relevant project evidence
- relevant personnel evidence
- differentiation
- the overall win argument
- the proposal outline
- planning tasks and next steps

Use the pursuit record, RFP analysis, source documents,
selected effort level, and previous conversation as evidence.

Do not invent requirements, evaluation weights, dates,
client preferences, project experience, personnel experience,
or other facts.

When information is unsupported, say so.

You may make professional recommendations and reasonable
inferences, but distinguish those from facts contained in
the pursuit record or RFP.

EFFORT LEVEL

MINIMAL:
Keep planning lean. Focus only on the work needed to produce
a compliant, professional submission efficiently.

USUAL:
Use a practical proposal process with a useful schedule,
clear responsibilities, concise strategy, appropriate evidence,
and a workable outline.

FULL:
Use a rigorous pursuit process with detailed planning,
deeper strategy development, evidence review, differentiation,
and a deliberate proposal outline.

PROPOSAL PLAN

The proposal plan may contain:

- schedule
- responsibilities
- milestones
- production

ACTION RULES FOR THE PROPOSAL PLAN

If your response creates, develops, revises, expands, replaces,
or materially changes any proposal planning work, you MUST set:

action = "update_plan"

This includes creating or revising:

- a proposal schedule
- time allocations
- responsibilities
- assignments
- milestones
- review dates
- production activities
- submission activities

If the user asks you to create a schedule, allocate available
proposal time, recommend how proposal effort should be distributed,
or otherwise produces planning content that should appear in the
Proposal Plan workspace, use "update_plan", not "none".

When action is "update_plan", return the COMPLETE current proposal
plan in the plan object. Preserve useful existing plan information
unless the user has deliberately changed or replaced it.

Use action = "none" only when the response is conversational and
does not create or materially change a saved work product.

PROPOSAL OUTLINE

The outline is created and maintained in the Plan workspace
and later appears in the Write workspace as the guide for
proposal drafting.

Only update the outline when the user asks to create, revise,
reorganize, or materially develop the proposal structure.

The outline should follow the RFP's required organization,
evaluation structure, submission requirements, and other
available evidence where appropriate.

The pursuit record currently contains:

${JSON.stringify(
  pursuitContext,
  null,
  2
)}
`;

/* =================================================
   CREATE OPENAI CLIENT
================================================= */

const openai =
  sashaAiService.createClient(
    process.env.OPENAI_API_KEY
  );


/* =================================================
   SEND REQUEST TO OPENAI
================================================= */

console.log(
  'SASHA PLAN CHAT SENDING TO OPENAI'
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
      planInstructions,

    input:
      conversationInput,

    text: {
      format: {
        type:
          'json_schema',

        name:
          'sasha_plan_chat_response',

        strict:
          true,

        schema: {
          type:
            'object',

          additionalProperties:
            false,

          properties: {

            reply: {
              type:
                'string'
            },

            action: {
              type:
                'string',

              enum: [
                'none',
                'update_plan',
                'update_win_strategy',
                'update_outline'
              ]
            },

            plan: {
              anyOf: [
                {
                  type:
                    'null'
                },
                {
                  type:
                    'object',

                  additionalProperties:
                    false,

                  properties: {

                    schedule: {
                      type:
                        'string'
                    },

                    responsibilities: {
                      type:
                        'string'
                    },

                    milestones: {
                      type:
                        'string'
                    },

                    production: {
                      type:
                        'string'
                    }

                  },

                  required: [
                    'schedule',
                    'responsibilities',
                    'milestones',
                    'production'
                  ]
                }
              ]
            },

            winStrategy: {
              anyOf: [
                {
                  type:
                    'null'
                },
                {
                  type:
                    'object',

                  additionalProperties:
                    false,

                  properties: {

                    clientPriorities: {
                      type:
                        'string'
                    },

                    relevantOffer: {
                      type:
                        'string'
                    },

                    projectEvidence: {
                      type:
                        'string'
                    },

                    personnelEvidence: {
                      type:
                        'string'
                    },

                    summary: {
                      type:
                        'string'
                    }

                  },

                  required: [
                    'clientPriorities',
                    'relevantOffer',
                    'projectEvidence',
                    'personnelEvidence',
                    'summary'
                  ]
                }
              ]
            },

            outline: {
              anyOf: [
                {
                  type:
                    'null'
                },
                {
                  type:
                    'object',

                  additionalProperties:
                    false,

                  properties: {

                    title: {
                      type:
                        'string'
                    },

                    notes: {
                      type:
                        'string'
                    },

                    sections: {
                      type:
                        'array',

                      items: {
                        type:
                          'object',

                        additionalProperties:
                          false,

                        properties: {

                          order: {
                            type:
                              'number'
                          },

                          title: {
                            type:
                              'string'
                          },

                          description: {
                            type:
                              'string'
                          },

                          subsections: {
                            type:
                              'array',

                            items: {
                              type:
                                'string'
                            }
                          }

                        },

                        required: [
                          'order',
                          'title',
                          'description',
                          'subsections'
                        ]
                      }
                    }

                  },

                  required: [
                    'title',
                    'notes',
                    'sections'
                  ]
                }
              ]
            }

          },

          required: [
            'reply',
            'action',
            'plan',
            'winStrategy',
            'outline'
          ]
        }
      }
    },

    max_output_tokens:
      6000
  });


console.log(
  'SASHA PLAN CHAT OPENAI RESPONSE RECEIVED'
);


/* =================================================
   PARSE SASHA RESPONSE
================================================== */

const outputText =
  response.output_text
    ? response.output_text.trim()
    : '';


if (
  !outputText
) {

  throw new Error(
    'OpenAI returned an empty Sasha plan response.'
  );

}


let sashaResult;


try {

  sashaResult =
    JSON.parse(
      outputText
    );

} catch (
  parseError
) {

  console.error(
    'SASHA PLAN CHAT JSON PARSE FAILED:',
    outputText
  );


  throw new Error(
    'OpenAI returned invalid Sasha plan JSON.'
  );

}


/* =================================================
   PREPARE SASHA REPLY
================================================== */

const sashaResponse =
  typeof sashaResult.reply ===
    'string'
    ? sashaResult.reply.trim()
    : '';


if (
  !sashaResponse
) {

  throw new Error(
    'Sasha returned an empty plan chat reply.'
  );

}


console.log(
  'SASHA PLAN CHAT ACTION:',
  sashaResult.action
);


/* =================================================
   APPLY PROPOSAL PLAN UPDATE
================================================= */

if (
  sashaResult.action ===
    'update_plan' &&
  sashaResult.plan &&
  typeof sashaResult.plan ===
    'object'
) {

  proposal.plan = {
    schedule:
      sashaResult.plan.schedule ||
      '',

    responsibilities:
      sashaResult.plan.responsibilities ||
      '',

    milestones:
      sashaResult.plan.milestones ||
      '',

    production:
      sashaResult.plan.production ||
      ''
  };

}

/* =================================================
   APPLY PROPOSAL OUTLINE UPDATE
================================================= */

if (
  sashaResult.action ===
    'update_outline' &&
  sashaResult.outline &&
  typeof sashaResult.outline ===
    'object'
) {

  proposal.outline = {

    title:
      sashaResult.outline.title ||
      'Proposal Outline',

    notes:
      sashaResult.outline.notes ||
      '',

    sections:
      Array.isArray(
        sashaResult.outline.sections
      )
        ? sashaResult.outline.sections.map(
            (
              section,
              index
            ) => {

              return {

                order:
                  Number.isFinite(
                    section.order
                  )
                    ? section.order
                    : index + 1,

                title:
                  section.title ||
                  '',

                description:
                  section.description ||
                  '',

                subsections:
                  Array.isArray(
                    section.subsections
                  )
                    ? section.subsections
                    : []

              };

            }
          )
        : []

  };

}

/* =================================================
   APPLY WIN STRATEGY UPDATE
================================================= */

if (
  sashaResult.action ===
    'update_win_strategy' &&
  sashaResult.winStrategy &&
  typeof sashaResult.winStrategy ===
    'object'
) {

  proposal.winStrategy = {

    clientPriorities:
      sashaResult.winStrategy.clientPriorities ||
      '',

    relevantOffer:
      sashaResult.winStrategy.relevantOffer ||
      '',

    projectEvidence:
      sashaResult.winStrategy.projectEvidence ||
      '',

    personnelEvidence:
      sashaResult.winStrategy.personnelEvidence ||
      '',

    summary:
      sashaResult.winStrategy.summary ||
      ''

  };

}

/* =================================================
   PREPARE WORK PRODUCT METADATA
================================================= */

let workProduct = {
  type:
    '',

  updated:
    false,

  label:
    '',

  href:
    ''
};


if (
  sashaResult.action ===
    'update_plan'
) {

  workProduct = {
    type:
      'plan',

    updated:
      true,

    label:
      'Proposal Plan',

    href:
      `/plan?pursuit=${proposal._id}`
  };

}


if (
  sashaResult.action ===
    'update_outline'
) {

  workProduct = {
    type:
      'outline',

    updated:
      true,

    label:
      'Proposal Outline',

    href:
      `/plan?pursuit=${proposal._id}`
  };

}


if (
  sashaResult.action ===
    'update_win_strategy'
) {

  workProduct = {
    type:
      'win_strategy',

    updated:
      true,

    label:
      'Win Strategy',

    href:
      `/plan?pursuit=${proposal._id}`
  };

}
/* =================================================
   SAVE CONVERSATION
================================================== */

proposal.planMessages.push(
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

workProduct,

    createdAt:
      new Date()
  }
);


/* =================================================
   SAVE PURSUIT
================================================== */

await proposal.save();


/* =================================================
   RETURN TO PLAN
================================================== */

return res.redirect(
  `/plan?pursuit=${proposal._id}`
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

/* =====================================================
   REVIEW CHANGE IMPACT
===================================================== */

exports.reviewChangeImpact =
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
      typeof req.body.pursuitId ===
        'string'
        ? req.body.pursuitId.trim()
        : '';


    const impactId =
      typeof req.params.impactId ===
        'string'
        ? req.params.impactId.trim()
        : '';


    if (
      !pursuitId ||
      !impactId
    ) {

      return res.redirect(
        '/pursuits'
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
       FIND CHANGE IMPACT
    ================================================== */

    const impact =
      proposal.changeImpacts.id(
        impactId
      );


    if (
      !impact
    ) {

      return res.status(404).send(
        'Change impact not found.'
      );

    }


    if (
      impact.status !==
        'pending_review'
    ) {

      return res.redirect(
        `/plan?pursuit=${proposal._id}`
      );

    }


    /* =================================================
       CURRENT PLAN
    ================================================== */

    const currentPlan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    const tasks =
      Array.isArray(
        proposal.tasks
      )
        ? proposal.tasks
        : [];


    /* =================================================
       CREATE OPENAI CLIENT
    ================================================== */

    const openai =
      sashaAiService.createClient(
        process.env.OPENAI_API_KEY
      );


    /* =================================================
       ASK SASHA FOR PROPOSED REVISIONS
    ================================================== */

    const response =
      await openai.responses.create({

        model:
          'gpt-5-mini',

        reasoning: {
          effort:
            'minimal'
        },

        instructions: `
You are Sasha, an AI proposal and pursuit assistant.

A material RFP change has occurred.

Your job is to REVIEW the existing proposal plan and propose
appropriate revisions caused by that change.

IMPORTANT:

Do not treat your proposed revisions as approved.

Do not overwrite or discard existing planning work simply because
the deadline changed.

Preserve useful existing decisions wherever possible.

Revise only dates, sequencing, milestones, production activities,
or tasks that reasonably need to change because of the new
submission deadline.

The proposal manager will review and approve or reject these changes.

The official submission deadline in the pursuit record is now:

${proposal.submissionDeadline
  ? new Date(
      proposal.submissionDeadline
    ).toISOString()
  : 'Not recorded'}

The recorded change impact is:

${JSON.stringify(
  {
    changeType:
      impact.changeType,

    previousValue:
      impact.previousValue,

    newValue:
      impact.newValue,

    summary:
      impact.summary,

    affectedAreas:
      impact.affectedAreas
  },
  null,
  2
)}

The current proposal plan is:

${JSON.stringify(
  currentPlan,
  null,
  2
)}

The current pursuit tasks are:

${JSON.stringify(
  tasks,
  null,
  2
)}

Return proposed changes only.
`,

        input: [
          {
            role:
              'user',

            content:
              'Review the existing plan and propose the changes needed because of this RFP change.'
          }
        ],

        text: {
          format: {
            type:
              'json_schema',

            name:
              'sasha_change_impact_review',

            strict:
              true,

            schema: {
              type:
                'object',

              additionalProperties:
                false,

              properties: {

                schedule: {
                  type:
                    'string'
                },

                milestones: {
                  type:
                    'string'
                },

                production: {
                  type:
                    'string'
                },

                tasks: {
                  type:
                    'array',

                  items: {
                    type:
                      'object',

                    additionalProperties:
                      false,

                    properties: {

                      taskId: {
                        type:
                          'string'
                      },

                      title: {
                        type:
                          'string'
                      },

                      previousDueDate: {
                        anyOf: [
                          {
                            type:
                              'null'
                          },
                          {
                            type:
                              'string'
                          }
                        ]
                      },

                      proposedDueDate: {
                        anyOf: [
                          {
                            type:
                              'null'
                          },
                          {
                            type:
                              'string'
                          }
                        ]
                      }

                    },

                    required: [
                      'taskId',
                      'title',
                      'previousDueDate',
                      'proposedDueDate'
                    ]
                  }
                }

              },

              required: [
                'schedule',
                'milestones',
                'production',
                'tasks'
              ]
            }
          }
        },

        max_output_tokens:
          4000
      });


    /* =================================================
       PARSE RESPONSE
    ================================================== */

    const outputText =
      response.output_text
        ? response.output_text.trim()
        : '';


    if (
      !outputText
    ) {

      throw new Error(
        'Sasha returned an empty change-impact review.'
      );

    }


    const proposed =
      JSON.parse(
        outputText
      );


    /* =================================================
       SAVE PROPOSED CHANGES ONLY
    ================================================== */

    impact.proposedChanges.schedule =
      proposed.schedule ||
      '';


    impact.proposedChanges.milestones =
      proposed.milestones ||
      '';


    impact.proposedChanges.production =
      proposed.production ||
      '';


    impact.proposedChanges.tasks =
      Array.isArray(
        proposed.tasks
      )
        ? proposed.tasks.map(
            (
              task
            ) => {

              return {
                taskId:
                  task.taskId ||
                  null,

                title:
                  task.title ||
                  '',

                previousDueDate:
                  task.previousDueDate
                    ? new Date(
                        task.previousDueDate
                      )
                    : null,

                proposedDueDate:
                  task.proposedDueDate
                    ? new Date(
                        task.proposedDueDate
                      )
                    : null
              };

            }
          )
        : [];


    impact.proposedChanges.generatedAt =
      new Date();


    await proposal.save();


    /* =================================================
       RETURN TO PLAN
    ================================================== */

    return res.redirect(
      `/plan?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'REVIEW CHANGE IMPACT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   ACCEPT CHANGE IMPACT
===================================================== */

exports.acceptChangeImpact =
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
      typeof req.body.pursuitId ===
        'string'
        ? req.body.pursuitId.trim()
        : '';


    const impactId =
      typeof req.params.impactId ===
        'string'
        ? req.params.impactId.trim()
        : '';


    if (
      !pursuitId ||
      !impactId
    ) {

      return res.redirect(
        '/pursuits'
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
       FIND CHANGE IMPACT
    ================================================== */

    const impact =
      proposal.changeImpacts.id(
        impactId
      );


    if (
      !impact
    ) {

      return res.status(404).send(
        'Change impact not found.'
      );

    }


    if (
      impact.status !==
        'pending_review'
    ) {

      return res.redirect(
        `/plan?pursuit=${proposal._id}`
      );

    }


    /* =================================================
       REQUIRE GENERATED PROPOSAL
    ================================================== */

    if (
      !impact.proposedChanges ||
      !impact.proposedChanges.generatedAt
    ) {

      return res.status(400).send(
        'No proposed plan changes are available to accept.'
      );

    }


    /* =================================================
       APPLY PLAN CHANGES
    ================================================== */

    proposal.plan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    if (
      impact.proposedChanges.schedule
    ) {

      proposal.plan.schedule =
        impact.proposedChanges.schedule;

    }


    if (
      impact.proposedChanges.milestones
    ) {

      proposal.plan.milestones =
        impact.proposedChanges.milestones;

    }


    if (
      impact.proposedChanges.production
    ) {

      proposal.plan.production =
        impact.proposedChanges.production;

    }


    proposal.markModified(
      'plan'
    );


    /* =================================================
       APPLY TASK DATE CHANGES
    ================================================== */

    const proposedTasks =
      Array.isArray(
        impact.proposedChanges.tasks
      )
        ? impact.proposedChanges.tasks
        : [];


    for (
      const proposedTask of proposedTasks
    ) {

      if (
        !proposedTask.taskId ||
        !proposedTask.proposedDueDate
      ) {

        continue;

      }


      const task =
        proposal.tasks.id(
          proposedTask.taskId
        );


      if (
        !task
      ) {

        continue;

      }


      task.dueDate =
        proposedTask.proposedDueDate;

    }


    /* =================================================
       MARK IMPACT ACCEPTED
    ================================================== */

    impact.status =
      'accepted';

    impact.reviewedAt =
      new Date();


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    return res.redirect(
      `/plan?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'ACCEPT CHANGE IMPACT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   DISMISS CHANGE IMPACT
===================================================== */

exports.dismissChangeImpact =
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
      typeof req.body.pursuitId ===
        'string'
        ? req.body.pursuitId.trim()
        : '';


    const impactId =
      typeof req.params.impactId ===
        'string'
        ? req.params.impactId.trim()
        : '';


    if (
      !pursuitId ||
      !impactId
    ) {

      return res.redirect(
        '/pursuits'
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
       FIND CHANGE IMPACT
    ================================================== */

    const impact =
      proposal.changeImpacts.id(
        impactId
      );


    if (
      !impact
    ) {

      return res.status(404).send(
        'Change impact not found.'
      );

    }


    if (
      impact.status !==
        'pending_review'
    ) {

      return res.redirect(
        `/plan?pursuit=${proposal._id}`
      );

    }


    /* =================================================
       KEEP CURRENT PLAN
    ================================================== */

    impact.status =
      'dismissed';

    impact.reviewedAt =
      new Date();


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    return res.redirect(
      `/plan?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'DISMISS CHANGE IMPACT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

exports.prepareOutlineForWrite = (
  outline,
  contentSections
) => {

  const safeOutline =
    outline &&
    typeof outline ===
      'object'
      ? outline
      : {};

  const outlineSections =
    Array.isArray(
      safeOutline.sections
    )
      ? safeOutline.sections
      : [];

  const safeContentSections =
    Array.isArray(
      contentSections
    )
      ? contentSections
      : [];

  const preparedOutlineSections =
    outlineSections.map(
      (
        outlineSection
      ) => {

        const matchingContentSection =
          safeContentSections.find(
            (
              contentSection
            ) =>
              contentSection.title ===
                outlineSection.title
          );

        return {
          ...outlineSection,

          isWritable:
            Boolean(
              matchingContentSection
            ),

          sectionId:
            matchingContentSection
              ? matchingContentSection.sectionId
              : '',

          status:
            matchingContentSection
              ? matchingContentSection.status
              : ''
        };

      }
    );

  return {
    ...safeOutline,

    sections:
      preparedOutlineSections
  };

};