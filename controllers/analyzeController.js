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


/* =================================================
   NORMALIZE ANALYSIS HISTORY BLOCKS
================================================= */

const normalizeAnalysisBlocks =
  (
    value
  ) => {

    /*
     * New structure:
     *
     * [
     *   {
     *     content: ...,
     *     createdAt: Date
     *   }
     * ]
     *
     * Legacy analysis values are converted into
     * the first historical block for display.
     */

    if (
      typeof value ===
        'string'
    ) {

      const trimmed =
        value.trim();

      if (
        !trimmed
      ) {

        return [];

      }


      return [
        {
          content:
            trimmed,

          createdAt:
            rfpAnalysis.updatedAt ||
            null
        }
      ];

    }


    if (
      !Array.isArray(
        value
      ) ||
      value.length === 0
    ) {

      return [];

    }


    /*
     * Already using the historical block format.
     */

    const isHistorical =
      value.some(
        (
          block
        ) => {

          return (
            block &&
            typeof block ===
              'object' &&
            Object.prototype.hasOwnProperty.call(
              block,
              'content'
            )
          );

        }
      );


    if (
      isHistorical
    ) {

      return value
        .filter(
          (
            block
          ) => {

            return (
              block &&
              typeof block ===
                'object' &&
              Object.prototype.hasOwnProperty.call(
                block,
                'content'
              )
            );

          }
        )
        .slice(
          -6
        );

    }


    /*
     * Legacy array.
     *
     * Risks, mandatory requirements,
     * evaluation criteria and unknowns
     * were previously stored directly
     * as arrays.
     */

    return [
      {
        content:
          value,

        createdAt:
          rfpAnalysis.updatedAt ||
          null
      }
    ];

  };


const riskBlocks =
  normalizeAnalysisBlocks(
    rfpAnalysis.risks
  );


const mandatoryRequirementBlocks =
  normalizeAnalysisBlocks(
    rfpAnalysis.mandatoryRequirements
  );


const evaluationCriteriaBlocks =
  normalizeAnalysisBlocks(
    rfpAnalysis.evaluationCriteria
  );


const scopeBlocks =
  normalizeAnalysisBlocks(
    rfpAnalysis.scopeSummary
  );


const submissionRequirementBlocks =
  normalizeAnalysisBlocks(
    rfpAnalysis.submissionRequirements
  );


const clarificationBlocks =
  normalizeAnalysisBlocks(
    rfpAnalysis.unknowns
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
      'sasha_analyze',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Analyze ${proposal.proposalName} | Sasha`,

        proposal,

        rfpAnalysis,

riskBlocks,

mandatoryRequirementBlocks,

evaluationCriteriaBlocks,

scopeBlocks,

submissionRequirementBlocks,

clarificationBlocks,

        analysisMessages,

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
        'usual',

      goNoGo:
        proposal.goNoGo ||
        {},

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


EFFORT LEVEL

The pursuit has an effort level that helps determine how much
proposal process you should encourage.

MINIMAL:
Keep the process lean. Focus on compliance, material risks,
essential strategy, and the minimum work necessary to produce
a credible proposal.

USUAL:
Use a practical, disciplined proposal process without
overloading the team. This is the normal default.

FULL:
Encourage a more rigorous pursuit and proposal process,
including deeper strategy, evidence development, review,
planning, and differentiation where useful.

The effort level guides how much process you recommend.
It does not change the requirement to identify material
risks, mandatory requirements, submission requirements,
or other important RFP information.


RFP ANALYSIS WORK PRODUCT

As you analyze the pursuit, maintain a concise working RFP
analysis for the pursuit record.

The RFP analysis is NOT a complete extraction of the RFP.

Do not fill these work products with everything you find.

Their purpose is to give the pursuit team a fast, useful
summary of the information that matters most for deciding
whether and how to pursue the opportunity.

Maintain these six areas:

1. Risk and Contract Concerns
2. Mandatory Requirements
3. Evaluation Criteria
4. Scope of Work
5. Submission Requirements
6. Clarifications and Unknowns

Keep EACH AREA to approximately 200 words or fewer in total.

Prefer materially important information.

Combine closely related findings where useful.

Do not reproduce long RFP passages.

Do not add routine or low-value information merely because
it appears in the RFP.

If the available evidence does not support a finding, leave
that area empty rather than guessing.

RISK AND CONTRACT CONCERNS:
Record the most material contractual, commercial, technical,
schedule, delivery, insurance, liability, or pursuit risks.
Use short titles and concise explanations.

MANDATORY REQUIREMENTS:
Record requirements that could make the submission
non-compliant or ineligible if missed.
Do not treat every proposal instruction as mandatory.
Set complete to true only when the pursuit record supports
that the requirement has actually been satisfied.

EVALUATION CRITERIA:
Record the stated evaluation criteria and weights where the
RFP provides them.
Do not invent or estimate weights.

SCOPE OF WORK:
Provide a concise summary of what the client is actually
procuring and the principal services or deliverables.
Do not reproduce the full scope.

SUBMISSION REQUIREMENTS:
Summarize the most important submission mechanics, limits,
formats, deadlines, required forms, and delivery instructions
that the proposal team must know.
Do not duplicate the entire mandatory-requirements list.

CLARIFICATIONS AND UNKNOWNS:
Record material unanswered questions, ambiguities, missing
information, or issues requiring clarification.
Do not create questions merely to populate this section.


WHEN TO UPDATE THE ANALYSIS

You do not need the user to explicitly ask you to update the
RFP analysis.

When the source material or conversation provides materially
useful information for one or more of the six analysis areas,
you may update the analysis automatically.

If the conversation does not add or reveal materially useful
analysis information, do not update it.

When updating the analysis, preserve useful existing findings
unless new evidence supersedes them.

Do not erase supported existing findings merely because the
current conversation concerns another subject.


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

/* =================================================
   ADD CURRENT MESSAGE TO CONVERSATION
================================================= */

conversationInput.push({
  role:
    'user',

  content:
    currentContent
});

    /* =================================================
       LOG REQUEST
    ================================================== */

    console.log(
      'SASHA ANALYZE CHAT REQUEST:',
      {
        pursuitId:
          proposal._id.toString(),

        pursuitName:
          proposal.proposalName,

        effortLevel:
          proposal.effortLevel,

        messageLength:
          message.length,

        previousMessageCount:
          existingMessages.length,

pursuitDocumentCount:
  pursuitDocuments.length
      }
    );

const openai =
  sashaAiService.createClient(
    process.env.OPENAI_API_KEY
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

        instructions: `
${analysisInstructions}

IMPORTANT UPDATE RULES

You may identify and perform multiple pursuit-record updates
from the same request when the evidence supports them.

Do not choose only one update when the same new information
materially affects more than one part of the pursuit record.

For every response, return an updates object containing:

- analysis
- deadline
- outline
- changeImpact

Each value must be either true or false.

Set a value to true only when that part of the pursuit record
should actually be updated from the current conversation and
source material.


=====================================================
ANALYSIS UPDATE
=====================================================

Set:

analysis: true

when materially useful information is available to improve
one or more of the pursuit's RFP-analysis work products.

You do not need the user to explicitly request an analysis
update.

Official addenda, amendments, clarifications, revised scope,
client instructions, and other material pursuit documents
should update the RFP analysis when they change or clarify
information represented in the six analysis areas.


ANALYSIS HISTORY MODEL

The RFP Analysis preserves history.

Do NOT regenerate or replace the complete existing analysis.

When analysis is true, return ONLY the new analysis content
created or materially changed by the CURRENT request.

Each affected analysis area becomes a new historical block.

The existing analysis blocks remain stored in the pursuit
record and remain available as context.

A new block may:

- add a new finding;
- clarify an earlier finding;
- revise an earlier interpretation;
- supersede an earlier finding because of new RFP information;
- record an addendum change; or
- record another materially useful analysis development.

When new information supersedes an earlier finding, state
that clearly in the NEW block.

Do not delete or rewrite the historical block merely because
new information supersedes it.


ANALYSIS CATEGORIES

The six analysis categories are:

1. risks
   Risk and Contract Concerns

2. mandatoryRequirements
   Mandatory Requirements

3. evaluationCriteria
   Evaluation Criteria

4. scopeSummary
   Scope of Work

5. submissionRequirements
   Submission Requirements

6. unknowns
   Clarifications and Unknowns


CATEGORY UPDATE RULE

For each category:

- return the new content for that category when the CURRENT
  request materially affects it;

- return null when that category is not affected.

Do not repeat previous analysis blocks.

Do not regenerate the complete RFP analysis.

Do not copy unchanged material into a new block merely to
provide context.

Each subsequent analysis block is a DELTA: a concise record
of what is new, changed, clarified, superseded or discovered
during the current interaction.


ANALYSIS BLOCK BREVITY

Historical analysis blocks must remain concise and scannable.

The user may eventually have up to six visible blocks in
each category.

For a narrow change, include only the material finding
created by that change.

Do not reproduce long RFP passages.

Do not restate findings already contained in earlier blocks.

For risks, requirements, evaluation criteria and
clarifications, return only the new or materially changed
items.

For scope and submission requirements, return only the new
or materially changed summary information.

If analysis is false, return:

analysis: null

=====================================================
DEADLINE UPDATE
=====================================================

Set:

deadline: true

only when official source material explicitly establishes
that the proposal submission deadline has changed.

Do not infer or estimate a revised deadline.

When deadline is true, return the revised submission deadline
as a complete ISO 8601 datetime including the applicable
time-zone offset whenever the source provides a submission
time.

Example:

2026-09-10T14:00:00-04:00

Do not omit the submission time when the source document
provides it.

Do not invent a time or time zone that is not supported by
the source.

Also return a concise deadlineChangeSummary.

If deadline is false, return:

deadline: null

deadlineChangeSummary: null


=====================================================
OUTLINE UPDATE
=====================================================

Set:

outline: true

only when the user explicitly asks you to create, prepare,
draft, revise, or update the proposal outline or Table of
Contents.

Do not rewrite an existing outline automatically merely
because new pursuit information could affect it.

A material change that may require an outline revision should
normally be recorded through changeImpact first so the user
can review the downstream consequence.

When outline is true, return the complete proposed outline.

If outline is false, return:

outline: null


=====================================================
MATERIAL PURSUIT CHANGE
=====================================================

Set:

changeImpact: true

when official pursuit information materially changes existing
or future pursuit or proposal work.

Examples include changes to:

- scope of work
- deliverables
- evaluation criteria
- submission requirements
- team requirements
- pricing requirements
- technical requirements
- consultation requirements
- proposal schedule
- milestones
- proposal outline requirements
- proposal content requirements
- review requirements

Do not create a change impact merely because a document is
new.

The source material must establish an actual material change.

When changeImpact is true, return a changeImpact object
describing:

- changeType
- previousValue
- newValue
- summary
- affectedAreas
- sourceDocumentTitle

Allowed changeType values are:

- "submission_deadline"
- "evaluation_criteria"
- "submission_requirements"
- "scope"
- "team_requirements"
- "pricing_requirements"
- "other"

Allowed affectedAreas values are:

- "dashboard"
- "analysis"
- "schedule"
- "milestones"
- "production"
- "tasks"
- "outline"
- "content"
- "review"

Use only affected areas genuinely affected by the change.

For sourceDocumentTitle, return the filename or document title
of the official source establishing the change.

A changeImpact identifies downstream consequences.

It does NOT mean existing proposal work has been approved for
replacement.

Existing authored plan, outline, content, task, or review work
should be preserved until the appropriate change-review
workflow applies the revisions.

If changeImpact is false, return:

changeImpact: null


=====================================================
MULTIPLE UPDATES
=====================================================

These updates are independent.

For example, an addendum that changes scope may require:

analysis: true
deadline: false
outline: false
changeImpact: true

An addendum that changes the submission deadline may require:

analysis: true
deadline: true
outline: false
changeImpact: true

A user explicitly asking to revise an outline based on new
scope information may require:

analysis: true
deadline: false
outline: true
changeImpact: true

Determine every supported update from the evidence.

Do not suppress one valid update merely because another valid
update is also required.

Return only the requested structured JSON.
`,

        input:
          conversationInput,



        text: {
          format: {
            type:
              'json_schema',

            name:
              'sasha_analyze_chat_response',

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

updates: {
  type:
    'object',

  additionalProperties:
    false,

  properties: {

    analysis: {
      type:
        'boolean'
    },

    deadline: {
      type:
        'boolean'
    },

    outline: {
      type:
        'boolean'
    },

    changeImpact: {
      type:
        'boolean'
    }

  },

  required: [
    'analysis',
    'deadline',
    'outline',
    'changeImpact'
  ]
},


analysis: {
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

        risks: {
          anyOf: [
            {
              type:
                'null'
            },
            {
              type:
                'array',

              items: {
                type:
                  'object',

                additionalProperties:
                  false,

                properties: {

                  title: {
                    type:
                      'string'
                  },

                  description: {
                    type:
                      'string'
                  }

                },

                required: [
                  'title',
                  'description'
                ]
              }
            }
          ]
        },


        mandatoryRequirements: {
          anyOf: [
            {
              type:
                'null'
            },
            {
              type:
                'array',

              items: {
                type:
                  'object',

                additionalProperties:
                  false,

                properties: {

                  requirement: {
                    type:
                      'string'
                  },

                  complete: {
                    type:
                      'boolean'
                  },

                  notes: {
                    type:
                      'string'
                  }

                },

                required: [
                  'requirement',
                  'complete',
                  'notes'
                ]
              }
            }
          ]
        },


        evaluationCriteria: {
          anyOf: [
            {
              type:
                'null'
            },
            {
              type:
                'array',

              items: {
                type:
                  'object',

                additionalProperties:
                  false,

                properties: {

                  criterion: {
                    type:
                      'string'
                  },

                  weight: {
                    type:
                      'string'
                  }

                },

                required: [
                  'criterion',
                  'weight'
                ]
              }
            }
          ]
        },


        scopeSummary: {
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


        submissionRequirements: {
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


        unknowns: {
          anyOf: [
            {
              type:
                'null'
            },
            {
              type:
                'array',

              items: {
                type:
                  'object',

                additionalProperties:
                  false,

                properties: {

                  question: {
                    type:
                      'string'
                  },

                  notes: {
                    type:
                      'string'
                  }

                },

                required: [
                  'question',
                  'notes'
                ]
              }
            }
          ]
        }

      },

      required: [
        'risks',
        'mandatoryRequirements',
        'evaluationCriteria',
        'scopeSummary',
        'submissionRequirements',
        'unknowns'
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
},


deadline: {
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


deadlineChangeSummary: {
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


changeImpact: {
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

        changeType: {
          type:
            'string',

          enum: [
            'submission_deadline',
            'evaluation_criteria',
            'submission_requirements',
            'scope',
            'team_requirements',
            'pricing_requirements',
            'other'
          ]
        },

        previousValue: {
          type:
            'string'
        },

        newValue: {
          type:
            'string'
        },

        summary: {
          type:
            'string'
        },

        affectedAreas: {
          type:
            'array',

          items: {
            type:
              'string',

            enum: [
              'dashboard',
              'analysis',
              'schedule',
              'milestones',
              'production',
              'tasks',
              'outline',
              'content',
              'review'
            ]
          }
        },

        sourceDocumentTitle: {
          type:
            'string'
        }

      },

      required: [
        'changeType',
        'previousValue',
        'newValue',
        'summary',
        'affectedAreas',
        'sourceDocumentTitle'
      ]
    }
  ]
}

/* THIS BRACE WAS MISSING */
},

required: [
  'reply',
  'updates',
  'analysis',
  'outline',
  'deadline',
  'deadlineChangeSummary',
  'changeImpact'
]

            }
          }
        },

        max_output_tokens:
          3000

      });


    console.log(
      'SASHA ANALYZE CHAT OPENAI RESPONSE RECEIVED'
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
        'OpenAI returned an empty Sasha analysis response.'
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
        'SASHA ANALYZE CHAT JSON PARSE FAILED:',
        outputText
      );


      throw new Error(
        'OpenAI returned invalid Sasha analysis JSON.'
      );

    }


    const sashaResponse =
      typeof sashaResult.reply ===
        'string'
        ? sashaResult.reply.trim()
        : '';


    if (
      !sashaResponse
    ) {

      throw new Error(
        'Sasha returned an empty chat reply.'
      );

    }


console.log(
  'SASHA ANALYZE CHAT UPDATES:',
  sashaResult.updates
);


    /* =================================================
       WORK PRODUCT
    ================================================== */

    let workProduct =
      null;


/* =================================================
   APPLY RFP ANALYSIS UPDATE
================================================= */

if (
  sashaResult.updates &&
  sashaResult.updates.analysis ===
    true
) {

  if (
    !sashaResult.analysis ||
    typeof sashaResult.analysis !==
      'object'
  ) {

    throw new Error(
      'Sasha requested an analysis update without valid analysis.'
    );

  }


  const analysis =
    sashaResult.analysis;


  /* ===============================================
     ENSURE RFP ANALYSIS EXISTS
  =============================================== */

  proposal.rfpAnalysis =
    proposal.rfpAnalysis &&
    typeof proposal.rfpAnalysis ===
      'object'
      ? proposal.rfpAnalysis
      : {};


  /* ===============================================
     NORMALIZE LEGACY ANALYSIS VALUES
  =============================================== */

  const normalizeStoredAnalysisCategory =
    (
      value
    ) => {

      if (
        typeof value ===
          'string'
      ) {

        const trimmed =
          value.trim();

        if (
          !trimmed
        ) {

          return [];

        }


        return [
          {
            content:
              trimmed,

            createdAt:
              proposal.rfpAnalysis.updatedAt ||
              new Date()
          }
        ];

      }


      if (
        !Array.isArray(
          value
        )
      ) {

        return [];

      }


      if (
        value.length === 0
      ) {

        return [];

      }


      const isHistorical =
        value.some(
          (
            block
          ) => {

            return (
              block &&
              typeof block ===
                'object' &&
              Object.prototype.hasOwnProperty.call(
                block,
                'content'
              )
            );

          }
        );


      if (
        isHistorical
      ) {

        return value;

      }


      /*
       * Legacy structured array becomes
       * the original historical block.
       */

      return [
        {
          content:
            value,

          createdAt:
            proposal.rfpAnalysis.updatedAt ||
            new Date()
        }
      ];

    };


  proposal.rfpAnalysis.risks =
    normalizeStoredAnalysisCategory(
      proposal.rfpAnalysis.risks
    );


  proposal.rfpAnalysis.mandatoryRequirements =
    normalizeStoredAnalysisCategory(
      proposal.rfpAnalysis.mandatoryRequirements
    );


  proposal.rfpAnalysis.evaluationCriteria =
    normalizeStoredAnalysisCategory(
      proposal.rfpAnalysis.evaluationCriteria
    );


  proposal.rfpAnalysis.scopeSummary =
    normalizeStoredAnalysisCategory(
      proposal.rfpAnalysis.scopeSummary
    );


  proposal.rfpAnalysis.submissionRequirements =
    normalizeStoredAnalysisCategory(
      proposal.rfpAnalysis.submissionRequirements
    );


  proposal.rfpAnalysis.unknowns =
    normalizeStoredAnalysisCategory(
      proposal.rfpAnalysis.unknowns
    );


  /* ===============================================
     APPEND NEW ANALYSIS BLOCK
  =============================================== */

  const appendAnalysisBlock =
    (
      category,
      content
    ) => {

      if (
        content ===
          null ||
        content ===
          undefined
      ) {

        return;

      }


      if (
        typeof content ===
          'string'
      ) {

        const trimmed =
          content.trim();

        if (
          !trimmed
        ) {

          return;

        }


        proposal.rfpAnalysis[
          category
        ].push({
          content:
            trimmed,

          createdAt:
            new Date()
        });


        return;

      }


      if (
        Array.isArray(
          content
        )
      ) {

        if (
          content.length === 0
        ) {

          return;

        }


        proposal.rfpAnalysis[
          category
        ].push({
          content,

          createdAt:
            new Date()
        });

      }

    };


  appendAnalysisBlock(
    'risks',
    analysis.risks
  );


  appendAnalysisBlock(
    'mandatoryRequirements',
    analysis.mandatoryRequirements
  );


  appendAnalysisBlock(
    'evaluationCriteria',
    analysis.evaluationCriteria
  );


  appendAnalysisBlock(
    'scopeSummary',
    analysis.scopeSummary
  );


  appendAnalysisBlock(
    'submissionRequirements',
    analysis.submissionRequirements
  );


  appendAnalysisBlock(
    'unknowns',
    analysis.unknowns
  );


  proposal.rfpAnalysis.updatedAt =
    new Date();


  proposal.markModified(
    'rfpAnalysis'
  );


  /* ===============================================
     COMPLETE ANALYZE WORKFLOW STAGE
  =============================================== */

  const workflowStages =
    Array.isArray(
      proposal.workflowStages
    )
      ? proposal.workflowStages
      : [];


  const analyzeStage =
    workflowStages.find(
      (
        stage
      ) =>
        stage.stage ===
        'analyze'
    );


  if (
    analyzeStage
  ) {

    analyzeStage.status =
      'complete';

    analyzeStage.completedAt =
      new Date();

  }


  console.log(
    'SASHA APPENDED RFP ANALYSIS:',
    {
      pursuitId:
        proposal._id.toString(),

      risks:
        analysis.risks !==
        null,

      mandatoryRequirements:
        analysis.mandatoryRequirements !==
        null,

      evaluationCriteria:
        analysis.evaluationCriteria !==
        null,

      scopeSummary:
        analysis.scopeSummary !==
        null,

      submissionRequirements:
        analysis.submissionRequirements !==
        null,

      unknowns:
        analysis.unknowns !==
        null
    }
  );

}

/* =================================================
   APPLY SUBMISSION DEADLINE UPDATE
================================================== */

if (
  sashaResult.updates &&
  sashaResult.updates.deadline ===
    true
) {

  const deadlineValue =
    typeof sashaResult.deadline ===
      'string'
      ? sashaResult.deadline.trim()
      : '';


  if (
    !deadlineValue
  ) {

    throw new Error(
      'Sasha requested a deadline update without a revised deadline.'
    );

  }


const revisedDeadline =
  new Date(
    deadlineValue
  );


  if (
    Number.isNaN(
      revisedDeadline.getTime()
    )
  ) {

    throw new Error(
      'Sasha returned an invalid revised submission deadline.'
    );

  }


  const previousDeadline =
    proposal.submissionDeadline
      ? new Date(
          proposal.submissionDeadline
        )
      : null;


  /* ===============================================
     UPDATE CANONICAL PURSUIT DEADLINE
  =============================================== */

  proposal.submissionDeadline =
    revisedDeadline;


 

  console.log(
    'SASHA UPDATED SUBMISSION DEADLINE:',
    {
      pursuitId:
        proposal._id.toString(),

      previousDeadline:
        previousDeadline
          ? previousDeadline
              .toISOString()
              .slice(
                0,
                10
              )
          : null,

      revisedDeadline:
        deadlineValue
    }
  );

}

/* =================================================
   RECORD MATERIAL PURSUIT CHANGE
================================================= */

if (
  sashaResult.updates &&
  sashaResult.updates.changeImpact ===
    true
) {

  /* ===============================================
     REQUIRE CHANGE IMPACT
  =============================================== */

  const changeImpact =
    sashaResult.changeImpact &&
    typeof sashaResult.changeImpact ===
      'object'
      ? sashaResult.changeImpact
      : null;


  if (
    !changeImpact
  ) {

    throw new Error(
      'Sasha requested a change-impact record without valid change details.'
    );

  }


  /* ===============================================
     VALID CHANGE TYPE
  =============================================== */

  const allowedChangeTypes =
    new Set([
      'submission_deadline',
      'evaluation_criteria',
      'submission_requirements',
      'scope',
      'team_requirements',
      'pricing_requirements',
      'other'
    ]);


  const changeType =
    allowedChangeTypes.has(
      changeImpact.changeType
    )
      ? changeImpact.changeType
      : 'other';


  /* ===============================================
     VALID AFFECTED AREAS
  =============================================== */

  const allowedAffectedAreas =
    new Set([
      'dashboard',
      'analysis',
      'schedule',
      'milestones',
      'production',
      'tasks',
      'outline',
      'content',
      'review'
    ]);


  const affectedAreas =
    Array.isArray(
      changeImpact.affectedAreas
    )
      ? changeImpact.affectedAreas.filter(
          (
            area
          ) =>
            allowedAffectedAreas.has(
              area
            )
        )
      : [];


  /* ===============================================
     SOURCE DOCUMENT
  =============================================== */

  const requestedSourceTitle =
    typeof changeImpact.sourceDocumentTitle ===
      'string'
      ? changeImpact.sourceDocumentTitle
          .trim()
          .toLowerCase()
      : '';


  const matchedSourceDocument =
    requestedSourceTitle
      ? pursuitDocuments.find(
          (
            document
          ) => {

            const title =
              typeof document.title ===
                'string'
                ? document.title
                    .trim()
                    .toLowerCase()
                : '';


            const originalFileName =
              typeof document.originalFileName ===
                'string'
                ? document.originalFileName
                    .trim()
                    .toLowerCase()
                : '';


            return (
              title ===
                requestedSourceTitle ||
              originalFileName ===
                requestedSourceTitle
            );

          }
        )
      : null;


  const latestPursuitDocument =
    pursuitDocuments.length > 0
      ? pursuitDocuments[
          pursuitDocuments.length - 1
        ]
      : null;


  const sourceDocument =
    matchedSourceDocument ||
    latestPursuitDocument ||
    null;


  /* ===============================================
     NORMALIZE VALUES
  =============================================== */

  const previousValue =
    typeof changeImpact.previousValue ===
      'string'
      ? changeImpact.previousValue.trim()
      : '';


  const newValue =
    typeof changeImpact.newValue ===
      'string'
      ? changeImpact.newValue.trim()
      : '';


  const summary =
    typeof changeImpact.summary ===
      'string'
      ? changeImpact.summary.trim()
      : '';


  /* ===============================================
     PREVENT DUPLICATE PENDING IMPACT
  =============================================== */

  const existingImpact =
    Array.isArray(
      proposal.changeImpacts
    )
      ? proposal.changeImpacts.find(
          (
            impact
          ) => {

            if (
              !impact ||
              impact.status !==
                'pending_review'
            ) {

              return false;

            }


            return (
              impact.changeType ===
                changeType &&
              impact.newValue ===
                newValue
            );

          }
        )
      : null;


  /* ===============================================
     CREATE CHANGE IMPACT
  =============================================== */

  if (
    !existingImpact
  ) {

    proposal.changeImpacts.push({
      changeType,

      sourceDocument:
        sourceDocument
          ? sourceDocument._id
          : null,

      detectedAt:
        new Date(),

      previousValue,

      newValue,

      summary,

      affectedAreas,

      status:
        'pending_review',

      reviewedAt:
        null
    });

  }





  console.log(
    'SASHA RECORDED PURSUIT CHANGE:',
    {
      pursuitId:
        proposal._id.toString(),

      changeType,

      sourceDocumentId:
        sourceDocument
          ? sourceDocument._id.toString()
          : null,

      affectedAreas,

      duplicate:
        Boolean(
          existingImpact
        )
    }
  );

}


    /* =================================================
       APPLY OUTLINE UPDATE
    ================================================== */

if (
  sashaResult.updates &&
  sashaResult.updates.outline ===
    true
) {

      if (
        !sashaResult.outline ||
        typeof sashaResult.outline !==
          'object' ||
        !Array.isArray(
          sashaResult.outline.sections
        )
      ) {

        throw new Error(
          'Sasha requested an outline update without a valid outline.'
        );

      }


      proposal.outline = {
        title:
          sashaResult.outline.title ||
          'Proposal Outline',

        notes:
          sashaResult.outline.notes ||
          '',

        sections:
          sashaResult.outline.sections
            .map(
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
                    typeof section.title ===
                      'string'
                      ? section.title.trim()
                      : '',

                  description:
                    typeof section.description ===
                      'string'
                      ? section.description.trim()
                      : '',

                  subsections:
                    Array.isArray(
                      section.subsections
                    )
                      ? section.subsections
                          .filter(
                            (
                              item
                            ) =>
                              typeof item ===
                                'string' &&
                              item.trim()
                          )
                          .map(
                            (
                              item
                            ) =>
                              item.trim()
                          )
                      : []
                };

              }
            )
            .filter(
              (
                section
              ) =>
                section.title
            ),

        updatedAt:
          new Date()
      };




      /* =================================================
         BUILD WRITABLE PROPOSAL SECTIONS
      ================================================== */

      const writableSectionDefinitions = [
        {
          prefix:
            'A.',

          sectionId:
            'experience-and-qualifications'
        },

        {
          prefix:
            'B.',

          sectionId:
            'corporate-qualifications'
        },

        {
          prefix:
            'C.',

          sectionId:
            'methodology-work-plan-schedule'
        },

        {
          prefix:
            'D.',

          sectionId:
            'proposal-quality'
        }
      ];


      const existingContentSections =
        Array.isArray(
          proposal.contentSections
        )
          ? proposal.contentSections
          : [];


      const writableSections =
        writableSectionDefinitions
          .map(
            (
              definition,
              index
            ) => {

              const outlineSection =
                proposal.outline.sections.find(
                  (
                    section
                  ) =>
                    typeof section.title ===
                      'string' &&
                    section.title
                      .trim()
                      .startsWith(
                        definition.prefix
                      )
                );


              if (
                !outlineSection
              ) {

                return null;

              }


              const existingSection =
                existingContentSections.find(
                  (
                    section
                  ) =>
                    section.sectionId ===
                    definition.sectionId
                );


              return {
                sectionId:
                  definition.sectionId,

                title:
                  outlineSection.title,

                order:
                  index + 1,

                status:
                  existingSection
                    ? existingSection.status
                    : 'not_started',

                content:
                  existingSection
                    ? existingSection.content
                    : '',

                notes:
                  existingSection
                    ? existingSection.notes
                    : '',

                updatedAt:
                  existingSection &&
                  existingSection.updatedAt
                    ? existingSection.updatedAt
                    : new Date()
              };

            }
          )
          .filter(Boolean);


      proposal.contentSections =
        writableSections;


      console.log(
        'SASHA UPDATED PROPOSAL OUTLINE:',
        {
          pursuitId:
            proposal._id.toString(),

          sectionCount:
            proposal.outline.sections.length
        }
      );

    }

/* =================================================
   DETERMINE PRIMARY WORK PRODUCT
================================================= */

if (
  sashaResult.updates &&
  sashaResult.updates.changeImpact ===
    true
) {

  workProduct = {
    type:
      'change_impact',

    updated:
      true,

    label:
      'Pursuit Change',

    href:
      `/plan?pursuit=${proposal._id}`
  };

} else if (
  sashaResult.updates &&
  sashaResult.updates.outline ===
    true
) {

  workProduct = {
    type:
      'outline',

    updated:
      true,

    label:
      'Proposal Outline',

    href:
      `/write?pursuit=${proposal._id}`
  };

} else if (
  sashaResult.updates &&
  sashaResult.updates.deadline ===
    true
) {

  workProduct = {
    type:
      'deadline_change',

    updated:
      true,

    label:
      'Submission Deadline',

    href:
      `/analyze?pursuit=${proposal._id}`
  };

} else if (
  sashaResult.updates &&
  sashaResult.updates.analysis ===
    true
) {

  workProduct = {
    type:
      'analysis',

    updated:
      true,

    label:
      'RFP Analysis',

    href:
      `/analyze?pursuit=${proposal._id}`
  };

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

        workProduct:
          workProduct || {
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
   RECORD EFFORT LEVEL
===================================================== */

exports.postEffortLevel = async (
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


    const effortLevel =
      typeof req.body.effortLevel ===
        'string'
        ? req.body.effortLevel.trim()
        : '';


    /* =================================================
       VALIDATE EFFORT LEVEL
    ================================================== */

    const allowedEffortLevels = [
      'minimal',
      'usual',
      'full'
    ];


    if (
      !allowedEffortLevels.includes(
        effortLevel
      )
    ) {

      return res.status(400).send(
        'Select a valid effort level.'
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
       RECORD EFFORT LEVEL
    ================================================== */

    proposal.effortLevel =
      effortLevel;


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    /* =================================================
       KEEP PURSUIT ACTIVE
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


    console.log(
      'EFFORT LEVEL RECORDED:',
      {
        pursuitId:
          proposal._id.toString(),

        effortLevel
      }
    );


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
      'RECORD EFFORT LEVEL FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   RECORD GO / NO GO DECISION
===================================================== */

exports.postGoNoGoDecision =
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


    const decision =
      typeof req.body.decision ===
        'string'
        ? req.body.decision.trim()
        : '';


    const decisionNotes =
      typeof req.body.decisionNotes ===
        'string'
        ? req.body.decisionNotes.trim()
        : '';


    const decidedBy =
      typeof req.body.decidedBy ===
        'string'
        ? req.body.decidedBy.trim()
        : '';


    /* =================================================
       VALIDATE DECISION
    ================================================== */

const allowedDecisions =
  [
    'go',
    'no_go',
    'pending'
  ];


    if (
      !allowedDecisions.includes(
        decision
      )
    ) {

      return res.status(400).send(
        'Select a valid Go / No Go decision.'
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
       RECORD DECISION
    ================================================== */

    proposal.goNoGo.decision =
      decision;

    proposal.goNoGo.decisionNotes =
      decisionNotes;

    proposal.goNoGo.decidedBy =
      decidedBy;

    proposal.goNoGo.decidedAt =
      new Date();


    /* =================================================
       UPDATE GO / NO GO WORKFLOW STAGE
    ================================================== */

    const workflowStages =
      Array.isArray(
        proposal.workflowStages
      )
        ? proposal.workflowStages
        : [];


    const goNoGoStage =
      workflowStages.find(
        (
          stage
        ) =>
          stage.stage ===
          'go_no_go'
      );


if (
  goNoGoStage
) {

  if (
    decision ===
    'pending'
  ) {

    goNoGoStage.status =
      'in_progress';

    goNoGoStage.completedAt =
      null;

  } else {

    goNoGoStage.status =
      'complete';

    goNoGoStage.completedAt =
      new Date();

  }

}


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    /* =================================================
       KEEP PURSUIT ACTIVE
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


    console.log(
      'GO / NO GO DECISION RECORDED:',
      {
        pursuitId:
          proposal._id.toString(),

        decision,

        decidedBy
      }
    );


    /* =================================================
       RETURN TO PURSUIT DASHBOARD
    ================================================== */

    return res.redirect(
      `/pursuit/${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'RECORD GO / NO GO DECISION FAILED:',
      error
    );


    return next(
      error
    );

  }

};