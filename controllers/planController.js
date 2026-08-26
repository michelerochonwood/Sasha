const Proposal = require(
  '../models/proposal'
);

const PursuitDocument = require(
  '../models/pursuitDocument'
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

        pageLimit:
          null,

        pageBudgetNotes:
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


/* =================================================
   PENDING CHANGE IMPACTS
================================================= */

const pendingChangeImpacts =
  changeImpacts.filter(
    (
      impact
    ) => {

      return (
        impact &&
        impact.status ===
          'pending_review'
      );

    }
  );


/* =================================================
   PRIMARY PENDING CHANGE IMPACT
================================================= */

/*
 * Change impacts are not limited to submission
 * deadlines.
 *
 * They may result from addenda, clarifications,
 * revised scope, submission requirements,
 * evaluation changes, client instructions, or
 * other material pursuit information.
 *
 * The Plan workspace reviews the oldest pending
 * impact first.
 */

const pendingChangeImpact =
  pendingChangeImpacts.length > 0
    ? pendingChangeImpacts[0]
    : null;

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

        pendingChangeImpact,

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
    .slice(-8)
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

PROPOSAL OUTLINE

The outline is created and maintained in the Plan workspace
and later appears in the Write workspace as the guide for
proposal drafting.

Only update the outline when the user asks to create, revise,
reorganize, or materially develop the proposal structure.

The outline should follow the RFP's required organization,
evaluation structure, submission requirements, and other
available evidence where appropriate.

OUTLINE DISCIPLINE

Do not automatically add conventional proposal sections merely
because they are common proposal practice.

In particular, do not add an Executive Summary, Introduction,
Cover Letter, Understanding section, Why Us section, or other
custom proposal section unless:

- the RFP requests or permits it;
- the content is clearly appropriate within the RFP's required
  structure; or
- the user specifically asks for it.

When the RFP prescribes section titles, sequence, evaluation
criteria, or proposal organization, follow that structure closely.

Do not create additional standalone sections that consume page
budget without a clear strategic or compliance reason.

When page limits are restrictive, prioritize space for content
that is explicitly requested, evaluated, mandatory, or necessary
to make the requested response effective.

Do not duplicate content in an introductory or summary section
when that content belongs within a scored RFP section.

If the RFP explicitly requires responses to follow its evaluation
criteria in a specified sequence, build the outline around that
sequence rather than imposing a generic proposal structure.

TABLE OF CONTENTS AND REQUIRED PROPOSAL STRUCTURE

Before building a proposal outline, determine whether the RFP,
addenda, procurement instructions, or other controlling pursuit
documents provide:

- a required Table of Contents;
- a suggested or recommended Table of Contents;
- prescribed proposal sections;
- required section titles;
- a required response format; or
- explicit instructions about proposal organization or sequence.

If the client provides a required Table of Contents or proposal
structure, follow it.

If the client provides a suggested or recommended Table of
Contents or proposal structure, use it as the primary basis for
the outline unless another controlling requirement clearly
conflicts with it.

Do not replace a client-provided Table of Contents with an
outline derived from the evaluation criteria.

Use the evaluation criteria as the primary basis for organizing
the proposal only when the procurement documents do not provide
a required, suggested, or recommended proposal structure.

When using evaluation criteria to develop the outline, preserve
the client's sequence and terminology wherever practical.

Even when a client-provided Table of Contents controls the
proposal structure, use the evaluation criteria to inform:

- page allocation;
- emphasis;
- level of detail;
- placement of supporting evidence;
- strategic messaging; and
- review priorities.

The evaluation criteria should influence how much attention each
part of the proposal receives without unnecessarily changing the
client's requested organization.

If the client-provided structure and evaluation criteria appear
to conflict, identify the conflict rather than silently
reorganizing the proposal.

EVALUATION CRITERIA VS. PROPOSAL CONTENT

Distinguish between:

1. content the RFP explicitly requires the proponent to provide; and
2. evaluation criteria used by the client to assess the quality of
   the proposal as a whole.

Do not automatically create a proposal section for every item in
an evaluation table.

For example, criteria such as Proposal Quality, readability,
organization, clarity, presentation quality, responsiveness, or
use of boilerplate may describe how the entire proposal will be
evaluated rather than content requiring a standalone response.

Do not allocate page budget to a standalone section for such
criteria unless the RFP explicitly requires the proponent to
provide a response to that criterion.

Instead, treat those criteria as requirements governing the
quality and organization of the entire proposal.

When the RFP provides explicit section titles, numbered response
requirements, or a required sequence, use those requirements as
the primary basis for the proposal outline.

Do not create additional compliance, closing, summary, or
administrative sections merely to mirror every evaluation factor
or procurement requirement.

PAGE BUDGET

When the RFP establishes a proposal page limit, the proposal
outline MUST include a page budget.

Determine the page limit from the RFP, addenda, pursuit record,
or other reliable pursuit evidence.

Do not invent a page limit.

PAGE COUNT CONVENTIONS

Treat the stated page limit as the budget for counted proposal
content, not automatically as the total number of physical pages
in the submission.

Unless the RFP or another controlling procurement document
explicitly says otherwise:

- do not charge the cover page against the proposal page budget
- do not charge the table of contents against the proposal page
  budget
- do not assign counted page budget to intentionally blank pages
  or other administrative front matter
- distinguish required forms, appendices, resumes, schedules,
  figures, and attachments from the main counted proposal content

  When revising an existing outline, do not preserve an existing
pageBudget merely because it is already stored in the pursuit
record.

Re-evaluate every existing section against the controlling RFP
and addenda.

If a section or item is excluded from the stated page limit,
change its pageBudget to 0 even if the existing outline currently
contains a positive pageBudget.

If the existing outline conflicts with the RFP or addenda, the
RFP and addenda control.

When the user specifically asks you to correct page allocations
based on what counts toward the page limit, you MUST inspect the
available procurement documents and revise the actual numeric
pageBudget values. Do not merely revise pageBudgetNotes or state
that the allocation has been corrected.

When the user explicitly asks you to revise or correct a saved work product, and you have enough evidence to make a reasonable professional recommendation, make the update in the same response.

Do not ask for confirmation unless:
- the evidence supports two materially different choices with no clear professional preference;
- the change would overwrite a user decision that appears intentional; or
- the user specifically asks to review proposed changes before they are applied.

When an ambiguity remains, make the best-supported conservative choice, state the assumption clearly in the saved work product, and identify any follow-up verification task.

If the RFP clearly states that any of these items count toward the
page limit, follow the RFP.

If the RFP is ambiguous about whether an item counts, do not
silently assume that it does. Identify the ambiguity in
pageBudgetNotes and use normal proposal practice as the planning
assumption until the requirement is confirmed.

A section that is required in the physical proposal but excluded
from the stated page limit should still appear in the outline.

For such a section, set pageBudget to 0 because it consumes zero
pages from the counted proposal budget. Explain the exclusion in
the section description or pageBudgetNotes.

The sum of all positive pageBudget values should equal the usable
counted page limit unless the RFP creates a different constraint.

Allocate the available pages deliberately across the proposal
sections.

Consider:

- evaluation weights
- mandatory requirements
- complexity of each requested response
- strategic importance
- evidence required
- personnel and project information
- tables, matrices, schedules, and graphics
- whether particular material is excluded from the stated
  page count

Do not simply divide the page limit equally between sections.

Do not mechanically allocate pages in direct proportion to
evaluation weights. Use professional proposal judgment.

The section page budgets should collectively respect the
stated page limit.

If the RFP excludes particular material from the page count,
identify that clearly in pageBudgetNotes.

Whenever you create or materially revise an outline, return:

- pageLimit
- pageBudgetNotes
- pageBudget for every outline section

If no page limit can be established from reliable pursuit
evidence, return pageLimit as null and explain that in
pageBudgetNotes.

ACTION RULE FOR OUTLINE

If your response creates, revises, reorganizes, expands,
adds a page budget to, or otherwise materially changes the
proposal outline, you MUST set:

action = "update_outline"

Return the COMPLETE current outline when action is
"update_outline". Preserve useful existing outline content
unless the user deliberately changes or replaces it.

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

const planChatStartedAt =
  Date.now();


console.log(
  'SASHA PLAN CHAT SENDING TO OPENAI',
  {
    startedAt:
      new Date().toISOString()
  }
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

                    pageLimit: {
                      anyOf: [
                        {
                          type:
                            'null'
                        },
                        {
                          type:
                            'number'
                        }
                      ]
                    },

                    pageBudgetNotes: {
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

                          pageBudget: {
                            anyOf: [
                              {
                                type:
                                  'null'
                              },
                              {
                                type:
                                  'number'
                              }
                            ]
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
                          'pageBudget',
                          'subsections'
                        ]
                      }
                    }

                  },

                  required: [
                    'title',
                    'notes',
                    'pageLimit',
                    'pageBudgetNotes',
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
   VALIDATE OUTLINE PAGE BUDGET
================================================= */

if (
  sashaResult.action ===
    'update_outline' &&
  sashaResult.outline &&
  typeof sashaResult.outline ===
    'object' &&
  Number.isFinite(
    sashaResult.outline.pageLimit
  ) &&
  Array.isArray(
    sashaResult.outline.sections
  )
) {

  const countedPageBudget =
    sashaResult.outline.sections.reduce(
      (
        total,
        section
      ) => {

        if (
          Number.isFinite(
            section.pageBudget
          ) &&
          section.pageBudget > 0
        ) {

          return (
            total +
            section.pageBudget
          );

        }


        return total;

      },
      0
    );


  console.log(
    'SASHA OUTLINE PAGE BUDGET CHECK:',
    {
      pageLimit:
        sashaResult.outline.pageLimit,

      countedPageBudget
    }
  );


  if (
    countedPageBudget >
    sashaResult.outline.pageLimit
  ) {

    throw new Error(
      `Sasha returned an outline page budget of ${countedPageBudget} pages against a ${sashaResult.outline.pageLimit}-page limit.`
    );

  }

}


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

    pageLimit:
      Number.isFinite(
        sashaResult.outline.pageLimit
      )
        ? sashaResult.outline.pageLimit
        : null,

    pageBudgetNotes:
      sashaResult.outline.pageBudgetNotes ||
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

                pageBudget:
                  Number.isFinite(
                    section.pageBudget
                  )
                    ? section.pageBudget
                    : null,

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


  proposal.markModified(
    'outline'
  );

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


console.log(
  'SASHA PLAN CHAT PURSUIT SAVED',
  {
    elapsedMs:
      Date.now() -
      planChatStartedAt
  }
);


/* =================================================
   RETURN TO PLAN
================================================== */

console.log(
  'SASHA PLAN CHAT COMPLETE',
  {
    action:
      sashaResult.action,

    elapsedMs:
      Date.now() -
      planChatStartedAt
  }
);


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
You are Sasha, an AI proposal and pursuit assistant for
technical consulting firms.

A material change has occurred during an active pursuit.

Your job is to review that change against the existing
proposal plan and determine what planning work should be
revised.

The change may involve:

- submission dates
- scope of work
- deliverables
- evaluation criteria
- submission requirements
- mandatory requirements
- client instructions
- procurement requirements
- staffing implications
- technical requirements
- consultation requirements
- schedule requirements
- or another material pursuit issue


IMPORTANT

The existing proposal plan represents work already developed
by the proposal team.

Do not discard or rewrite useful existing planning work
unless the recorded change genuinely requires it.

Preserve existing decisions wherever they remain valid.

Revise only the parts of the proposal plan that are
reasonably affected by the new information.

The proposal manager will review the proposed changes before
they are applied.

Your job in this request is to PROPOSE revisions.

Do not treat those revisions as approved.


CURRENT PURSUIT

Proposal:
${proposal.proposalName || ''}

Client:
${proposal.clientName || ''}

RFP Number:
${proposal.rfpNumber || ''}

Current Submission Deadline:
${
  proposal.submissionDeadline
    ? new Date(
        proposal.submissionDeadline
      ).toISOString()
    : 'Not recorded'
}


RECORDED CHANGE IMPACT

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


CURRENT PROPOSAL PLAN

${JSON.stringify(
  currentPlan,
  null,
  2
)}


CURRENT PURSUIT TASKS

${JSON.stringify(
  tasks,
  null,
  2
)}


REVIEW REQUIREMENTS

Consider whether the recorded change requires revisions to:

- proposal schedule
- responsibilities
- internal milestones
- production activities
- review activities
- submission activities
- planning tasks

For a scope or deliverable change, consider whether new work
must be added to the proposal-development process.

For a deadline change, consider whether existing dates,
sequencing, review periods, production activities, or task
due dates should move.

For a submission or compliance change, consider whether new
checks, forms, acknowledgements, production activities, or
submission tasks are required.

For an evaluation change, consider whether proposal effort,
emphasis, sequencing, or review should change.

Do not change something merely because it could be improved.
Change it only when the recorded pursuit change reasonably
affects it.

Return the COMPLETE proposed schedule, milestones, and
production content so that the proposal manager can review
the proposed version against the current plan.

For tasks, return only tasks whose due dates genuinely need
to change.

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