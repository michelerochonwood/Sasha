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

        mandatoryRequirements,

        evaluationCriteria,

        risks,

        unknowns,

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

        instructions: `
${analysisInstructions}

IMPORTANT ACTION RULES

You may return one controlled pursuit-record action.

Allowed actions:

- "none"
- "update_analysis"
- "update_outline"


UPDATE ANALYSIS

Use "update_analysis" when materially useful information is
available to improve the pursuit's RFP analysis.

The analysis object must contain the COMPLETE current working
analysis after your update, not merely the changed field.

Preserve useful supported existing findings.

Keep each of the six analysis areas concise, approximately
200 words or fewer in total.

If an analysis area has no supported findings, use an empty
array or empty string as appropriate.


UPDATE OUTLINE

Use "update_outline" only when the user explicitly asks you
to create, prepare, draft, revise, or update the proposal
outline or Table of Contents.

Do not update the proposal outline merely because you
discussed what an outline could contain.

When action is "update_outline", return a structured outline
that reflects the user's request and the available RFP
evidence.

Your reply must also explain that the pursuit outline was
updated and tell the user that they can review it in the
proposal writing workspace.


ACTION PRIORITY

If both an analysis update and an outline update could be
appropriate in the same turn, prefer the action that most
directly responds to the user's request.

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

                action: {
                  type:
                    'string',

                  enum: [
                    'none',
                    'update_analysis',
                    'update_outline'
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
                        },

                        mandatoryRequirements: {
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
                        },

                        evaluationCriteria: {
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
                        },

                        scopeSummary: {
                          type:
                            'string'
                        },

                        submissionRequirements: {
                          type:
                            'string'
                        },

                        unknowns: {
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
                }

              },

              required: [
                'reply',
                'action',
                'analysis',
                'outline'
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
      'SASHA ANALYZE CHAT ACTION:',
      sashaResult.action
    );


    /* =================================================
       WORK PRODUCT
    ================================================== */

    let workProduct =
      null;


    /* =================================================
       APPLY RFP ANALYSIS UPDATE
    ================================================== */

    if (
      sashaResult.action ===
      'update_analysis'
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
         NORMALIZE RISKS
      =============================================== */

      const risks =
        Array.isArray(
          analysis.risks
        )
          ? analysis.risks
              .map(
                (
                  risk
                ) => {

                  return {
                    title:
                      typeof risk.title ===
                        'string'
                        ? risk.title.trim()
                        : '',

                    description:
                      typeof risk.description ===
                        'string'
                        ? risk.description.trim()
                        : ''
                  };

                }
              )
              .filter(
                (
                  risk
                ) =>
                  risk.title
              )
          : [];


      /* ===============================================
         NORMALIZE MANDATORY REQUIREMENTS
      =============================================== */

      const mandatoryRequirements =
        Array.isArray(
          analysis.mandatoryRequirements
        )
          ? analysis.mandatoryRequirements
              .map(
                (
                  item
                ) => {

                  return {
                    requirement:
                      typeof item.requirement ===
                        'string'
                        ? item.requirement.trim()
                        : '',

                    complete:
                      item.complete ===
                      true,

                    notes:
                      typeof item.notes ===
                        'string'
                        ? item.notes.trim()
                        : ''
                  };

                }
              )
              .filter(
                (
                  item
                ) =>
                  item.requirement
              )
          : [];


      /* ===============================================
         NORMALIZE EVALUATION CRITERIA
      =============================================== */

      const evaluationCriteria =
        Array.isArray(
          analysis.evaluationCriteria
        )
          ? analysis.evaluationCriteria
              .map(
                (
                  item
                ) => {

                  return {
                    criterion:
                      typeof item.criterion ===
                        'string'
                        ? item.criterion.trim()
                        : '',

                    weight:
                      typeof item.weight ===
                        'string'
                        ? item.weight.trim()
                        : ''
                  };

                }
              )
              .filter(
                (
                  item
                ) =>
                  item.criterion
              )
          : [];


      /* ===============================================
         NORMALIZE UNKNOWNS
      =============================================== */

      const unknowns =
        Array.isArray(
          analysis.unknowns
        )
          ? analysis.unknowns
              .map(
                (
                  item
                ) => {

                  return {
                    question:
                                          typeof item.question ===
                        'string'
                        ? item.question.trim()
                        : '',

                    notes:
                      typeof item.notes ===
                        'string'
                        ? item.notes.trim()
                        : ''
                  };

                }
              )
              .filter(
                (
                  item
                ) =>
                  item.question
              )
          : [];


      /* ===============================================
         NORMALIZE SUMMARY FIELDS
      =============================================== */

      const scopeSummary =
        typeof analysis.scopeSummary ===
          'string'
          ? analysis.scopeSummary.trim()
          : '';


      const submissionRequirements =
        typeof analysis.submissionRequirements ===
          'string'
          ? analysis.submissionRequirements.trim()
          : '';


      /* ===============================================
         RECORD RFP ANALYSIS
      =============================================== */

      proposal.rfpAnalysis = {
        ...(
          proposal.rfpAnalysis &&
          typeof proposal.rfpAnalysis ===
            'object'
            ? proposal.rfpAnalysis
            : {}
        ),

        risks,

        mandatoryRequirements,

        evaluationCriteria,

        scopeSummary,

        submissionRequirements,

        unknowns,

        updatedAt:
          new Date()
      };


      /*
       * rfpAnalysis is a Mixed field in the Proposal
       * schema, so explicitly tell Mongoose that it
       * has changed.
       */

      proposal.markModified(
        'rfpAnalysis'
      );


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


      console.log(
        'SASHA UPDATED RFP ANALYSIS:',
        {
          pursuitId:
            proposal._id.toString(),

          riskCount:
            risks.length,

          mandatoryRequirementCount:
            mandatoryRequirements.length,

          evaluationCriterionCount:
            evaluationCriteria.length,

          unknownCount:
            unknowns.length
        }
      );

    }


    /* =================================================
       APPLY OUTLINE UPDATE
    ================================================== */

    if (
      sashaResult.action ===
      'update_outline'
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