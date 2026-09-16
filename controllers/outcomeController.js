const Proposal = require(
  '../models/proposal'
);

const sashaAiService = require(
  '../services/sashaAiService'
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

/* =================================================
   BUILD CONVERSATION INPUT
================================================= */

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
================================================= */

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
================================================= */

const openai =
  sashaAiService.createClient(
    process.env.OPENAI_API_KEY
  );


/* =================================================
   SEND OUTCOME CHAT TO OPENAI
================================================= */

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
================================================= */

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