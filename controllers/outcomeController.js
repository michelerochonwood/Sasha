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
       REQUIRE MESSAGE
    ================================================== */

    const message =
      typeof req.body.message ===
      'string'
        ? req.body.message.trim()
        : '';


    if (
      !message
    ) {

      return res.status(
        400
      ).json(
        {
          error:
            'A message is required.'
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

For this version of the Outcome workspace, respond
conversationally.

Do not modify evaluation results, outcome factors, lessons,
debrief information, pricing, or other permanent Outcome
work products merely because they are discussed in chat.

Permanent structured Outcome updates are handled separately.

Keep your response practical, concise, and useful to a
professional proposal team.
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
       CURRENT USER MESSAGE
    ================================================== */

    conversationInput.push(
      {
        role:
          'user',

        content: [
          {
            type:
              'input_text',

            text:
              message
          }
        ]
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

          max_output_tokens:
            3000

        }
      );


    /* =================================================
       NORMALIZE SASHA RESPONSE
    ================================================== */

    const reply =
      response.output_text
        ? response.output_text.trim()
        : '';


    if (
      !reply
    ) {

      throw new Error(
        'OpenAI returned an empty Sasha outcome response.'
      );

    }


    console.log(
      'SASHA OUTCOME CHAT RESPONSE RECEIVED',
      {
        pursuitId:
          pursuit._id.toString(),

        elapsedMs:
          Date.now() -
          outcomeChatStartedAt
      }
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

        reply
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