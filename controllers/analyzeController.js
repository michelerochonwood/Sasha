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

        instructions: `
${analysisInstructions}

IMPORTANT ACTION RULES

You may return one controlled pursuit-record action.

Allowed actions:

- "none"
- "update_outline"

Use "update_outline" only when the user explicitly asks you
to create, prepare, draft, revise, or update the proposal
outline or Table of Contents.

Do not update the proposal record merely because you discussed
what an outline could contain.

When action is "update_outline", return a structured outline
that reflects the user's request and the available RFP evidence.

Your reply must also explain that the pursuit outline was
updated and tell the user that they can review it in the
proposal writing workspace.

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
                    'update_outline'
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
                'outline'
              ]
            }
          }
        },

        max_output_tokens:
          2400
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
      'SASHA ANALYZE CHAT RESPONSE LENGTH:',
      sashaResponse.length
    );


    console.log(
      'SASHA ANALYZE CHAT ACTION:',
      sashaResult.action
    );


    /* =================================================
       APPLY CONTROLLED PURSUIT UPDATE
    ================================================== */

    let workProduct =
      null;


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