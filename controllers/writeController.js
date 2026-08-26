
const Proposal = require(
  '../models/proposal'
);

/* =====================================================
   BUILD SECTION ID
===================================================== */

const buildSectionId = (
  title,
  order
) => {

  const safeTitle =
    typeof title ===
      'string'
      ? title
          .toLowerCase()
          .trim()
          .replace(
            /[^a-z0-9]+/g,
            '-'
          )
          .replace(
            /^-+|-+$/g,
            ''
          )
      : 'section';


  return (
    `section-${order}-${safeTitle}`
  );

};


/* =====================================================
   DETERMINE WHETHER OUTLINE SECTION IS WRITABLE
===================================================== */

const isWritableOutlineSection = (
  section
) => {

  if (
    !section ||
    typeof section !==
      'object'
  ) {

    return false;

  }


  /*
   * For the current outline structure, positive
   * pageBudget values identify the sections that
   * actually require drafted proposal content.
   *
   * Zero/null sections such as the cover, forms,
   * and appendices remain visible in the outline
   * but do not become writing sections.
   */

  return (
    Number.isFinite(
      section.pageBudget
    ) &&
    section.pageBudget > 0
  );

};


/* =====================================================
   SYNCHRONIZE WRITING SECTIONS WITH OUTLINE
===================================================== */

const synchronizeContentSections = (
  proposal
) => {

  const outline =
    proposal.outline &&
    typeof proposal.outline ===
      'object'
      ? proposal.outline
      : {};


  const outlineSections =
    Array.isArray(
      outline.sections
    )
      ? outline.sections
      : [];


  const existingSections =
    Array.isArray(
      proposal.contentSections
    )
      ? proposal.contentSections
      : [];


  const writableOutlineSections =
    outlineSections.filter(
      (
        section
      ) =>
        isWritableOutlineSection(
          section
        )
    );


  const synchronizedSections =
    writableOutlineSections.map(
      (
        outlineSection,
        index
      ) => {

        const order =
          Number.isFinite(
            outlineSection.order
          )
            ? outlineSection.order
            : index + 1;


        const title =
          typeof outlineSection.title ===
            'string'
            ? outlineSection.title.trim()
            : '';


        /*
         * Preserve an existing section whenever possible.
         *
         * Matching priority:
         * 1. exact title
         * 2. same outline order
         */

        const existingSection =
          existingSections.find(
            (
              section
            ) =>
              section.title ===
              title
          ) ||
          existingSections.find(
            (
              section
            ) =>
              section.order ===
              order
          ) ||
          null;


        const sectionId =
          existingSection &&
          existingSection.sectionId
            ? existingSection.sectionId
            : buildSectionId(
                title,
                order
              );


        return {

          sectionId,

          order,

          title,

          status:
            existingSection &&
            existingSection.status
              ? existingSection.status
              : 'not_started',

          content:
            existingSection &&
            typeof existingSection.content ===
              'string'
              ? existingSection.content
              : '',

          notes:
            existingSection &&
            typeof existingSection.notes ===
              'string'
              ? existingSection.notes
              : '',

          updatedAt:
            existingSection &&
            existingSection.updatedAt
              ? existingSection.updatedAt
              : null

        };

      }
    );


  const currentSnapshot =
    existingSections.map(
      (
        section
      ) => ({
        sectionId:
          section.sectionId ||
          '',

        order:
          section.order,

        title:
          section.title ||
          ''
      })
    );


  const nextSnapshot =
    synchronizedSections.map(
      (
        section
      ) => ({
        sectionId:
          section.sectionId,

        order:
          section.order,

        title:
          section.title
      })
    );


  const changed =
    JSON.stringify(
      currentSnapshot
    ) !==
    JSON.stringify(
      nextSnapshot
    );


  if (
    changed
  ) {

    proposal.contentSections =
      synchronizedSections;

  }


  return {
    changed,
    sections:
      synchronizedSections
  };

};


/* =====================================================
   ABBREVIATE SUBSECTION TITLE
===================================================== */

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
            typeof outlineSection.title ===
              'string'
              ? outlineSection.title
                  .replace(
                    /\s*\(Rated[^)]*\)\s*$/i,
                    ''
                  )
                  .trim()
              : '',

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
      );


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
       SYNCHRONIZE CONTENT SECTIONS
    ================================================== */

    const synchronized =
      synchronizeContentSections(
        proposal
      );


    if (
      synchronized.changed
    ) {

      await proposal.save();

      console.log(
        'SASHA WRITE SECTIONS SYNCHRONIZED:',
        {
          pursuitId:
            proposal._id.toString(),

          sectionCount:
            synchronized.sections.length
        }
      );

    }


    /* =================================================
       PREPARE PLAIN VIEW MODEL
    ================================================== */

    const proposalForView =
      proposal.toObject();


    const contentSections =
      Array.isArray(
        proposalForView.contentSections
      )
        ? proposalForView.contentSections
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
     * Do not automatically force the first section
     * active unless writing sections exist and no
     * explicit selection was made.
     */

    if (
      !activeSection &&
      !requestedSectionId &&
      contentSections.length >
        0
    ) {

      activeSection =
        contentSections[0];

    }


    /* =================================================
       MARK ACTIVE SECTION
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
       PREPARE PURSUIT WORK
    ================================================== */

    const rfpAnalysis =
      proposalForView.rfpAnalysis &&
      typeof proposalForView.rfpAnalysis ===
        'object'
        ? proposalForView.rfpAnalysis
        : {};


    const plan =
      proposalForView.plan &&
      typeof proposalForView.plan ===
        'object'
        ? proposalForView.plan
        : {};


    const winStrategy =
      proposalForView.winStrategy &&
      typeof proposalForView.winStrategy ===
        'object'
        ? proposalForView.winStrategy
        : {};


    const outline =
      prepareOutlineForWrite(
        proposalForView.outline,
        preparedSections
      );


    const analysisMessages =
      Array.isArray(
        proposalForView.analysisMessages
      )
        ? proposalForView.analysisMessages
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
          `Write ${proposalForView.proposalName} | Sasha`,

        proposal:
          proposalForView,

        analysisMessages,

        contentSections:
          preparedSections,

        activeSection,

        rfpAnalysis,

        plan,

        winStrategy,

        outline,

        /*
         * Write conversation will be wired next.
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


/* =====================================================
   SAVE WRITE SECTION
===================================================== */

exports.postWriteSection =
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


    const sectionId =
      typeof req.body.sectionId ===
        'string'
        ? req.body.sectionId.trim()
        : '';


    const content =
      typeof req.body.content ===
        'string'
        ? req.body.content.trim()
        : '';


    const notes =
      typeof req.body.notes ===
        'string'
        ? req.body.notes.trim()
        : '';


    const action =
      typeof req.body.action ===
        'string'
        ? req.body.action.trim()
        : 'save';


    if (
      !pursuitId ||
      !sectionId
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
      );


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
       FIND CONTENT SECTION
    ================================================== */

    const section =
      proposal.contentSections.find(
        (
          item
        ) =>
          item.sectionId ===
          sectionId
      );


    if (
      !section
    ) {

      return res.status(404).send(
        'Proposal section not found.'
      );

    }


    /* =================================================
       SAVE CONTENT
    ================================================== */

    section.content =
      content;

    section.notes =
      notes;

    section.updatedAt =
      new Date();


    if (
      action ===
      'ready_for_review'
    ) {

      section.status =
        'ready_for_review';

    } else if (
      content ||
      notes
    ) {

      section.status =
        'in_progress';

    } else {

      section.status =
        'not_started';

    }


    await proposal.save();


    console.log(
      'SASHA WRITE SECTION SAVED:',
      {
        pursuitId:
          proposal._id.toString(),

        sectionId:
          section.sectionId,

        status:
          section.status
      }
    );


    /* =================================================
       RETURN TO SECTION
    ================================================== */

    return res.redirect(
      `/write?pursuit=${proposal._id}&section=${encodeURIComponent(
        section.sectionId
      )}`
    );


  } catch (
    error
  ) {

    console.error(
      'SAVE PURSUIT WRITE SECTION FAILED:',
      error
    );


    return next(
      error
    );

  }

};