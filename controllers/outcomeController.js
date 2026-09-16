const Proposal = require(
  '../models/proposal'
);

const sashaAiService = require(
  '../services/sashaAiService'
);

const cloudinary =
  require(
    '../config/cloudinary'
  );

/* =====================================================
   GET OUTCOME PURSUIT
===================================================== */

exports.getOutcomePursuit =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       DETERMINE ACTIVE PURSUIT
    ================================================== */

    const pursuitId =
      req.session.activePursuitId ||
      null;


    /* =================================================
       REQUIRE ACTIVE PURSUIT
    ================================================== */

    if (
      !pursuitId
    ) {

      return res.redirect(
        '/pursuits'
      );

    }


    /* =================================================
       REQUIRE ORGANIZATION
    ================================================== */

    const organizationId =
      req.session.organizationId ||
      null;


    if (
      !organizationId
    ) {

      return res.redirect(
        '/login'
      );

    }


    /* =================================================
       LOAD PURSUIT
    ================================================== */

    const pursuit =
      await Proposal.findOne(
        {
          _id:
            pursuitId,

          organization:
            organizationId
        }
      )
      .lean();


    /* =================================================
       PURSUIT NOT FOUND
    ================================================== */

    if (
      !pursuit
    ) {

      req.session.activePursuitId =
        null;

      return res.redirect(
        '/pursuits'
      );

    }


    /* =================================================
       NORMALIZE OUTCOME DATA FOR VIEW
    ================================================== */

    pursuit.outcome =
      pursuit.outcome ||
      {};


    pursuit.outcome.debrief =
      pursuit.outcome.debrief ||
      {};


    pursuit.outcome.evaluationResults =
      Array.isArray(
        pursuit.outcome.evaluationResults
      )
        ? pursuit.outcome.evaluationResults
        : [];


    pursuit.outcome.outcomeFactors =
      Array.isArray(
        pursuit.outcome.outcomeFactors
      )
        ? pursuit.outcome.outcomeFactors
        : [];


    pursuit.outcome.lessons =
      pursuit.outcome.lessons ||
      {};


    pursuit.outcome.lessons.repeat =
      Array.isArray(
        pursuit.outcome.lessons.repeat
      )
        ? pursuit.outcome.lessons.repeat
        : [];


    pursuit.outcome.lessons.change =
      Array.isArray(
        pursuit.outcome.lessons.change
      )
        ? pursuit.outcome.lessons.change
        : [];


    pursuit.outcome.lessons.watchFor =
      Array.isArray(
        pursuit.outcome.lessons.watchFor
      )
        ? pursuit.outcome.lessons.watchFor
        : [];


    pursuit.proposalDocuments =
      Array.isArray(
        pursuit.proposalDocuments
      )
        ? pursuit.proposalDocuments
        : [];


    /* =================================================
       RENDER OUTCOME WORKSPACE
    ================================================== */

    return res.render(
      'outcome_view',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Outcome | ${pursuit.proposalName} | Sasha`,

        pursuit
      }
    );

  } catch (
    error
  ) {

    console.error(
      'GET OUTCOME PURSUIT ERROR:',
      error
    );

    return next(
      error
    );

  }

};

/* =====================================================
   POST FINAL SUBMITTED PROPOSAL
===================================================== */

exports.postFinalProposal =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       REQUIRE ORGANIZATION
    ================================================== */

    const organizationId =
      req.session.organizationId ||
      null;


    if (
      !organizationId
    ) {

      return res.status(
        401
      ).json(
        {
          error:
            'Organization session not found.'
        }
      );

    }


    /* =================================================
       DETERMINE PURSUIT
    ================================================== */

    const pursuitId =
      typeof req.body.pursuitId ===
      'string'
        ? req.body.pursuitId.trim()
        : (
            req.session.activePursuitId ||
            ''
          );


    if (
      !pursuitId
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'Pursuit ID is required.'
        }
      );

    }


    /* =================================================
       REQUIRE FINAL PROPOSAL FILE
    ================================================== */

    const uploadedFiles =
      Array.isArray(
        req.files
      )
        ? req.files
        : [];


    if (
      uploadedFiles.length ===
      0
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'Choose a final proposal PDF to upload.'
        }
      );

    }


    const file =
      uploadedFiles[0];


    /* =================================================
       REQUIRE PDF
    ================================================== */

    if (
      file.mimetype !==
      'application/pdf'
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'The final submitted proposal must be a PDF.'
        }
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
            organizationId
        }
      );


    if (
      !proposal
    ) {

      return res.status(
        404
      ).json(
        {
          error:
            'Pursuit not found.'
        }
      );

    }


    /* =================================================
       UPLOAD FINAL PROPOSAL TO CLOUDINARY
    ================================================== */

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
                  `sasha/${organizationId}/final-proposals`,

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


    /* =================================================
       ENSURE PROPOSAL DOCUMENTS EXISTS
    ================================================== */

    if (
      !Array.isArray(
        proposal.proposalDocuments
      )
    ) {

      proposal.proposalDocuments =
        [];

    }


    /* =================================================
       SAVE FINAL PROPOSAL RECORD
    ================================================== */

    proposal.proposalDocuments.push(
      {
        title:
          'Final Submitted Proposal',

        fileName:
          file.originalname,

        fileUrl:
          uploadResult.secure_url ||
          uploadResult.url ||
          '',

        uploadedAt:
          new Date()
      }
    );


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


    console.log(
      'FINAL SUBMITTED PROPOSAL UPLOADED:',
      {
        pursuitId:
          proposal._id.toString(),

        fileName:
          file.originalname,

        cloudinaryPublicId:
          uploadResult.public_id ||
          ''
      }
    );


    /* =================================================
       SUCCESS
    ================================================== */

    return res.json(
      {
        success:
          true,

        proposalDocument:
          proposal.proposalDocuments[
            proposal.proposalDocuments.length -
            1
          ]
      }
    );

  } catch (
    error
  ) {

    console.error(
      'FINAL PROPOSAL UPLOAD FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   POST OUTCOME RESULT
===================================================== */

exports.postOutcomeResult =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       REQUIRE ORGANIZATION
    ================================================== */

    const organizationId =
      req.session.organizationId ||
      null;


    if (
      !organizationId
    ) {

      return res.status(
        401
      ).json(
        {
          error:
            'Organization session not found.'
        }
      );

    }


    /* =================================================
       DETERMINE PURSUIT
    ================================================== */

    const pursuitId =
      req.body.pursuitId ||
      req.session.activePursuitId ||
      null;


    if (
      !pursuitId
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'Pursuit ID is required.'
        }
      );

    }


    /* =================================================
       NORMALIZE RESULT VALUES
    ================================================== */

const allowedStatuses = [
  'pending',
  'won',
  'lost',
  'withdrawn',
  'cancelled',
  'unknown'
];


    const requestedStatus =
      typeof req.body.status ===
      'string'
        ? req.body.status.trim()
        : 'pending';


    const status =
      allowedStatuses.includes(
        requestedStatus
      )
        ? requestedStatus
        : 'pending';


    const decisionDate =
      req.body.decisionDate
        ? new Date(
            req.body.decisionDate
          )
        : null;


    const successfulProponent =
      typeof req.body.successfulProponent ===
      'string'
        ? req.body.successfulProponent.trim()
        : '';


    const parsePrice =
      value => {

        if (
          value === undefined ||
          value === null ||
          value === ''
        ) {

          return null;

        }


        const parsed =
          Number(
            value
          );


        return Number.isFinite(
          parsed
        )
          ? parsed
          : null;

      };


    const ourPrice =
      parsePrice(
        req.body.ourPrice
      );


    const winningPrice =
      parsePrice(
        req.body.winningPrice
      );


    /* =================================================
       UPDATE PURSUIT
    ================================================== */

    const pursuit =
      await Proposal.findOneAndUpdate(
        {
          _id:
            pursuitId,

          organization:
            organizationId
        },
        {
          $set: {

            'outcome.status':
              status,

            'outcome.decisionDate':
              decisionDate,

            'outcome.successfulProponent':
              successfulProponent,

            'outcome.ourPrice':
              ourPrice,

            'outcome.winningPrice':
              winningPrice

          }
        },
        {
          new:
            true,

          runValidators:
            true
        }
      );


    /* =================================================
       PURSUIT NOT FOUND
    ================================================== */

    if (
      !pursuit
    ) {

      return res.status(
        404
      ).json(
        {
          error:
            'Pursuit not found.'
        }
      );

    }


    /* =================================================
       SUCCESS
    ================================================== */

    return res.json(
      {
        success:
          true,

        outcome:
          pursuit.outcome
      }
    );

  } catch (
    error
  ) {

    console.error(
      'POST OUTCOME RESULT ERROR:',
      error
    );

    return next(
      error
    );

  }

};

/* =====================================================
   POST OUTCOME DETAILS
===================================================== */

exports.postOutcomeDetails =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       REQUIRE ORGANIZATION
    ================================================== */

    const organizationId =
      req.session.organizationId ||
      null;


    if (
      !organizationId
    ) {

      return res.status(
        401
      ).json(
        {
          error:
            'Organization session not found.'
        }
      );

    }


    /* =================================================
       DETERMINE PURSUIT
    ================================================== */

    const pursuitId =
      req.body.pursuitId ||
      req.session.activePursuitId ||
      null;


    if (
      !pursuitId
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'Pursuit ID is required.'
        }
      );

    }


    /* =================================================
       NORMALIZE DEBRIEF
    ================================================== */

    const debrief =
      req.body.debrief &&
      typeof req.body.debrief ===
      'object'
        ? req.body.debrief
        : {};


    const debriefDate =
      debrief.date
        ? new Date(
            debrief.date
          )
        : null;


    const providedBy =
      typeof debrief.providedBy ===
      'string'
        ? debrief.providedBy.trim()
        : '';


    const sourceType =
      typeof debrief.sourceType ===
      'string'
        ? debrief.sourceType.trim()
        : '';


    const rawNotes =
      typeof debrief.rawNotes ===
      'string'
        ? debrief.rawNotes.trim()
        : '';


    /* =================================================
       NORMALIZE INTERNAL DETAILS
    ================================================== */

    const internalObservations =
      typeof req.body.internalObservations ===
      'string'
        ? req.body.internalObservations.trim()
        : '';


    const notes =
      typeof req.body.notes ===
      'string'
        ? req.body.notes.trim()
        : '';


    /* =================================================
       UPDATE PURSUIT
    ================================================== */

    const pursuit =
      await Proposal.findOneAndUpdate(
        {
          _id:
            pursuitId,

          organization:
            organizationId
        },
        {
          $set: {

            'outcome.debrief.date':
              debriefDate,

            'outcome.debrief.providedBy':
              providedBy,

            'outcome.debrief.sourceType':
              sourceType,

            'outcome.debrief.rawNotes':
              rawNotes,

            'outcome.internalObservations':
              internalObservations,

            'outcome.notes':
              notes

          }
        },
        {
          new:
            true,

          runValidators:
            true
        }
      );


    /* =================================================
       PURSUIT NOT FOUND
    ================================================== */

    if (
      !pursuit
    ) {

      return res.status(
        404
      ).json(
        {
          error:
            'Pursuit not found.'
        }
      );

    }


    /* =================================================
       SUCCESS
    ================================================== */

    return res.json(
      {
        success:
          true,

        outcome:
          pursuit.outcome
      }
    );

  } catch (
    error
  ) {

    console.error(
      'POST OUTCOME DETAILS ERROR:',
      error
    );

    return next(
      error
    );

  }

};


/* =====================================================
   POST OUTCOME CHAT
===================================================== */

exports.postOutcomeChat =
async (
  req,
  res,
  next
) => {

  try {

    /* =================================================
       REQUIRE ORGANIZATION
    ================================================== */

    const organizationId =
      req.session.organizationId ||
      null;


    if (
      !organizationId
    ) {

      return res.status(
        401
      ).json(
        {
          error:
            'Organization session not found.'
        }
      );

    }


    /* =================================================
       DETERMINE PURSUIT
    ================================================== */

    const pursuitId =
      req.body.pursuitId ||
      req.session.activePursuitId ||
      null;


    if (
      !pursuitId
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'Pursuit ID is required.'
        }
      );

    }


/* =================================================
   MESSAGE + OUTCOME EVIDENCE
================================================= */

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


const evidenceFile =
  uploadedFiles.length > 0
    ? uploadedFiles[0]
    : null;


/* =================================================
   REQUIRE MESSAGE OR EVIDENCE
================================================= */

if (
  !message &&
  !evidenceFile
) {

  return res.status(
    400
  ).json(
    {
      error:
        'Add a message or debrief document first.'
    }
  );

}


if (
  message.length >
  10000
) {

  return res.status(
    400
  ).json(
    {
      error:
        'Please shorten your message and try again.'
    }
  );

}


    /* =================================================
       LOAD PURSUIT
    ================================================== */

    const pursuit =
      await Proposal.findOne(
        {
          _id:
            pursuitId,

          organization:
            organizationId
        }
      );


    if (
      !pursuit
    ) {

      return res.status(
        404
      ).json(
        {
          error:
            'Pursuit not found.'
        }
      );

    }


    /* =================================================
       KEEP PURSUIT ACTIVE
    ================================================== */

    req.session.activePursuitId =
      pursuit._id.toString();

    req.session.activePursuitName =
      pursuit.proposalName;


    /* =================================================
       NORMALIZE OUTCOME
    ================================================== */

    if (
      !pursuit.outcome ||
      typeof pursuit.outcome !==
      'object'
    ) {

      pursuit.outcome =
        {};

    }


    const outcome =
      pursuit.outcome;


    const existingChatMessages =
      Array.isArray(
        outcome.chatMessages
      )
        ? outcome.chatMessages
        : [];


    /* =================================================
       BUILD PURSUIT CONTEXT
    ================================================== */

    const pursuitContext = {

      proposalName:
        pursuit.proposalName ||
        '',

      clientName:
        pursuit.clientName ||
        '',

      rfpNumber:
        pursuit.rfpNumber ||
        '',

      submissionDeadline:
        pursuit.submissionDeadline ||
        null,

      proposalStatus:
        pursuit.proposalStatus ||
        '',

      outcome: {

        status:
          outcome.status ||
          'pending',

        decisionDate:
          outcome.decisionDate ||
          null,

        successfulProponent:
          outcome.successfulProponent ||
          '',

        ourPrice:
          outcome.ourPrice ??
          null,

        winningPrice:
          outcome.winningPrice ??
          null,

        contractValue:
          outcome.contractValue ??
          null,

        debrief:
          outcome.debrief ||
          {},

        evaluationResults:
          Array.isArray(
            outcome.evaluationResults
          )
            ? outcome.evaluationResults
            : [],

        outcomeFactors:
          Array.isArray(
            outcome.outcomeFactors
          )
            ? outcome.outcomeFactors
            : [],

        lessons:
          outcome.lessons ||
          {},

        internalObservations:
          outcome.internalObservations ||
          '',

        notes:
          outcome.notes ||
          ''

      }

    };


    /* =================================================
       SASHA OUTCOME INSTRUCTIONS
    ================================================== */

    const outcomeInstructions = `
You are Sasha, Twennie's proposal and pursuit assistant.

You are currently working in the OUTCOME stage of one
specific proposal pursuit.

Your purpose in this stage is to help the pursuit team
understand, document, and learn from the result.

You may help the user:

- interpret client debrief feedback;
- understand evaluation scores;
- compare known proposal prices;
- identify documented reasons for a win or loss;
- distinguish client evidence from internal interpretation;
- identify useful lessons for future pursuits;
- identify practices that should be repeated;
- identify practices that should be changed;
- identify issues the team should watch for on future pursuits;
- organize incomplete or unstructured outcome information.

EVIDENCE DISCIPLINE

Do not invent client feedback.

Do not invent evaluation scores.

Do not invent competitor information.

Do not invent pricing information.

Do not present an internal assumption as though it came
from the client.

Clearly distinguish between:

1. documented client feedback;
2. objective pursuit information;
3. internal team observations; and
4. your own professional analysis.

If the available evidence does not support a conclusion,
say so.

Do not claim that a proposal won or lost for a particular
reason unless the available evidence supports that conclusion.

You may identify reasonable possibilities, but label them
clearly as interpretations rather than documented facts.

OUTCOME LEARNING

Your goal is not simply to explain why the pursuit was
won or lost.

Help the team turn the outcome into useful institutional
knowledge.

Look for:

- repeatable strengths;
- weaknesses that can be corrected;
- proposal-process lessons;
- strategy lessons;
- evidence-selection lessons;
- personnel or project-experience lessons;
- pricing lessons;
- client relationship lessons;
- competitive lessons;
- compliance lessons;
- presentation lessons.

STRUCTURED OUTCOME RECORD

When the user provides outcome evidence, extract structured
information that is supported by that evidence.

You may propose updates for:

- proposal outcome status;
- successful proponent;
- our submitted price;
- winning price;
- evaluation criteria and scores;
- documented client comments;
- outcome factors;
- lessons for future pursuits.

For evaluation results, preserve:

- criterion;
- ourScore;
- maxScore;
- winningScore;
- comments.

For outcome factors, use only these categories:

- team
- experience
- project_understanding
- methodology
- schedule
- price
- presentation
- compliance
- relationship
- interview
- technical_approach
- other

For each outcome factor, classify impact as:

- positive
- negative
- neutral

For sourceType use only:

- client_debrief
- evaluation_scores
- award_information
- internal_assessment
- other

For lessons, organize findings into:

- repeat
- change
- watchFor

Do not invent missing values.

If a value is not supported by the available evidence,
leave it null, blank, or omit the proposed update.

A proposal loss does not automatically mean every aspect
of the proposal was weak. Preserve documented strengths
as well as weaknesses.

Do not attribute the result solely to price unless the
evidence supports that conclusion.

Your structured findings will be validated by the
application before they are saved to the permanent
pursuit record.

Keep your conversational reply practical, concise, and
useful to a professional proposal team.
`;


    /* =================================================
       BUILD CONVERSATION INPUT
    ================================================== */

    const conversationInput =
      existingChatMessages
        .slice(-8)
        .map(
          savedMessage => {

            return {
              role:
                savedMessage.role ===
                'assistant'
                  ? 'assistant'
                  : 'user',

              content:
                savedMessage.content ||
                ''
            };

          }
        )
        .filter(
          savedMessage =>
            savedMessage.content
        );

/* =================================================
   CURRENT USER MESSAGE CONTENT
================================================= */

const currentMessageContent =
  [];


/* =================================================
   ADD USER TEXT
================================================= */

if (
  message
) {

  currentMessageContent.push(
    {
      type:
        'input_text',

      text:
        message
    }
  );

}


/* =================================================
   ADD OUTCOME EVIDENCE DOCUMENT
================================================= */

if (
  evidenceFile
) {

  currentMessageContent.push(
    {
      type:
        'input_file',

      filename:
        evidenceFile.originalname,

      file_data:
        evidenceFile.buffer.toString(
          'base64'
        )
    }
  );

}


/* =================================================
   DEFAULT DOCUMENT INSTRUCTION
================================================= */

if (
  evidenceFile &&
  !message
) {

  currentMessageContent.unshift(
    {
      type:
        'input_text',

      text:
        `Review the attached outcome evidence document.

Extract only information supported by the document.

Identify any:

- proposal result information;
- successful proponent;
- our price;
- winning price;
- evaluation criteria and scores;
- documented client comments;
- positive outcome factors;
- negative outcome factors;
- practices worth repeating;
- practices that should change; and
- issues to watch for on future pursuits.

Clearly distinguish documented client evidence from your
own interpretation.`
    }
  );

}


/* =================================================
   ADD CURRENT MESSAGE
================================================= */

conversationInput.push(
  {
    role:
      'user',

    content:
      currentMessageContent
  }
);


    /* =================================================
       CREATE OPENAI CLIENT
    ================================================== */

    const openai =
      sashaAiService.createClient(
        process.env.OPENAI_API_KEY
      );


    /* =================================================
       SEND OUTCOME CHAT TO OPENAI
    ================================================== */

    const outcomeChatStartedAt =
      Date.now();


    console.log(
      'SASHA OUTCOME CHAT SENDING TO OPENAI',
      {
        pursuitId:
          pursuit._id.toString(),

        messageLength:
          message.length,

        previousMessageCount:
          existingChatMessages.length,

        startedAt:
          new Date().toISOString()
      }
    );


const response =
  await openai.responses.create(
    {

      model:
        'gpt-5-mini',

      reasoning: {
        effort:
          'minimal'
      },

      instructions:
        `${outcomeInstructions}

CURRENT PURSUIT AND OUTCOME RECORD

${JSON.stringify(
  pursuitContext,
  null,
  2
)}`,

      input:
        conversationInput,

      text: {

        format: {

          type:
            'json_schema',

          name:
            'sasha_outcome_response',

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


              outcomeUpdate: {

                type:
                  'object',

                additionalProperties:
                  false,

                properties: {

                  status: {
                    type: [
                      'string',
                      'null'
                    ],

                    enum: [
                      'pending',
                      'won',
                      'lost',
                      'withdrawn',
                      'cancelled',
                      'unknown',
                      null
                    ]
                  },


                  successfulProponent: {
                    type: [
                      'string',
                      'null'
                    ]
                  },


                  ourPrice: {
                    type: [
                      'number',
                      'null'
                    ]
                  },


                  winningPrice: {
                    type: [
                      'number',
                      'null'
                    ]
                  },


                  evaluationResults: {

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

                        ourScore: {
                          type: [
                            'number',
                            'null'
                          ]
                        },

                        maxScore: {
                          type: [
                            'number',
                            'null'
                          ]
                        },

                        winningScore: {
                          type: [
                            'number',
                            'null'
                          ]
                        },

                        comments: {
                          type:
                            'string'
                        }

                      },

                      required: [
                        'criterion',
                        'ourScore',
                        'maxScore',
                        'winningScore',
                        'comments'
                      ]

                    }

                  },


                  outcomeFactors: {

                    type:
                      'array',

                    items: {

                      type:
                        'object',

                      additionalProperties:
                        false,

                      properties: {

                        category: {
                          type:
                            'string',

                          enum: [
                            'team',
                            'experience',
                            'project_understanding',
                            'methodology',
                            'schedule',
                            'price',
                            'presentation',
                            'compliance',
                            'relationship',
                            'interview',
                            'technical_approach',
                            'other'
                          ]
                        },

                        impact: {
                          type:
                            'string',

                          enum: [
                            'positive',
                            'negative',
                            'neutral'
                          ]
                        },

                        summary: {
                          type:
                            'string'
                        },

                        sourceType: {
                          type:
                            'string',

                          enum: [
                            'client_debrief',
                            'evaluation_scores',
                            'award_information',
                            'internal_assessment',
                            'other'
                          ]
                        },

                        sourceDetail: {
                          type:
                            'string'
                        }

                      },

                      required: [
                        'category',
                        'impact',
                        'summary',
                        'sourceType',
                        'sourceDetail'
                      ]

                    }

                  },


                  lessons: {

                    type:
                      'object',

                    additionalProperties:
                      false,

                    properties: {

                      repeat: {
                        type:
                          'array',

                        items: {
                          type:
                            'string'
                        }
                      },

                      change: {
                        type:
                          'array',

                        items: {
                          type:
                            'string'
                        }
                      },

                      watchFor: {
                        type:
                          'array',

                        items: {
                          type:
                            'string'
                        }
                      }

                    },

                    required: [
                      'repeat',
                      'change',
                      'watchFor'
                    ]

                  }

                },

                required: [
                  'status',
                  'successfulProponent',
                  'ourPrice',
                  'winningPrice',
                  'evaluationResults',
                  'outcomeFactors',
                  'lessons'
                ]

              }

            },

            required: [
              'reply',
              'outcomeUpdate'
            ]

          }

        }

      },

      max_output_tokens:
        5000

    }
  );


 /* =================================================
   PARSE SASHA STRUCTURED RESPONSE
================================================= */

const rawResponse =
  response.output_text
    ? response.output_text.trim()
    : '';


if (
  !rawResponse
) {

  throw new Error(
    'OpenAI returned an empty Sasha outcome response.'
  );

}


let parsedResponse;


try {

  parsedResponse =
    JSON.parse(
      rawResponse
    );

} catch (
  parseError
) {

  console.error(
    'SASHA OUTCOME JSON PARSE FAILED:',
    {
      error:
        parseError.message,

      rawResponse
    }
  );


  throw new Error(
    'Sasha returned outcome information in an invalid format.'
  );

}


/* =================================================
   NORMALIZE REPLY
================================================= */

const reply =
  typeof parsedResponse.reply ===
  'string'
    ? parsedResponse.reply.trim()
    : '';


if (
  !reply
) {

  throw new Error(
    'Sasha returned an empty outcome reply.'
  );

}


/* =================================================
   NORMALIZE STRUCTURED UPDATE
================================================= */

const outcomeUpdate =
  parsedResponse.outcomeUpdate &&
  typeof parsedResponse.outcomeUpdate ===
  'object'
    ? parsedResponse.outcomeUpdate
    : null;


if (
  !outcomeUpdate
) {

  throw new Error(
    'Sasha did not return a structured outcome update.'
  );

}


/* =================================================
   LOG RESPONSE
================================================= */

console.log(
  'SASHA OUTCOME CHAT RESPONSE RECEIVED',
  {
    pursuitId:
      pursuit._id.toString(),

    elapsedMs:
      Date.now() -
      outcomeChatStartedAt,

    evaluationResultCount:
      Array.isArray(
        outcomeUpdate.evaluationResults
      )
        ? outcomeUpdate.evaluationResults.length
        : 0,

    outcomeFactorCount:
      Array.isArray(
        outcomeUpdate.outcomeFactors
      )
        ? outcomeUpdate.outcomeFactors.length
        : 0,

    repeatLessonCount:
      Array.isArray(
        outcomeUpdate.lessons?.repeat
      )
        ? outcomeUpdate.lessons.repeat.length
        : 0,

    changeLessonCount:
      Array.isArray(
        outcomeUpdate.lessons?.change
      )
        ? outcomeUpdate.lessons.change.length
        : 0,

    watchForLessonCount:
      Array.isArray(
        outcomeUpdate.lessons?.watchFor
      )
        ? outcomeUpdate.lessons.watchFor.length
        : 0
  }
);

/* =================================================
   APPLY STRUCTURED OUTCOME UPDATE
================================================= */

/*
 * Sasha may extract structured findings from the
 * evidence, but only schema-compatible values are
 * allowed into the permanent pursuit record.
 */


/* =================================================
   RESULT STATUS
================================================= */

const allowedOutcomeStatuses =
  new Set([
    'pending',
    'won',
    'lost',
    'withdrawn',
    'cancelled',
    'unknown'
  ]);


if (
  typeof outcomeUpdate.status ===
    'string' &&
  allowedOutcomeStatuses.has(
    outcomeUpdate.status
  )
) {

  pursuit.outcome.status =
    outcomeUpdate.status;

}


/* =================================================
   SUCCESSFUL PROPONENT
================================================= */

if (
  typeof outcomeUpdate.successfulProponent ===
    'string' &&
  outcomeUpdate.successfulProponent.trim()
) {

  pursuit.outcome.successfulProponent =
    outcomeUpdate.successfulProponent.trim();

}


/* =================================================
   OUR PRICE
================================================= */

if (
  typeof outcomeUpdate.ourPrice ===
    'number' &&
  Number.isFinite(
    outcomeUpdate.ourPrice
  )
) {

  pursuit.outcome.ourPrice =
    outcomeUpdate.ourPrice;

}


/* =================================================
   WINNING PRICE
================================================= */

if (
  typeof outcomeUpdate.winningPrice ===
    'number' &&
  Number.isFinite(
    outcomeUpdate.winningPrice
  )
) {

  pursuit.outcome.winningPrice =
    outcomeUpdate.winningPrice;

}


/* =================================================
   EVALUATION RESULTS
================================================= */

if (
  Array.isArray(
    outcomeUpdate.evaluationResults
  ) &&
  outcomeUpdate.evaluationResults.length >
    0
) {

  pursuit.outcome.evaluationResults =
    outcomeUpdate.evaluationResults.map(
      result => {

        return {

          criterion:
            typeof result.criterion ===
            'string'
              ? result.criterion.trim()
              : '',

          ourScore:
            typeof result.ourScore ===
              'number' &&
            Number.isFinite(
              result.ourScore
            )
              ? result.ourScore
              : null,

          maxScore:
            typeof result.maxScore ===
              'number' &&
            Number.isFinite(
              result.maxScore
            )
              ? result.maxScore
              : null,

          winningScore:
            typeof result.winningScore ===
              'number' &&
            Number.isFinite(
              result.winningScore
            )
              ? result.winningScore
              : null,

          comments:
            typeof result.comments ===
            'string'
              ? result.comments.trim()
              : ''

        };

      }
    )
    .filter(
      result =>
        result.criterion
    );

}


/* =================================================
   OUTCOME FACTORS
================================================= */

const allowedFactorCategories =
  new Set([
    'team',
    'experience',
    'project_understanding',
    'methodology',
    'schedule',
    'price',
    'presentation',
    'compliance',
    'relationship',
    'interview',
    'technical_approach',
    'other'
  ]);


const allowedFactorImpacts =
  new Set([
    'positive',
    'negative',
    'neutral'
  ]);


const allowedFactorSources =
  new Set([
    'client_debrief',
    'evaluation_scores',
    'award_information',
    'internal_assessment',
    'other'
  ]);


if (
  Array.isArray(
    outcomeUpdate.outcomeFactors
  ) &&
  outcomeUpdate.outcomeFactors.length >
    0
) {

  pursuit.outcome.outcomeFactors =
    outcomeUpdate.outcomeFactors
      .map(
        factor => {

          const category =
            allowedFactorCategories.has(
              factor.category
            )
              ? factor.category
              : 'other';


          const impact =
            allowedFactorImpacts.has(
              factor.impact
            )
              ? factor.impact
              : 'neutral';


          const sourceType =
            allowedFactorSources.has(
              factor.sourceType
            )
              ? factor.sourceType
              : 'other';


          return {

            category,

            impact,

            summary:
              typeof factor.summary ===
              'string'
                ? factor.summary.trim()
                : '',

            sourceType,

            sourceDetail:
              typeof factor.sourceDetail ===
              'string'
                ? factor.sourceDetail.trim()
                : ''

          };

        }
      )
      .filter(
        factor =>
          factor.summary
      );

}


/* =================================================
   LESSONS LEARNED
================================================= */

if (
  outcomeUpdate.lessons &&
  typeof outcomeUpdate.lessons ===
    'object'
) {

  const normalizeLessons =
    lessons => {

      if (
        !Array.isArray(
          lessons
        )
      ) {

        return [];

      }


      return lessons
        .filter(
          lesson =>
            typeof lesson ===
              'string' &&
            lesson.trim()
        )
        .map(
          lesson =>
            lesson.trim()
        );

    };


  const repeatLessons =
    normalizeLessons(
      outcomeUpdate.lessons.repeat
    );


  const changeLessons =
    normalizeLessons(
      outcomeUpdate.lessons.change
    );


  const watchForLessons =
    normalizeLessons(
      outcomeUpdate.lessons.watchFor
    );


  /*
   * Replace a lesson category only when Sasha
   * actually extracted findings for that category.
   * An empty AI array must not erase existing
   * institutional knowledge.
   */

  if (
    repeatLessons.length >
    0
  ) {

    pursuit.outcome.lessons.repeat =
      repeatLessons;

  }


  if (
    changeLessons.length >
    0
  ) {

    pursuit.outcome.lessons.change =
      changeLessons;

  }


  if (
    watchForLessons.length >
    0
  ) {

    pursuit.outcome.lessons.watchFor =
      watchForLessons;

  }

}


/* =================================================
   MARK STRUCTURED OUTCOME AS MODIFIED
================================================= */

pursuit.markModified(
  'outcome'
);
    /* =================================================
       SAVE CHAT HISTORY
    ================================================== */

    if (
      !Array.isArray(
        pursuit.outcome.chatMessages
      )
    ) {

      pursuit.outcome.chatMessages =
        [];

    }


    pursuit.outcome.chatMessages.push(
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
          reply,

        createdAt:
          new Date()
      }
    );


    pursuit.markModified(
      'outcome.chatMessages'
    );


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await pursuit.save();


    console.log(
      'SASHA OUTCOME CHAT PURSUIT SAVED',
      {
        pursuitId:
          pursuit._id.toString(),

        elapsedMs:
          Date.now() -
          outcomeChatStartedAt
      }
    );


    /* =================================================
       SUCCESS
    ================================================== */

return res.json(
  {
    success:
      true,

    reply,

    outcomeUpdated:
      true
  }
);

  } catch (
    error
  ) {

    console.error(
      'POST OUTCOME CHAT ERROR:',
      error
    );

    return next(
      error
    );

  }

};