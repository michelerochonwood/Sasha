const Proposal = require(
  '../models/proposal'
);


/* =====================================================
GET CREATE PURSUIT
===================================================== */

exports.getCreatePursuit =
(req, res) => {

  return res.render(
    'create_pursuit',
    {
      layout:
        'mainlayout',

      pageTitle:
        'Create a Pursuit | Sasha'
    }
  );

};


/* =====================================================
POST CREATE PURSUIT
===================================================== */

exports.postCreatePursuit =
async (req, res) => {

  try {

    const {
      proposalName,
      clientName,
      rfpNumber,
      submissionDeadline,
      proposalStatus,
      searchKeywords,
      aiSummary
    } = req.body;


    const keywords =
      searchKeywords
        ? searchKeywords
            .split(',')
            .map(
              keyword =>
                keyword.trim()
            )
            .filter(Boolean)
        : [];


    const proposal =
      await Proposal.create(
        {
          organization:
            req.session.organizationId,

          proposalName,

          clientName:
            clientName || '',

          rfpNumber:
            rfpNumber || '',

          submissionDeadline:
            submissionDeadline || null,

          proposalStatus:
            proposalStatus || 'new',

          searchKeywords:
            keywords,

          aiSummary:
            aiSummary || ''
        }
      );


    return res.redirect(
      `/pursuit/${proposal._id}`
    );

  } catch (error) {

    console.error(
      'CREATE PURSUIT FAILED:',
      error
    );


    return res.status(500).render(
      'create_pursuit',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Create a Pursuit | Sasha',

        errorMessage:
          'Sasha could not create the pursuit. Please review the information and try again.',

        formData:
          req.body
      }
    );

  }

};