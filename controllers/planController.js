const Proposal = require(
  '../models/proposal'
);

const OpenAI = require(
  'openai'
);


const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY
  });


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
   ATTACH PURSUIT SOURCE DOCUMENTS
================================================== */

const sourceDocuments =
  Array.isArray(
    proposal.sourceDocuments
  )
    ? proposal.sourceDocuments
    : [];


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


console.log(
  'SASHA PLAN CHAT CONTEXT READY:',
  {
    pursuitId:
      proposal._id.toString(),

    messageLength:
      message.length,

    previousMessageCount:
      existingMessages.length,

    sourceDocumentCount:
      sourceDocuments.length
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

When the user asks Sasha to develop or revise planning work,
return the COMPLETE current proposal plan, preserving useful
existing information unless it is deliberately replaced.

WIN STRATEGY

The win strategy may contain:

- clientPriorities
- relevantOffer
- projectEvidence
- personnelEvidence
- summary

When updating the win strategy, preserve supported existing
work unless new information supersedes it.

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
   SEND REQUEST TO OPENAI
================================================== */

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
      3000
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

    workProduct: {
      type:
        '',

      updated:
        false,

      label:
        '',

      href:
        ''
    },

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