
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
   PREPARE ABBREVIATED OUTLINE FOR WRITE
===================================================== */

const prepareOutlineForWrite = (
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


  const abbreviateSubsection = (
    subsection
  ) => {

    if (
      typeof subsection !==
        'string'
    ) {

      return '';

    }


    const trimmed =
      subsection.trim();


    if (
      !trimmed
    ) {

      return '';

    }


    const separators = [
      ' — ',
      ' – ',
      ': '
    ];


    let abbreviated =
      trimmed;


    for (
      const separator of separators
    ) {

      const separatorIndex =
        abbreviated.indexOf(
          separator
        );


      if (
        separatorIndex >
        -1
      ) {

        abbreviated =
          abbreviated
            .slice(
              0,
              separatorIndex
            )
            .trim();

        break;

      }

    }


    abbreviated =
      abbreviated
        .replace(
          /\s*\([^)]*\)\s*$/,
          ''
        )
        .trim();


    return abbreviated;

  };


  const preparedOutlineSections =
    outlineSections.map(
      (
        outlineSection,
        index
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

          order:
            Number.isFinite(
              outlineSection.order
            )
              ? outlineSection.order
              : index + 1,

          title:
            outlineSection.title ||
            '',

          subsections:
            Array.isArray(
              outlineSection.subsections
            )
              ? outlineSection.subsections
                  .map(
                    (
                      subsection
                    ) =>
                      abbreviateSubsection(
                        subsection
                      )
                  )
                  .filter(
                    Boolean
                  )
              : [],

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

    title:
      safeOutline.title ||
      'Proposal Outline',

    sections:
      preparedOutlineSections

  };

};


/* =====================================================
   GET WRITE
===================================================== */

exports.getWritePursuit =
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
       PREPARE CONTENT SECTIONS
    ================================================== */

    const contentSections =
      Array.isArray(
        proposal.contentSections
      )
        ? proposal.contentSections
        : [];


    /* =================================================
       DETERMINE ACTIVE SECTION
    ================================================== */

    const requestedSectionId =
      req.query.section ||
      null;


    let activeSection =
      null;


    if (
      requestedSectionId
    ) {

      activeSection =
        contentSections.find(
          (
            section
          ) =>
            section.sectionId ===
            requestedSectionId
        ) ||
        null;

    }


    /*
     * If no section was requested, use the first
     * proposal section when one exists.
     */

    if (
      !activeSection &&
      contentSections.length >
        0
    ) {

      activeSection =
        contentSections[0];

    }


    /* =================================================
       MARK ACTIVE SECTION FOR HANDLEBARS
    ================================================== */

    const preparedSections =
      contentSections.map(
        (
          section
        ) => {

          return {
            ...section,

            isActive:
              activeSection
                ? section.sectionId ===
                  activeSection.sectionId
                : false
          };

        }
      );


    /*
     * Use the prepared version as the active section too
     * so the view receives the same normalized object.
     */

    if (
      activeSection
    ) {

      activeSection =
        preparedSections.find(
          (
            section
          ) =>
            section.sectionId ===
            activeSection.sectionId
        ) ||
        null;

    }


    /* =================================================
       PREPARE EXISTING PURSUIT WORK
    ================================================== */

    const rfpAnalysis =
      proposal.rfpAnalysis &&
      typeof proposal.rfpAnalysis ===
        'object'
        ? proposal.rfpAnalysis
        : {};


    const plan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    const winStrategy =
      proposal.winStrategy &&
      typeof proposal.winStrategy ===
        'object'
        ? proposal.winStrategy
        : {};


    /* =================================================
       PREPARE ABBREVIATED PROPOSAL OUTLINE
    ================================================== */

    const outline =
      prepareOutlineForWrite(
        proposal.outline,
        contentSections
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
      'sasha_write',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Write ${proposal.proposalName} | Sasha`,

        proposal,

        analysisMessages,

        contentSections:
          preparedSections,

        activeSection,

        rfpAnalysis,

        plan,

        winStrategy,

        outline,

        /*
         * Saved multi-turn writing conversations
         * will be wired in later.
         */

        writeMessages:
          []
      }
    );


  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT WRITE FAILED:',
      error
    );


    return next(
      error
    );

  }

};