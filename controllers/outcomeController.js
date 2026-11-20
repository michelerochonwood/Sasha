const mongoose = require('mongoose');

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
   LOAD STORED OUTCOME DOCUMENTS FOR SASHA
===================================================== */

async function loadOutcomeEvidence(proposal) {

  const MAX_EVIDENCE_FILES = 6;
  const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
  const MAX_FILE_BYTES = 25 * 1024 * 1024;

  const documents = [];

  const outcomeDocuments =
    Array.isArray(proposal.outcome?.documents)
      ? proposal.outcome.documents
      : [];

  for (const document of outcomeDocuments) {

    if (![
      'client_debrief',
      'lessons_learned'
    ].includes(document.documentType)) {
      continue;
    }

    if (!document.cloudinaryPublicId) {
      continue;
    }

    documents.push({
      name: document.originalName,
      type: document.documentType,
      mimeType: document.mimeType,
      publicId: document.cloudinaryPublicId,
      resourceType:
        document.cloudinaryResourceType || 'raw',
      deliveryType:
        document.cloudinaryDeliveryType ||
        'authenticated'
    });
  }

  /* =================================================
     INCLUDE FINAL SUBMITTED PROPOSAL
  ================================================= */

  const finalProposals =
    Array.isArray(proposal.proposalDocuments)
      ? proposal.proposalDocuments
      : [];

  for (const document of finalProposals) {

    if (!document.fileUrl) continue;

    documents.push({
      name: document.fileName || 'Final Proposal.pdf',
      type: 'final_submitted_proposal',
      mimeType: 'application/pdf',
      fileUrl: document.fileUrl
    });
  }

  /* =================================================
     DOWNLOAD AND PREPARE DOCUMENTS
  ================================================= */

  const evidence = [];
  let totalBytes = 0;

  for (const document of documents.slice(-MAX_EVIDENCE_FILES)) {

    let url;

    if (document.publicId) {

      url = cloudinary.utils.private_download_url(
        document.publicId,
        null,
        {
          resource_type: document.resourceType,
          type: document.deliveryType,
          expires_at:
            Math.floor(Date.now() / 1000) + 300
        }
      );

    } else {

      url = document.fileUrl;
    }

    /* ===============================================
       ACCEPT ONLY CLOUDINARY HTTPS URLS
    =============================================== */

    const parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'res.cloudinary.com'
    ) {
      throw new Error(
        'An outcome document has an invalid storage URL.'
      );
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(
        `Could not retrieve ${document.name}: ` +
        response.status
      );
    }

    const buffer =
      Buffer.from(await response.arrayBuffer());

    if (
      buffer.length > MAX_FILE_BYTES ||
      totalBytes + buffer.length > MAX_TOTAL_BYTES
    ) {
      throw new Error(
        'The stored outcome evidence exceeds the ' +
        'analysis size limit.'
      );
    }

    totalBytes += buffer.length;

    const mimeType =
      document.mimeType ||
      (
        document.name?.toLowerCase().endsWith('.docx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : document.name?.toLowerCase().endsWith('.txt')
            ? 'text/plain'
            : 'application/pdf'
      );

    evidence.push({
      type: document.type,
      name: document.name,
      input: {
        type: 'input_file',
        filename: document.name,
        file_data:
          `data:${mimeType};base64,${buffer.toString('base64')}`
      }
    });
  }

  return evidence;
}


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
   Save only user-approved changes
===================================================== */

exports.postOutcomeResult = async (req, res, next) => {

  try {

    const organizationId =
      req.session.organizationId || null;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization session not found.'
      });
    }

    const pursuitId =
      req.body.pursuitId ||
      req.session.activePursuitId ||
      null;

    if (!pursuitId) {
      return res.status(400).json({
        success: false,
        error: 'Pursuit ID is required.'
      });
    }

    /* ===============================================
       VALIDATE AND APPLY ONLY APPROVED FIELDS
       Missing fields must not erase existing values.
    =============================================== */

    const allowedStatuses = new Set([
      'pending',
      'won',
      'lost',
      'withdrawn',
      'cancelled',
      'unknown'
    ]);

    const updates = {};

    const has = key =>
      Object.prototype.hasOwnProperty.call(
        req.body,
        key
      );

    if (
      has('status') &&
      req.body.status != null
    ) {

      if (!allowedStatuses.has(req.body.status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid outcome status.'
        });
      }

      updates['outcome.status'] =
        req.body.status;
    }

    if (
      has('decisionDate') &&
      req.body.decisionDate != null
    ) {

      if (
        typeof req.body.decisionDate !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid decision date.'
        });
      }

      const date =
        new Date(req.body.decisionDate);

      if (
        !req.body.decisionDate.trim() ||
        Number.isNaN(date.getTime())
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid decision date.'
        });
      }

      updates['outcome.decisionDate'] = date;
    }

    if (
      has('successfulProponent') &&
      req.body.successfulProponent != null
    ) {

      if (
        typeof req.body.successfulProponent !==
        'string'
      ) {
        return res.status(400).json({
          success: false,
          error: 'Invalid successful proponent.'
        });
      }

      const name =
        req.body.successfulProponent.trim();

      if (name) {
        updates['outcome.successfulProponent'] =
          name;
      }
    }

    for (
      const key of ['ourPrice', 'winningPrice']
    ) {

      if (
        !has(key) ||
        req.body[key] == null
      ) {
        continue;
      }

      if (
        typeof req.body[key] !== 'number' ||
        !Number.isFinite(req.body[key]) ||
        req.body[key] < 0
      ) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${key} value.`
        });
      }

      updates[`outcome.${key}`] =
        req.body[key];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        error: 'No valid changes to approve.'
      });
    }

    /* ===============================================
       UPDATE ORGANIZATION'S PURSUIT
    =============================================== */

    const pursuit =
      await Proposal.findOneAndUpdate(
        {
          _id: pursuitId,
          organization: organizationId
        },
        {
          $set: updates
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!pursuit) {
      return res.status(404).json({
        success: false,
        error: 'Pursuit not found.'
      });
    }

    return res.json({
      success: true,
      outcome: pursuit.outcome
    });

  } catch (error) {

    console.error(
      'POST OUTCOME RESULT ERROR:',
      error
    );

    return next(error);
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
   REQUIRE CHAT MESSAGE
================================================ */

const message =
  typeof req.body.message === 'string'
    ? req.body.message.trim()
    : '';

if (!message) {
  return res.status(400).json({
    success: false,
    error: 'Enter a message for Sasha.'
  });
}

if (message.length > 10000) {
  return res.status(400).json({
    success: false,
    error: 'Please shorten your message and try again.'
  });
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

          decisionDate: {
  type: ['string', 'null']
},

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
- decision date;
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

CLIENT DEBRIEF RECORD

When an uploaded document contains client debrief feedback,
also populate the debrief record.

For debrief.rawNotes, preserve the substantive client
feedback from the document. Do not replace the client's
feedback with your own interpretation.

For debrief.sourceType:

- use "written" for written client feedback or debrief notes;
- use "verbal" for notes documenting a verbal conversation;
- use "formal_debrief" when the evidence explicitly identifies
  a formal client debrief;
- use "evaluation_scores" when the source consists primarily
  of evaluation or scoring information;
- use "internal" only for internally produced notes.

If the document does not provide a debrief date, return null.

If the document does not identify the person who provided
the feedback, return null.

Do not infer either value from the proposal submission date,
file upload date, client name, or other unrelated information.

Do not invent missing values.

If a value is not supported by the available evidence,
leave it null, blank, or omit the proposed update.

A proposal loss does not automatically mean every aspect
of the proposal was weak. Preserve documented strengths
as well as weaknesses.

Do not attribute the result solely to price unless the
evidence supports that conclusion.

Your structured findings are proposals only. Do not claim
that they have been saved or approved. The user must approve
changes before the permanent pursuit record is updated.

For decisionDate, use YYYY-MM-DD only when explicitly
supported by evidence. Otherwise return null.

Keep your conversational reply practical, concise, and
useful to a professional proposal team.

STORED OUTCOME DOCUMENTS

Documents supplied in this conversation were retrieved
from the pursuit's saved document records.

Treat client debrief documents as client evidence.

Treat team lessons-learned documents as internal
observations, not as verified client conclusions.

The final submitted proposal is the actual submission,
not necessarily Sasha's original assembled draft.

Use these documents when relevant to the user's question.

Do not claim to have reviewed a document unless its
contents were actually provided in this request.

Propose changes to the outcome record, but do not
save structured findings without user approval.
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
   LOAD STORED OUTCOME EVIDENCE
================================================ */

const storedEvidence =
  await loadOutcomeEvidence(pursuit);

if (storedEvidence.length) {

  currentMessageContent.push({
    type: 'input_text',
    text: `The following documents are stored in
this pursuit's Outcomes workspace.

Use them as supporting evidence when answering
questions about the result, evaluation, proposal
development process, and lessons learned.

Distinguish:
- client_debrief: feedback from the client;
- lessons_learned: internal pursuit-team observations;
- final_submitted_proposal: the actual client submission.

Do not assume internal observations represent
the client's conclusions.

Do not invent missing dates, prices, scores,
or reasons for the result.

Documents available in this request:
${storedEvidence.map(
  item => `${item.type}: ${item.name}`
).join('\n')}`
  });

  for (const item of storedEvidence) {

    currentMessageContent.push({
      type: 'input_text',
      text:
        `Stored document: ${item.name}\n` +
        `Source category: ${item.type}`
    });

    currentMessageContent.push(item.input);
  }
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


debrief: {

  type:
    'object',

  additionalProperties:
    false,

  properties: {

    date: {
      type: [
        'string',
        'null'
      ]
    },

    providedBy: {
      type: [
        'string',
        'null'
      ]
    },

    sourceType: {
      type: [
        'string',
        'null'
      ],

      enum: [
        'written',
        'verbal',
        'formal_debrief',
        'evaluation_scores',
        'internal',
        null
      ]
    },

    rawNotes: {
      type: [
        'string',
        'null'
      ]
    }

  },

  required: [
    'date',
    'providedBy',
    'sourceType',
    'rawNotes'
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
  'decisionDate',
  'successfulProponent',
  'ourPrice',
  'winningPrice',
  'debrief',
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
   PROPOSE CHANGES, DO NOT SAVE WITHOUT APPROVAL
================================================= */

const proposedUpdate = {};

const allowedOutcomeStatuses = new Set([
  'pending',
  'won',
  'lost',
  'withdrawn',
  'cancelled',
  'unknown'
]);

/* ===============================================
   RESULT STATUS
=============================================== */

if (
  allowedOutcomeStatuses.has(outcomeUpdate.status) &&
  outcomeUpdate.status !==
    (outcome.status || 'pending')
) {
  proposedUpdate.status =
    outcomeUpdate.status;
}

/* ===============================================
   DECISION DATE
=============================================== */

if (
  typeof outcomeUpdate.decisionDate === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(
    outcomeUpdate.decisionDate
  )
) {

  const parsedDate =
    new Date(outcomeUpdate.decisionDate);

  if (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) ===
      outcomeUpdate.decisionDate &&
    (
      !outcome.decisionDate ||
      new Date(outcome.decisionDate)
        .toISOString()
        .slice(0, 10) !==
        outcomeUpdate.decisionDate
    )
  ) {
    proposedUpdate.decisionDate =
      outcomeUpdate.decisionDate;
  }
}

/* ===============================================
   SUCCESSFUL PROPONENT
=============================================== */

if (
  typeof outcomeUpdate.successfulProponent ===
    'string' &&
  outcomeUpdate.successfulProponent.trim() &&
  outcomeUpdate.successfulProponent.trim() !==
    (outcome.successfulProponent || '')
) {
  proposedUpdate.successfulProponent =
    outcomeUpdate.successfulProponent.trim();
}

/* ===============================================
   PRICES
=============================================== */

for (
  const key of ['ourPrice', 'winningPrice']
) {

  const value = outcomeUpdate[key];

  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value !== outcome[key]
  ) {
    proposedUpdate[key] = value;
  }
}


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

return res.json({
  success: true,

  reply,

  proposedUpdate:
    Object.keys(proposedUpdate).length
      ? proposedUpdate
      : null,

  outcomeUpdated: false
});

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


/* =====================================================
   OUTCOME DOCUMENT UPLOADS
   Client debrief and lessons learned
===================================================== */

async function uploadOutcomeDocument(
  req,
  res,
  next,
  documentType
) {

  try {

    const organizationId =
      req.session.organizationId;

    if (!organizationId) {
      return res.status(401).json({
        success: false,
        error: 'Organization session not found.'
      });
    }

    const pursuitId =
      (
        typeof req.body.pursuitId === 'string' &&
        req.body.pursuitId.trim()
      ) ||
      req.session.activePursuitId;

    if (!pursuitId) {
      return res.status(400).json({
        success: false,
        error: 'Pursuit ID is required.'
      });
    }

    /* =================================================
       VALIDATE UPLOADED FILE
    ================================================= */

    const files =
      Array.isArray(req.files)
        ? req.files
        : [];

    if (files.length !== 1) {
      return res.status(400).json({
        success: false,
        error: 'Select exactly one document to upload.'
      });
    }

    const file = files[0];

    const allowedTypes = new Set([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ]);

    if (
      !allowedTypes.has(file.mimetype) ||
      !file.buffer
    ) {
      return res.status(400).json({
        success: false,
        error: 'Upload a PDF, DOCX, or TXT document.'
      });
    }

    /* =================================================
       FIND PURSUIT
    ================================================= */

    const proposal =
      await Proposal.findOne({
        _id: pursuitId,
        organization: organizationId
      });

    if (!proposal) {
      return res.status(404).json({
        success: false,
        error: 'Pursuit not found.'
      });
    }

    /* =================================================
       UPLOAD DOCUMENT TO CLOUDINARY
    ================================================= */

    const uploadResult =
      await new Promise((resolve, reject) => {

        const stream =
          cloudinary.uploader.upload_stream(
            {
              resource_type: 'raw',
              type: 'authenticated',

              folder:
                `sasha/${organizationId}/outcome-documents`,

              public_id:
                `${documentType}-${Date.now()}-${require('crypto').randomBytes(8).toString('hex')}`
            },

            (error, result) => {
              if (error) {
                return reject(error);
              }

              return resolve(result);
            }
          );

        stream.end(file.buffer);

      });

    /* =================================================
       SAVE DOCUMENT METADATA
    ================================================= */

    if (!proposal.outcome) {
      proposal.outcome = {};
    }

    if (
      !Array.isArray(
        proposal.outcome.documents
      )
    ) {
      proposal.outcome.documents = [];
    }

    proposal.outcome.documents.push({
      documentType,

      originalName:
        file.originalname,

      cloudinaryPublicId:
        uploadResult.public_id,

      cloudinaryUrl:
        uploadResult.secure_url || '',

      cloudinaryResourceType:
        'raw',

      cloudinaryDeliveryType:
        'authenticated',

      mimeType:
        file.mimetype,

      size:
        file.size,

      uploadedAt:
        new Date()
    });

    proposal.markModified(
      'outcome.documents'
    );

    await proposal.save();

    /* =================================================
       KEEP PURSUIT ACTIVE
    ================================================= */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;

    const savedDocument =
      proposal.outcome.documents[
        proposal.outcome.documents.length - 1
      ];

    /* =================================================
       SUCCESS
    ================================================= */

    return res.json({
      success: true,
      document: savedDocument
    });

  } catch (error) {

    console.error(
      'OUTCOME DOCUMENT UPLOAD ERROR:',
      error
    );

    return next(error);

  }

}


/* =====================================================
   UPLOAD CLIENT DEBRIEF
===================================================== */

exports.postUploadClientDebrief =
  (req, res, next) =>
    uploadOutcomeDocument(
      req,
      res,
      next,
      'client_debrief'
    );


/* =====================================================
   UPLOAD LESSONS LEARNED
===================================================== */

exports.postUploadLessonsLearned =
  (req, res, next) =>
    uploadOutcomeDocument(
      req,
      res,
      next,
      'lessons_learned'
    );



/* =====================================================
   DOWNLOAD OUTCOME DOCUMENT
===================================================== */

exports.getOutcomeDocument =
  async (req, res, next) => {

    try {

      const organizationId =
        req.session.organizationId;

      if (!organizationId) {
        return res.status(401).send(
          'Organization session not found.'
        );
      }

      const {
        pursuitId,
        documentId
      } = req.params;

      if (
        !mongoose.isValidObjectId(pursuitId) ||
        !mongoose.isValidObjectId(documentId)
      ) {
        return res.status(400).send(
          'Invalid document request.'
        );
      }

      /* ===============================================
         FIND PURSUIT BELONGING TO ORGANIZATION
      =============================================== */

      const proposal =
        await Proposal.findOne({
          _id: pursuitId,
          organization: organizationId
        });

      if (!proposal) {
        return res.status(404).send(
          'Pursuit not found.'
        );
      }

      /* ===============================================
         FIND DOCUMENT
      =============================================== */

      const documents =
        proposal.outcome?.documents || [];

      const document =
        documents.id(documentId);

      if (!document) {
        return res.status(404).send(
          'Outcome document not found.'
        );
      }

      if (!document.cloudinaryPublicId) {
        return res.status(404).send(
          'Document storage reference missing.'
        );
      }

      /* ===============================================
         GENERATE AUTHENTICATED DOWNLOAD URL
      =============================================== */

      const expiresAt =
        Math.floor(Date.now() / 1000) + 300;

      const downloadUrl =
        cloudinary.utils.private_download_url(
          document.cloudinaryPublicId,
          null,
          {
            resource_type:
              document.cloudinaryResourceType ||
              'raw',

            type:
              document.cloudinaryDeliveryType ||
              'authenticated',

            expires_at:
              expiresAt,

            attachment:
              true
          }
        );

      /* ===============================================
         REDIRECT TO TEMPORARY DOWNLOAD URL
      =============================================== */

      return res.redirect(
        downloadUrl
      );

    } catch (error) {

      console.error(
        'OUTCOME DOCUMENT DOWNLOAD ERROR:',
        error
      );

      return next(error);

    }

  };

  
