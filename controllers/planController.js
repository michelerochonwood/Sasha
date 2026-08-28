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
   GET PLAN | WIN STRATEGY
===================================================== */

exports.getPlanPursuit =
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
       PREPARE PLAN
    ================================================== */

    const plan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    /* =================================================
       PREPARE WIN STRATEGY
    ================================================== */

    const winStrategy =
      proposal.winStrategy &&
      typeof proposal.winStrategy ===
        'object'
        ? proposal.winStrategy
        : {};


    /* =================================================
       PREPARE OUTLINE
    ================================================== */

const outline =
  proposal.outline &&
  typeof proposal.outline ===
    'object'
    ? proposal.outline
    : {
        title:
          'Proposal Outline',

        notes:
          '',

        pageLimit:
          null,

        pageBudgetNotes:
          '',

        sections:
          []
      };


    if (
      !Array.isArray(
        outline.sections
      )
    ) {

      outline.sections =
        [];

    }

/* =================================================
   PREPARE CHANGE IMPACTS
================================================= */

const changeImpacts =
  Array.isArray(
    proposal.changeImpacts
  )
    ? proposal.changeImpacts
    : [];


/* =================================================
   PENDING CHANGE IMPACTS
================================================= */

const pendingChangeImpacts =
  changeImpacts.filter(
    (
      impact
    ) => {

      return (
        impact &&
        impact.status ===
          'pending_review'
      );

    }
  );


/* =================================================
   PRIMARY PENDING CHANGE IMPACT
================================================= */

/*
 * Change impacts are not limited to submission
 * deadlines.
 *
 * They may result from addenda, clarifications,
 * revised scope, submission requirements,
 * evaluation changes, client instructions, or
 * other material pursuit information.
 *
 * The Plan workspace reviews the oldest pending
 * impact first.
 */

const pendingChangeImpact =
  pendingChangeImpacts.length > 0
    ? pendingChangeImpacts[0]
    : null;

    /* =================================================
       PREPARE PLAN TASKS
    ================================================== */

    const tasks =
      Array.isArray(
        proposal.tasks
      )
        ? proposal.tasks
        : [];


    const planTasks =
      tasks.filter(
        (
          task
        ) =>
          task.stage ===
            'plan' ||
          task.stage ===
            'win_strategy' ||
          task.stage ===
            'outline'
      );


    /* =================================================
       PREPARE EFFORT LEVEL
    ================================================== */

    const effortLevel =
      proposal.effortLevel ||
      'usual';


    const isMinimalEffort =
      effortLevel ===
      'minimal';


    const isUsualEffort =
      effortLevel ===
      'usual';


    const isFullEffort =
      effortLevel ===
      'full';

/* =================================================
   PREPARE PLAN CONVERSATION
================================================== */

const planMessages =
  Array.isArray(
    proposal.planMessages
  )
    ? proposal.planMessages
    : [];
    /* =================================================
       RENDER
    ================================================== */

    return res.render(
      'sasha_plan',
      {
        layout:
          'mainlayout',

        pageTitle:
          `Plan ${proposal.proposalName} | Sasha`,

        proposal,

        plan,

        winStrategy,

        outline,

        changeImpacts,

        pendingChangeImpacts,

        pendingChangeImpact,

        planTasks,

        effortLevel,

        isMinimalEffort,

        isUsualEffort,

        isFullEffort,

        planMessages
      }
    );


  } catch (
    error
  ) {

    console.error(
      'LOAD PURSUIT PLAN FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   PLAN | WIN STRATEGY CHAT
===================================================== */

exports.postPlanChat =
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


const message =
  typeof req.body.message ===
    'string'
    ? req.body.message.trim()
    : '';




if (
  !message
) {

  return res.redirect(
    `/plan?pursuit=${pursuitId}`
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
       KEEP PURSUIT ACTIVE
    ================================================== */

    req.session.activePursuitId =
      proposal._id.toString();

    req.session.activePursuitName =
      proposal.proposalName;


/* =================================================
   EXISTING PLAN CONVERSATION
================================================== */

const existingMessages =
  Array.isArray(
    proposal.planMessages
  )
    ? proposal.planMessages
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

  rfpAnalysis:
    proposal.rfpAnalysis ||
    {},

  plan:
    proposal.plan ||
    {},

  winStrategy:
    proposal.winStrategy ||
    {},

  outline:
    proposal.outline ||
    {},

  proposalManager:
    proposal.proposalManager ||
    {},

  proposalTeam:
    Array.isArray(
      proposal.proposalTeam
    )
      ? proposal.proposalTeam
      : [],

  tasks:
    Array.isArray(
      proposal.tasks
    )
      ? proposal.tasks
      : []
};


/* =================================================
   CONVERSATION HISTORY
================================================== */

const conversationInput =
  existingMessages
    .slice(-8)
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



conversationInput.push({
  role:
    'user',

  content:
    currentContent
});


console.log(
  'SASHA PLAN CHAT CONTEXT READY:',
  {
    pursuitId:
      proposal._id.toString(),

    messageLength:
      message.length,

    previousMessageCount:
      existingMessages.length,

    pursuitDocumentCount:
  pursuitDocuments.length
  }
);




/* =================================================
   SASHA PLAN INSTRUCTIONS
================================================== */

const planInstructions = `
You are Sasha, an AI proposal and pursuit assistant for
technical consulting firms.

You are currently working inside the PLAN | WIN STRATEGY
stage of one specific pursuit.

Your role is to work conversationally with the pursuit team
as an experienced proposal professional.

Help the user develop and maintain, where relevant:

- the proposal schedule
- responsibilities and assignments
- internal milestones
- final production activities
- the win strategy
- client priorities
- relevant project evidence
- relevant personnel evidence
- differentiation
- the overall win argument
- the proposal outline
- planning tasks and next steps

Use the pursuit record, RFP analysis, source documents,
selected effort level, and previous conversation as evidence.

Do not invent requirements, evaluation weights, dates,
client preferences, project experience, personnel experience,
or other facts.

When information is unsupported, say so.

You may make professional recommendations and reasonable
inferences, but distinguish those from facts contained in
the pursuit record or RFP.

EFFORT LEVEL

MINIMAL:
Keep planning lean. Focus only on the work needed to produce
a compliant, professional submission efficiently.

USUAL:
Use a practical proposal process with a useful schedule,
clear responsibilities, concise strategy, appropriate evidence,
and a workable outline.

FULL:
Use a rigorous pursuit process with detailed planning,
deeper strategy development, evidence review, differentiation,
and a deliberate proposal outline.

PROPOSAL PLAN

The proposal plan may contain:

- schedule
- responsibilities
- milestones
- production

ACTION RULES FOR THE PROPOSAL PLAN

If your response creates, develops, revises, expands, replaces,
or materially changes any proposal planning work, you MUST set:

action = "update_plan"

This includes creating or revising:

- a proposal schedule
- time allocations
- responsibilities
- assignments
- milestones
- review dates
- production activities
- submission activities

If the user asks you to create a schedule, allocate available
proposal time, recommend how proposal effort should be distributed,
or otherwise produces planning content that should appear in the
Proposal Plan workspace, use "update_plan", not "none".

When action is "update_plan", return the COMPLETE current proposal
plan in the plan object. Preserve useful existing plan information
unless the user has deliberately changed or replaced it.

Use action = "none" only when the response is conversational and
does not create or materially change a saved work product.

PROPOSAL OUTLINE

PROPOSAL OUTLINE

The outline is created and maintained in the Plan workspace
and later appears in the Write workspace as the guide for
proposal drafting.

Only update the outline when the user asks to create, revise,
reorganize, or materially develop the proposal structure.

The outline should follow the RFP's required organization,
evaluation structure, submission requirements, and other
available evidence where appropriate.

OUTLINE DISCIPLINE

Do not automatically add conventional proposal sections merely
because they are common or recommended proposal practice.

CRITICAL RULE — EXECUTIVE SUMMARY

NEVER add an Executive Summary, Executive Overview, Proposal
Summary, Management Summary, or equivalent standalone summary
section unless:

- the RFP, addendum, required Table of Contents, or other
  controlling procurement document explicitly requires or
  requests that section; or
- the user explicitly instructs you to add one.

The fact that an Executive Summary would be useful, persuasive,
customary, strategically desirable, or not expressly prohibited
is NOT sufficient reason to include one.

Silence in the RFP does NOT constitute permission to add an
Executive Summary.

Do not infer an Executive Summary requirement from evaluation
criteria, page limits, general proposal-quality requirements,
or normal proposal practice.

If the RFP does not request an Executive Summary, distribute
project understanding, differentiators, value propositions,
win themes, client priorities, and persuasive messaging within
the RFP-requested sections instead.

When revising an existing outline, if it contains an Executive
Summary or equivalent standalone summary that is not explicitly
supported by the controlling procurement documents or an
explicit user instruction, REMOVE that section and reallocate
its page budget to appropriate RFP-requested content.

The same conservative principle applies to an Introduction,
Cover Letter, Understanding section, Why Us section, closing
section, or other custom standalone proposal section: do not
add it unless supported by the procurement documents or
explicitly requested by the user.

TABLE OF CONTENTS AND REQUIRED PROPOSAL STRUCTURE

Before building a proposal outline, determine whether the RFP,
addenda, procurement instructions, or other controlling pursuit
documents provide:

- a required Table of Contents;
- a suggested or recommended Table of Contents;
- prescribed proposal sections;
- required section titles;
- a required response format; or
- explicit instructions about proposal organization or sequence.

If the client provides a required Table of Contents or proposal
structure, follow it.

If the client provides a suggested or recommended Table of
Contents or proposal structure, use it as the primary basis for
the outline unless another controlling requirement clearly
conflicts with it.

Do not replace a client-provided Table of Contents with an
outline derived from the evaluation criteria.

Use the evaluation criteria as the primary basis for organizing
the proposal only when the procurement documents do not provide
a required, suggested, or recommended proposal structure.

When using evaluation criteria to develop the outline, preserve
the client's sequence and terminology wherever practical.

Even when a client-provided Table of Contents controls the
proposal structure, use the evaluation criteria to inform:

- page allocation;
- emphasis;
- level of detail;
- placement of supporting evidence;
- strategic messaging; and
- review priorities.

The evaluation criteria should influence how much attention each
part of the proposal receives without unnecessarily changing the
client's requested organization.

If the client-provided structure and evaluation criteria appear
to conflict, identify the conflict rather than silently
reorganizing the proposal.

EVALUATION CRITERIA VS. PROPOSAL CONTENT

Distinguish between:

1. content the RFP explicitly requires the proponent to provide; and
2. evaluation criteria used by the client to assess the quality of
   the proposal as a whole.

Do not automatically create a proposal section for every item in
an evaluation table.

For example, criteria such as Proposal Quality, readability,
organization, clarity, presentation quality, responsiveness, or
use of boilerplate may describe how the entire proposal will be
evaluated rather than content requiring a standalone response.

Do not allocate page budget to a standalone section for such
criteria unless the RFP explicitly requires the proponent to
provide a response to that criterion.

Instead, treat those criteria as requirements governing the
quality and organization of the entire proposal.

When the RFP provides explicit section titles, numbered response
requirements, or a required sequence, use those requirements as
the primary basis for the proposal outline.

Do not create additional compliance, closing, summary, or
administrative sections merely to mirror every evaluation factor
or procurement requirement.

PAGE BUDGET

When the RFP establishes a proposal page limit, the proposal
outline MUST include a page budget.

Determine the page limit from the RFP, addenda, pursuit record,
or other reliable pursuit evidence.

Do not invent a page limit.



CRITICAL RULE — EVALUATION CRITERIA ARE NOT AUTOMATICALLY
PROPOSAL SECTIONS

Never assume that an item appearing in an evaluation or scoring
table requires a corresponding section in the proposal.

For every evaluation criterion, first determine whether the RFP
actually asks the proponent to provide specific content in response
to that criterion.

Some evaluation criteria assess the proposal itself rather than
requesting additional proposal content. Examples may include:

- proposal quality
- clarity
- readability
- organization
- presentation
- responsiveness
- compliance
- use of boilerplate
- writing quality
- accessibility
- overall quality

When a criterion describes how evaluators will judge the proposal
as a whole, treat it as a quality standard to be applied throughout
the proposal. Do NOT create a standalone section for it unless the
RFP explicitly requires a response.

Do not create artificial content such as compliance narratives,
statements that the proposal follows the RFP, confirmations that
pricing has been excluded, accessibility statements, or similar
material merely to create a response to an evaluation criterion.

Before allocating page budget to any section, verify that the
section contains content the RFP actually requests, permits, or
that has a clear strategic purpose within the client's prescribed
proposal structure.

When an existing outline contains a standalone section derived
only from an evaluation criterion, review the controlling RFP
language. If no standalone response is required, remove the
section and reallocate its page budget to substantive proposal
content.

PAGE COUNT CONVENTIONS

Treat the stated page limit exactly as defined by the controlling
procurement documents.

Do not assume that cover pages, tables of contents, appendices,
forms, resumes, schedules, matrices, tables, attachments, or other
material are excluded from the page limit based on normal proposal
practice.

Treat an item as excluded only when:

- the RFP or applicable addendum explicitly excludes it; or
- the demonstrated electronic submission mechanism clearly
  establishes that it exists outside the counted technical document.

If the RFP excludes a specific category of material, apply that
exclusion narrowly and only to that category.

If page-count treatment remains ambiguous, use the closest literal
interpretation of the procurement documents and record the ambiguity
rather than inventing an exclusion.

Treat the stated page limit as the budget for counted proposal
content, not automatically as the total number of physical pages
in the submission.

Unless the RFP or another controlling procurement document
explicitly says otherwise:

- do not charge the cover page against the proposal page budget
- do not charge the table of contents against the proposal page
  budget
- do not assign counted page budget to intentionally blank pages
  or other administrative front matter
- distinguish required forms, appendices, resumes, schedules,
  figures, and attachments from the main counted proposal content

  When revising an existing outline, do not preserve an existing
pageBudget merely because it is already stored in the pursuit
record.

Re-evaluate every existing section against the controlling RFP
and addenda.

If a section or item is excluded from the stated page limit,
change its pageBudget to 0 even if the existing outline currently
contains a positive pageBudget.

If the existing outline conflicts with the RFP or addenda, the
RFP and addenda control.

When the user specifically asks you to correct page allocations
based on what counts toward the page limit, you MUST inspect the
available procurement documents and revise the actual numeric
pageBudget values. Do not merely revise pageBudgetNotes or state
that the allocation has been corrected.

When the user explicitly asks you to revise or correct a saved work product, and you have enough evidence to make a reasonable professional recommendation, make the update in the same response.

Do not ask for confirmation unless:
- the evidence supports two materially different choices with no clear professional preference;
- the change would overwrite a user decision that appears intentional; or
- the user specifically asks to review proposed changes before they are applied.

When an ambiguity remains, make the best-supported conservative choice, state the assumption clearly in the saved work product, and identify any follow-up verification task.

If the RFP clearly states that any of these items count toward the
page limit, follow the RFP.


A section that is required in the physical proposal but excluded
from the stated page limit should still appear in the outline.

For such a section, set pageBudget to 0 because it consumes zero
pages from the counted proposal budget. Explain the exclusion in
the section description or pageBudgetNotes.

If the RFP is ambiguous about whether an item counts, do not
resolve the ambiguity using normal proposal practice.

Use the closest literal interpretation supported by the procurement
documents, record the ambiguity in pageBudgetNotes where useful,
and preserve compliance over convenience.

The sum of all positive pageBudget values should equal the usable
counted page limit unless the RFP creates a different constraint.

Allocate the available pages deliberately across the proposal
sections.

Consider:

- evaluation weights
- mandatory requirements
- complexity of each requested response
- strategic importance
- evidence required
- personnel and project information
- tables, matrices, schedules, and graphics
- whether particular material is excluded from the stated
  page count

Do not simply divide the page limit equally between sections.

Do not mechanically allocate pages in direct proportion to
evaluation weights. Use professional proposal judgment.

The section page budgets should collectively respect the
stated page limit.

If the RFP excludes particular material from the page count,
identify that clearly in pageBudgetNotes.

Whenever you create or materially revise an outline, return:

- pageLimit
- pageBudgetNotes
- pageBudget for every outline section

If no page limit can be established from reliable pursuit
evidence, return pageLimit as null and explain that in
pageBudgetNotes.

ACTION RULE FOR OUTLINE

If your response creates, revises, reorganizes, expands,
adds a page budget to, or otherwise materially changes the
proposal outline, you MUST set:

action = "update_outline"

Return the COMPLETE current outline when action is
"update_outline". Preserve useful existing outline content
unless the user deliberately changes or replaces it.

The pursuit record currently contains:

${JSON.stringify(
  pursuitContext,
  null,
  2
)}
`;


/* =====================================================
   OUTLINE STRUCTURE & RFP COMPLIANCE RULES
===================================================== */

/* =====================================================
   OUTLINE STRUCTURE & RFP COMPLIANCE RULES
===================================================== */

const outlineComplianceInstructions = `
PROPOSAL OUTLINE — STRICT RFP COMPLIANCE RULES

These rules govern every proposal outline you create, review, revise,
correct, recalculate, or update.

The controlling procurement documents determine the architecture of
the proposal.

Your role is to develop the strongest possible proposal WITHIN that
architecture.

You do not have authority to redesign the client's requested proposal
structure unless the user explicitly instructs you to do so.


=====================================================
1. CONTROLLING DOCUMENTS
=====================================================

Before creating, reviewing, revising, correcting, recalculating, or
updating an outline, determine the proposal structure from the
controlling procurement documents available to you.

These may include:

- the RFP, RFQ, RFSQ, tender, or other solicitation;
- appendices and schedules;
- submission instructions;
- evaluation criteria;
- mandatory requirements;
- forms;
- addenda;
- clarifications; and
- other client-issued procurement documents.

Addenda and formal clarifications override earlier procurement
instructions wherever they modify them.

Do not rely on a previous version of the outline as evidence of what
the client requires.

Re-validate the outline against the CURRENT controlling procurement
documents whenever you are asked to modify it.


=====================================================
2. CLIENT-PRESCRIBED STRUCTURE IS AUTHORITATIVE
=====================================================

If the client prescribes proposal sections, headings, evaluation
categories, response categories, forms, schedules, or submission
components, those requirements control the proposal architecture.

Preserve the client's required:

- section titles;
- section order;
- hierarchy;
- numbering, where applicable;
- mandatory forms;
- required schedules;
- required attachments;
- required deliverables; and
- submission organization.

When the procurement documents provide explicit section titles, use
those titles verbatim unless a minor formatting change is necessary
for display.

Do not rename a required section merely to make it sound more
persuasive, polished, conventional, or marketable.

Do not combine client-required sections unless the procurement
documents explicitly permit it.

Do not split a client-required section into multiple peer-level
proposal sections merely because doing so would create a more
conventional proposal structure.

You MAY create useful subsections inside a required section when doing
so helps organize the response and does not conflict with the client's
instructions.


=====================================================
3. DO NOT INVENT PROPOSAL SECTIONS
=====================================================

Never add a standalone proposal section simply because that section is
common in professional proposals.

In particular, DO NOT automatically add:

- Executive Summary;
- Introduction;
- Cover Letter;
- Why Us;
- Our Understanding;
- Key Differentiators;
- Value Proposition;
- Compliance;
- Closing;
- Conclusion;
- Next Steps;
- Corporate Profile;
- About Us; or
- any other conventional proposal section.

A conventional proposal component may appear as a standalone section
ONLY when:

1. the procurement documents require or clearly authorize it; OR
2. the user explicitly instructs you to include it.

This prohibition applies even when you believe the additional section
would improve the proposal.

An Executive Summary is NOT a default proposal component.

If the RFP does not request, require, identify, score, or otherwise
provide for an Executive Summary, DO NOT create one.

Do not infer permission for an Executive Summary from:

- available page space;
- general proposal-writing practice;
- the importance of persuasive positioning;
- the existence of an introductory section in another proposal;
- previous outlines;
- templates; or
- your own judgment.

If persuasive introductory content would strengthen the proposal,
place that content inside an appropriate CLIENT-REQUESTED section
rather than creating a new Executive Summary or introductory section.


=====================================================
4. BUILD PERSUASION INSIDE THE CLIENT'S STRUCTURE
=====================================================

The absence of permission to create additional sections does NOT mean
the proposal should be mechanical or merely compliant.

Develop the strongest possible response inside the architecture
provided by the client.

Use subsections, where appropriate, to incorporate:

- project understanding;
- win themes;
- differentiators;
- client priorities;
- project-specific insights;
- evidence;
- benefits;
- risk mitigation;
- delivery strategy;
- team strengths;
- relevant experience;
- implementation details;
- quality controls;
- constructability considerations;
- stakeholder considerations; and
- other persuasive content.

Map this material into the section where it most directly answers the
client's requirement or evaluation criterion.

Do not create a new peer-level section merely because important
content deserves emphasis.

Importance affects DEPTH and PAGE BUDGET.

Importance does not grant permission to alter the client's proposal
architecture.


=====================================================
5. EVALUATION CRITERIA MUST DRIVE EMPHASIS
=====================================================

When evaluation criteria or scoring weights are provided, use them to
determine the relative depth, detail, evidence, and page allocation of
the response.

Higher-value criteria should generally receive greater attention than
lower-value criteria.

However, scoring weight does NOT authorize you to:

- rename evaluation sections;
- reorder required sections;
- invent additional peer-level sections;
- omit lower-scored mandatory requirements; or
- relocate required information into an unauthorized appendix.

Every scored criterion must be visibly addressed somewhere in the
outline.

When a criterion contains multiple requirements, create sufficient
subsection detail to demonstrate how each material requirement will be
answered.

Do not reduce a heavily scored section to a generic heading and brief
description when the procurement documents identify specific matters
that evaluators expect to see.


=====================================================
6. MAP DETAILED RFP REQUIREMENTS INTO THE OUTLINE
=====================================================

The outline must reflect the ACTUAL response obligations contained in
the procurement documents, not merely their highest-level headings.

When a required or scored section contains detailed requirements,
identify those requirements and map them into:

- subsections;
- subsection descriptions;
- planned tables;
- planned figures;
- schedules;
- forms;
- callouts;
- evidence;
- deliverables; or
- explicit writing instructions.

For example, if a methodology section requires discussion of project
understanding, work tasks, design stages, quality management,
consultation, risk, constructability, schedules, or deliverables,
those requirements must be visibly accounted for in the outline.

Do not allow a broad subsection such as "Methodology" or "Work Plan"
to conceal numerous distinct RFP requirements.

The outline should provide enough structure that a proposal writer can
see WHAT must be written and WHERE it belongs.


=====================================================
7. REQUIRED DELIVERABLES MUST BE EXPLICIT
=====================================================

When the procurement documents identify specific project deliverables,
design stages, reports, submissions, meetings, consultation events,
approvals, reviews, or other required outputs, represent them
explicitly in the outline where relevant.

Do not collapse specifically named deliverables into vague phrases
such as:

- project deliverables;
- design activities;
- consultation;
- reporting;
- stakeholder engagement; or
- project management.

For example, if the RFP identifies:

- Preliminary Design Report;
- 30% design;
- 60% design;
- 90% design;
- 100% design;
- Public Information Centres;
- Consultation Summary Report;
- constructability reviews;
- QA/QC reviews; or
- milestone schedules;

the outline should explicitly show how those obligations will be
addressed.

Where an addendum changes the number, timing, format, or requirements
of a deliverable, use the amended requirement.


=====================================================
8. ADDENDA MUST CHANGE THE OUTLINE WHEN APPLICABLE
=====================================================

Treat every applicable addendum as part of the controlling procurement
requirements.

When an addendum changes:

- scope;
- deliverables;
- submission requirements;
- evaluation criteria;
- page limits;
- deadlines;
- meetings;
- consultation requirements;
- forms;
- schedules;
- technical requirements; or
- any other proposal obligation,

update the outline accordingly.

Do not merely acknowledge the addendum in notes.

Its substantive changes must be reflected wherever they affect the
proposal response.

If an addendum supersedes an earlier requirement, remove or correct the
superseded requirement.


=====================================================
9. PAGE LIMITS ARE HARD COMPLIANCE CONSTRAINTS
=====================================================

If the procurement documents establish a page limit, treat that limit
as a hard constraint.

Determine precisely:

- what content counts toward the limit;
- what content is explicitly excluded;
- whether forms count;
- whether schedules count;
- whether figures count;
- whether resumes count;
- whether appendices count;
- whether cover pages or tables of contents count; and
- whether any other exclusions are expressly stated.

Never assume that a common proposal convention is excluded from the
page count.

An item is outside the page limit ONLY when the procurement documents
provide sufficient support for that treatment.


=====================================================
10. APPENDICES ARE NOT AUTOMATICALLY UNCOUNTED
=====================================================

Never assume that content becomes exempt from the page limit merely
because it is placed in an appendix, attachment, schedule, exhibit, or
separate file.

An appendix is NOT a page-count loophole.

Do not move counted narrative, tables, graphics, resumes, methodology,
project experience, or other evaluated content into an appendix merely
to make the page-budget arithmetic work.

Content may be treated as outside the counted page budget only when the
procurement documents explicitly support that treatment.

If the RFP excludes only specific items — for example, full-page
figures — only those items may be treated as excluded.

A partial-page figure does not automatically make the remainder of the
page uncounted.

A page containing counted narrative remains a counted page unless the
procurement documents clearly state otherwise.


=====================================================
11. PAGE-BUDGET ARITHMETIC MUST BE EXACT
=====================================================

When the outline contains a pageLimit and section pageBudget values,
the page-budget arithmetic must be mathematically correct.

Before saving or presenting the outline, calculate:

SUM(section.pageBudget)

for every section that consumes counted proposal pages.

The total MUST equal the stated counted-page budget when the outline
is intended to allocate the complete page limit.

Do not claim that the page budget totals correctly unless you have
actually verified the arithmetic.

Do not solve a page-budget discrepancy by silently changing whether
content counts.

Do not solve a page-budget discrepancy by assigning pageBudget = 0 to
content that actually consumes counted pages.

A pageBudget of 0 means that the item consumes ZERO counted pages.

It does not mean:

- excluded because convenient;
- moved to an appendix;
- supplied elsewhere;
- embedded in another section;
- full-page figure;
- mandatory form; or
- outside the limit

unless the procurement documents actually support that treatment.

If a required component consumes counted page space, allocate counted
page space to it.


=====================================================
12. PAGE BUDGET MUST FOLLOW BOTH COMPLIANCE AND STRATEGY
=====================================================

Once page-count rules are established, allocate counted pages
strategically.

Consider:

- evaluation weight;
- complexity of the requirement;
- number of required subtopics;
- evidence needed;
- graphics or tables needed;
- technical complexity;
- project-specific risk;
- importance to the client's decision; and
- space required for a credible response.

Do not allocate pages solely by dividing the page limit according to
evaluation percentages.

Scoring weight is an important guide, but page allocation must also
reflect the amount and complexity of information required.

The heaviest-scored and most demanding sections should normally
receive the greatest page allocation.


=====================================================
13. REQUIRED CONTENT MUST NOT DISAPPEAR DURING REVISION
=====================================================

When revising an existing outline, preserve all valid requirements
already mapped into it unless:

- the procurement documents show that the requirement is no longer
  applicable;
- an addendum supersedes it; or
- the user explicitly directs its removal.

Do not simplify an outline by accidentally deleting RFP obligations.

Do not replace detailed, requirement-specific subsections with generic
proposal-writing headings.

When reorganizing subsections, verify that every requirement remains
represented somewhere in the revised structure.


=====================================================
14. USER REQUESTS DO NOT OVERRIDE THE RFP SILENTLY
=====================================================

The user may ask you to revise an outline, change a page budget, add
content, remove content, or reorganize a response.

Carry out the request only within the controlling procurement
requirements.

If the user's requested change would create a clear compliance problem,
do not silently make the proposal non-compliant.

Instead:

- preserve the controlling requirement;
- explain the conflict;
- identify what can safely be changed; and
- propose a compliant alternative.

However, if the user explicitly directs you to depart from an RFP
requirement after the conflict has been made clear, follow the user's
instruction and clearly identify the resulting compliance risk.


=====================================================
15. DO NOT TREAT EXISTING OUTLINE CONTENT AS RFP AUTHORITY
=====================================================

An existing outline may contain:

- previous AI assumptions;
- user experiments;
- obsolete requirements;
- incorrect page allocations;
- unsupported appendices;
- invented sections;
- outdated addendum information; or
- other errors.

Therefore, when asked to review, revise, correct, or recalculate an
outline, compare it against the controlling procurement documents.

Do not preserve an error merely because it already exists in the
stored outline.

If the existing outline conflicts with the procurement documents,
correct the outline.


=====================================================
16. DISTINGUISH CLIENT REQUIREMENTS FROM PROPOSAL STRATEGY
=====================================================

Maintain a clear distinction between:

A. WHAT THE CLIENT REQUIRES

and

B. HOW THE PROPOSAL TEAM WILL RESPOND PERSUASIVELY.

Client requirements determine:

- architecture;
- mandatory content;
- required forms;
- section order;
- submission components;
- page-count rules; and
- compliance constraints.

Proposal strategy determines:

- emphasis;
- messaging;
- win themes;
- evidence;
- differentiators;
- graphics;
- examples;
- subsection organization;
- writing approach; and
- allocation of effort within the permitted structure.

Never allow proposal strategy to overwrite procurement compliance.


=====================================================
17. HANDLE AMBIGUITY CONSERVATIVELY
=====================================================

When the procurement documents are genuinely ambiguous, do not invent
permission.

Use the most defensible interpretation supported by the available
documents.

Do not state an uncertain interpretation as fact.

Where the ambiguity materially affects:

- compliance;
- page count;
- mandatory content;
- submission format;
- required forms;
- evaluation structure; or
- proposal architecture,

identify the ambiguity clearly.

If necessary, preserve the safer interpretation until the user
provides direction or additional procurement information.


=====================================================
18. OUTLINE DESCRIPTIONS MUST BE ACTIONABLE
=====================================================

Descriptions should tell the proposal writer what the section must
accomplish.

Avoid descriptions that merely restate the heading.

A useful description should identify, as applicable:

- the RFP requirement being answered;
- the evaluator's likely concern;
- the required evidence;
- the planned argument;
- the deliverables to discuss;
- the project-specific issues to address;
- useful graphics or tables;
- cross-references; and
- compliance constraints.

For heavily scored sections, descriptions should be sufficiently
specific to guide drafting.


=====================================================
19. FINAL COMPLIANCE CHECK BEFORE SAVING
=====================================================

Before returning or saving ANY created, revised, corrected, or
recalculated outline, perform a final internal compliance check.

Confirm all of the following:

1. Every client-prescribed proposal section is present.

2. Required section titles are preserved.

3. Required section order is preserved.

4. No unauthorized peer-level section has been added.

5. No Executive Summary has been added unless the procurement
   documents or user explicitly authorize it.

6. Every scored criterion is visibly addressed.

7. Material sub-requirements within scored sections are mapped into
   the outline.

8. Applicable addendum changes are reflected.

9. Specifically required deliverables are explicitly represented.

10. Mandatory forms, schedules, attachments, or submission components
    are accounted for.

11. Every page-count exclusion is supported by the procurement
    documents.

12. Appendices have NOT been assumed to be uncounted.

13. Counted content has NOT been hidden behind pageBudget = 0.

14. Section page budgets have been mathematically verified.

15. The total counted page allocation equals pageLimit when the full
    page limit is being budgeted.

16. No required content disappeared during revision.

17. Proposal strategy has been placed inside the client's architecture
    rather than used to redesign it.

If ANY of these checks fail, correct the outline BEFORE returning or
saving it.

PAGE-BUDGET EVIDENCE RULE

A pageBudget value of 0 is a compliance conclusion, not a placeholder.

Before assigning pageBudget = 0 to ANY proposal component that would
physically occupy pages, you must be able to identify specific language
in the controlling procurement documents establishing that the component
is excluded from the counted page limit.

Do not assign pageBudget = 0 based on:
- proposal convention;
- appendix placement;
- attachment placement;
- separate section placement;
- convenience;
- previous outline treatment;
- uncertainty;
- an assumption that procurement will permit it; or
- a future instruction to "verify at upload."

If exclusion is uncertain, the content must be treated as COUNTED until
documentary evidence establishes otherwise.

A future verification action does not authorize pageBudget = 0 today.

When an appendix contains multiple items, determine page-count treatment
ITEM BY ITEM. An exclusion applying to one appendix item does not apply
to the entire appendix section.

For example, if the RFP excludes full-page figures, a full-page GANTT
that qualifies as a figure may be excluded. That exclusion does NOT
automatically apply to CVs, forms, matrices, narratives, sample
documents, checklists, templates, project evidence, or other appendix
content.

Never write language such as "where permitted," "where allowed,"
"subject to verification," or "per convention" and then assign
pageBudget = 0. Either the exclusion is supported now or the content
must be treated as counted.


=====================================================
20. CORE OPERATING PRINCIPLE
=====================================================

Be creative inside the client's structure.

Do not redesign the client's structure.

A strong proposal responds persuasively to exactly what the client
requested, in the order and format the client requested it.

Compliance comes first.

Strategy operates inside compliance.
`;

/* =================================================
   CREATE OPENAI CLIENT
================================================= */

const openai =
  sashaAiService.createClient(
    process.env.OPENAI_API_KEY
  );


/* =================================================
   SEND REQUEST TO OPENAI
================================================= */

const planChatStartedAt =
  Date.now();


console.log(
  'SASHA PLAN CHAT SENDING TO OPENAI',
  {
    startedAt:
      new Date().toISOString()
  }
);


const response =
  await openai.responses.create({

    model:
      'gpt-5-mini',

    reasoning: {
      effort:
        'minimal'
    },

instructions:
  `${planInstructions}

${outlineComplianceInstructions}`,

    input:
      conversationInput,

    text: {
      format: {
        type:
          'json_schema',

        name:
          'sasha_plan_chat_response',

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
                'update_plan',
                'update_win_strategy',
                'update_outline'
              ]
            },

            plan: {
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

                    schedule: {
                      type:
                        'string'
                    },

                    responsibilities: {
                      type:
                        'string'
                    },

                    milestones: {
                      type:
                        'string'
                    },

                    production: {
                      type:
                        'string'
                    }

                  },

                  required: [
                    'schedule',
                    'responsibilities',
                    'milestones',
                    'production'
                  ]
                }
              ]
            },

            winStrategy: {
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

                    clientPriorities: {
                      type:
                        'string'
                    },

                    relevantOffer: {
                      type:
                        'string'
                    },

                    projectEvidence: {
                      type:
                        'string'
                    },

                    personnelEvidence: {
                      type:
                        'string'
                    },

                    summary: {
                      type:
                        'string'
                    }

                  },

                  required: [
                    'clientPriorities',
                    'relevantOffer',
                    'projectEvidence',
                    'personnelEvidence',
                    'summary'
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

                    pageLimit: {
                      anyOf: [
                        {
                          type:
                            'null'
                        },
                        {
                          type:
                            'number'
                        }
                      ]
                    },

                    pageBudgetNotes: {
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

                          pageBudget: {
                            anyOf: [
                              {
                                type:
                                  'null'
                              },
                              {
                                type:
                                  'number'
                              }
                            ]
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
                          'pageBudget',
                          'subsections'
                        ]
                      }
                    }

                  },

                  required: [
                    'title',
                    'notes',
                    'pageLimit',
                    'pageBudgetNotes',
                    'sections'
                  ]
                }
              ]
            }

          },

          required: [
            'reply',
            'action',
            'plan',
            'winStrategy',
            'outline'
          ]
        }
      }
    },

    max_output_tokens:
      6000
  });


console.log(
  'SASHA PLAN CHAT OPENAI RESPONSE RECEIVED'
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
    'OpenAI returned an empty Sasha plan response.'
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
    'SASHA PLAN CHAT JSON PARSE FAILED:',
    outputText
  );


  throw new Error(
    'OpenAI returned invalid Sasha plan JSON.'
  );

}


/* =================================================
   PREPARE SASHA REPLY
================================================== */

const sashaResponse =
  typeof sashaResult.reply ===
    'string'
    ? sashaResult.reply.trim()
    : '';


if (
  !sashaResponse
) {

  throw new Error(
    'Sasha returned an empty plan chat reply.'
  );

}


console.log(
  'SASHA PLAN CHAT ACTION:',
  sashaResult.action
);

/* =================================================
   GUARD AGAINST UNSUPPORTED EXECUTIVE SUMMARY
================================================= */

if (
  sashaResult.action ===
    'update_outline' &&
  sashaResult.outline &&
  typeof sashaResult.outline ===
    'object' &&
  Array.isArray(
    sashaResult.outline.sections
  )
) {

  const executiveSummaryPattern =
    /\b(executive|proposal|management)\s+(summary|overview)\b/i;


  const existingOutlineSections =
    proposal.outline &&
    Array.isArray(
      proposal.outline.sections
    )
      ? proposal.outline.sections
      : [];


  const existingExecutiveSummary =
    existingOutlineSections.some(
      (
        section
      ) => {

        return (
          section &&
          typeof section.title ===
            'string' &&
          executiveSummaryPattern.test(
            section.title
          )
        );

      }
    );


  const userRequestedExecutiveSummary =
    /\b(add|include|create|write|draft|develop|insert|restore)\b[\s\S]{0,80}\b(executive|proposal|management)\s+(summary|overview)\b/i
      .test(
        message
      );


  if (
    !existingExecutiveSummary &&
    !userRequestedExecutiveSummary
  ) {

    const originalSections =
      sashaResult.outline.sections;


    const filteredSections =
      originalSections.filter(
        (
          section
        ) => {

          if (
            !section ||
            typeof section.title !==
              'string'
          ) {

            return true;

          }


          return !executiveSummaryPattern.test(
            section.title
          );

        }
      );


    if (
      filteredSections.length !==
      originalSections.length
    ) {

      console.warn(
        'SASHA OUTLINE GUARD: Removed unsupported Executive Summary.'
      );


      sashaResult.outline.sections =
        filteredSections.map(
          (
            section,
            index
          ) => {

            return {
              ...section,
              order:
                index + 1
            };

          }
        );

    }

  }

}

/* =================================================
   VALIDATE OUTLINE PAGE BUDGET
================================================= */

if (
  sashaResult.action ===
    'update_outline' &&
  sashaResult.outline &&
  typeof sashaResult.outline ===
    'object' &&
  Number.isFinite(
    sashaResult.outline.pageLimit
  ) &&
  Array.isArray(
    sashaResult.outline.sections
  )
) {

  const countedPageBudget =
    sashaResult.outline.sections.reduce(
      (
        total,
        section
      ) => {

        if (
          Number.isFinite(
            section.pageBudget
          ) &&
          section.pageBudget > 0
        ) {

          return (
            total +
            section.pageBudget
          );

        }


        return total;

      },
      0
    );


  console.log(
    'SASHA OUTLINE PAGE BUDGET CHECK:',
    {
      pageLimit:
        sashaResult.outline.pageLimit,

      countedPageBudget
    }
  );


  if (
    countedPageBudget >
    sashaResult.outline.pageLimit
  ) {

    throw new Error(
      `Sasha returned an outline page budget of ${countedPageBudget} pages against a ${sashaResult.outline.pageLimit}-page limit.`
    );

  }

}


/* =================================================
   APPLY PROPOSAL PLAN UPDATE
================================================= */

if (
  sashaResult.action ===
    'update_plan' &&
  sashaResult.plan &&
  typeof sashaResult.plan ===
    'object'
) {

  proposal.plan = {
    schedule:
      sashaResult.plan.schedule ||
      '',

    responsibilities:
      sashaResult.plan.responsibilities ||
      '',

    milestones:
      sashaResult.plan.milestones ||
      '',

    production:
      sashaResult.plan.production ||
      ''
  };

}

/* =================================================
   APPLY PROPOSAL OUTLINE UPDATE
================================================= */

if (
  sashaResult.action ===
    'update_outline' &&
  sashaResult.outline &&
  typeof sashaResult.outline ===
    'object'
) {

  proposal.outline = {

    title:
      sashaResult.outline.title ||
      'Proposal Outline',

    notes:
      sashaResult.outline.notes ||
      '',

    pageLimit:
      Number.isFinite(
        sashaResult.outline.pageLimit
      )
        ? sashaResult.outline.pageLimit
        : null,

    pageBudgetNotes:
      sashaResult.outline.pageBudgetNotes ||
      '',

    sections:
      Array.isArray(
        sashaResult.outline.sections
      )
        ? sashaResult.outline.sections.map(
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
                  section.title ||
                  '',

                description:
                  section.description ||
                  '',

                pageBudget:
                  Number.isFinite(
                    section.pageBudget
                  )
                    ? section.pageBudget
                    : null,

                subsections:
                  Array.isArray(
                    section.subsections
                  )
                    ? section.subsections
                    : []

              };

            }
          )
        : []

  };


  proposal.markModified(
    'outline'
  );

}

/* =================================================
   APPLY WIN STRATEGY UPDATE
================================================= */

if (
  sashaResult.action ===
    'update_win_strategy' &&
  sashaResult.winStrategy &&
  typeof sashaResult.winStrategy ===
    'object'
) {

  proposal.winStrategy = {

    clientPriorities:
      sashaResult.winStrategy.clientPriorities ||
      '',

    relevantOffer:
      sashaResult.winStrategy.relevantOffer ||
      '',

    projectEvidence:
      sashaResult.winStrategy.projectEvidence ||
      '',

    personnelEvidence:
      sashaResult.winStrategy.personnelEvidence ||
      '',

    summary:
      sashaResult.winStrategy.summary ||
      ''

  };

}

/* =================================================
   PREPARE WORK PRODUCT METADATA
================================================= */

let workProduct = {
  type:
    '',

  updated:
    false,

  label:
    '',

  href:
    ''
};


if (
  sashaResult.action ===
    'update_plan'
) {

  workProduct = {
    type:
      'plan',

    updated:
      true,

    label:
      'Proposal Plan',

    href:
      `/plan?pursuit=${proposal._id}`
  };

}


if (
  sashaResult.action ===
    'update_outline'
) {

  workProduct = {
    type:
      'outline',

    updated:
      true,

    label:
      'Proposal Outline',

    href:
      `/plan?pursuit=${proposal._id}`
  };

}


if (
  sashaResult.action ===
    'update_win_strategy'
) {

  workProduct = {
    type:
      'win_strategy',

    updated:
      true,

    label:
      'Win Strategy',

    href:
      `/plan?pursuit=${proposal._id}`
  };

}
/* =================================================
   SAVE CONVERSATION
================================================== */

proposal.planMessages.push(
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

workProduct,

    createdAt:
      new Date()
  }
);


/* =================================================
   SAVE PURSUIT
================================================== */

await proposal.save();


console.log(
  'SASHA PLAN CHAT PURSUIT SAVED',
  {
    elapsedMs:
      Date.now() -
      planChatStartedAt
  }
);


/* =================================================
   RETURN TO PLAN
================================================== */

console.log(
  'SASHA PLAN CHAT COMPLETE',
  {
    action:
      sashaResult.action,

    elapsedMs:
      Date.now() -
      planChatStartedAt
  }
);


return res.redirect(
  `/plan?pursuit=${proposal._id}`
);


  } catch (
    error
  ) {

    console.error(
      'SASHA PLAN CHAT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   REVIEW CHANGE IMPACT
===================================================== */

exports.reviewChangeImpact =
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


    const impactId =
      typeof req.params.impactId ===
        'string'
        ? req.params.impactId.trim()
        : '';


    if (
      !pursuitId ||
      !impactId
    ) {

      return res.redirect(
        '/pursuits'
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
       FIND CHANGE IMPACT
    ================================================== */

    const impact =
      proposal.changeImpacts.id(
        impactId
      );


    if (
      !impact
    ) {

      return res.status(404).send(
        'Change impact not found.'
      );

    }


    if (
      impact.status !==
        'pending_review'
    ) {

      return res.redirect(
        `/plan?pursuit=${proposal._id}`
      );

    }


    /* =================================================
       CURRENT PLAN
    ================================================== */

    const currentPlan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    const tasks =
      Array.isArray(
        proposal.tasks
      )
        ? proposal.tasks
        : [];


    /* =================================================
       CREATE OPENAI CLIENT
    ================================================== */

    const openai =
      sashaAiService.createClient(
        process.env.OPENAI_API_KEY
      );


    /* =================================================
       ASK SASHA FOR PROPOSED REVISIONS
    ================================================== */

    const response =
      await openai.responses.create({

        model:
          'gpt-5-mini',

        reasoning: {
          effort:
            'minimal'
        },

instructions: `
You are Sasha, an AI proposal and pursuit assistant for
technical consulting firms.

A material change has occurred during an active pursuit.

Your job is to review that change against the existing
proposal plan and determine what planning work should be
revised.

The change may involve:

- submission dates
- scope of work
- deliverables
- evaluation criteria
- submission requirements
- mandatory requirements
- client instructions
- procurement requirements
- staffing implications
- technical requirements
- consultation requirements
- schedule requirements
- or another material pursuit issue


IMPORTANT

The existing proposal plan represents work already developed
by the proposal team.

Do not discard or rewrite useful existing planning work
unless the recorded change genuinely requires it.

Preserve existing decisions wherever they remain valid.

Revise only the parts of the proposal plan that are
reasonably affected by the new information.

The proposal manager will review the proposed changes before
they are applied.

Your job in this request is to PROPOSE revisions.

Do not treat those revisions as approved.


CURRENT PURSUIT

Proposal:
${proposal.proposalName || ''}

Client:
${proposal.clientName || ''}

RFP Number:
${proposal.rfpNumber || ''}

Current Submission Deadline:
${
  proposal.submissionDeadline
    ? new Date(
        proposal.submissionDeadline
      ).toISOString()
    : 'Not recorded'
}


RECORDED CHANGE IMPACT

${JSON.stringify(
  {
    changeType:
      impact.changeType,

    previousValue:
      impact.previousValue,

    newValue:
      impact.newValue,

    summary:
      impact.summary,

    affectedAreas:
      impact.affectedAreas
  },
  null,
  2
)}


CURRENT PROPOSAL PLAN

${JSON.stringify(
  currentPlan,
  null,
  2
)}


CURRENT PURSUIT TASKS

${JSON.stringify(
  tasks,
  null,
  2
)}


REVIEW REQUIREMENTS

Consider whether the recorded change requires revisions to:

- proposal schedule
- responsibilities
- internal milestones
- production activities
- review activities
- submission activities
- planning tasks

For a scope or deliverable change, consider whether new work
must be added to the proposal-development process.

For a deadline change, consider whether existing dates,
sequencing, review periods, production activities, or task
due dates should move.

For a submission or compliance change, consider whether new
checks, forms, acknowledgements, production activities, or
submission tasks are required.

For an evaluation change, consider whether proposal effort,
emphasis, sequencing, or review should change.

Do not change something merely because it could be improved.
Change it only when the recorded pursuit change reasonably
affects it.

Return the COMPLETE proposed schedule, milestones, and
production content so that the proposal manager can review
the proposed version against the current plan.

For tasks, return only tasks whose due dates genuinely need
to change.

Return proposed changes only.
`,

        input: [
          {
            role:
              'user',

            content:
              'Review the existing plan and propose the changes needed because of this RFP change.'
          }
        ],

        text: {
          format: {
            type:
              'json_schema',

            name:
              'sasha_change_impact_review',

            strict:
              true,

            schema: {
              type:
                'object',

              additionalProperties:
                false,

              properties: {

                schedule: {
                  type:
                    'string'
                },

                milestones: {
                  type:
                    'string'
                },

                production: {
                  type:
                    'string'
                },

                tasks: {
                  type:
                    'array',

                  items: {
                    type:
                      'object',

                    additionalProperties:
                      false,

                    properties: {

                      taskId: {
                        type:
                          'string'
                      },

                      title: {
                        type:
                          'string'
                      },

                      previousDueDate: {
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

                      proposedDueDate: {
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
                      }

                    },

                    required: [
                      'taskId',
                      'title',
                      'previousDueDate',
                      'proposedDueDate'
                    ]
                  }
                }

              },

              required: [
                'schedule',
                'milestones',
                'production',
                'tasks'
              ]
            }
          }
        },

        max_output_tokens:
          4000
      });


    /* =================================================
       PARSE RESPONSE
    ================================================== */

    const outputText =
      response.output_text
        ? response.output_text.trim()
        : '';


    if (
      !outputText
    ) {

      throw new Error(
        'Sasha returned an empty change-impact review.'
      );

    }


    const proposed =
      JSON.parse(
        outputText
      );


    /* =================================================
       SAVE PROPOSED CHANGES ONLY
    ================================================== */

    impact.proposedChanges.schedule =
      proposed.schedule ||
      '';


    impact.proposedChanges.milestones =
      proposed.milestones ||
      '';


    impact.proposedChanges.production =
      proposed.production ||
      '';


    impact.proposedChanges.tasks =
      Array.isArray(
        proposed.tasks
      )
        ? proposed.tasks.map(
            (
              task
            ) => {

              return {
                taskId:
                  task.taskId ||
                  null,

                title:
                  task.title ||
                  '',

                previousDueDate:
                  task.previousDueDate
                    ? new Date(
                        task.previousDueDate
                      )
                    : null,

                proposedDueDate:
                  task.proposedDueDate
                    ? new Date(
                        task.proposedDueDate
                      )
                    : null
              };

            }
          )
        : [];


    impact.proposedChanges.generatedAt =
      new Date();


    await proposal.save();


    /* =================================================
       RETURN TO PLAN
    ================================================== */

    return res.redirect(
      `/plan?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'REVIEW CHANGE IMPACT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   ACCEPT CHANGE IMPACT
===================================================== */

exports.acceptChangeImpact =
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


    const impactId =
      typeof req.params.impactId ===
        'string'
        ? req.params.impactId.trim()
        : '';


    if (
      !pursuitId ||
      !impactId
    ) {

      return res.redirect(
        '/pursuits'
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
       FIND CHANGE IMPACT
    ================================================== */

    const impact =
      proposal.changeImpacts.id(
        impactId
      );


    if (
      !impact
    ) {

      return res.status(404).send(
        'Change impact not found.'
      );

    }


    if (
      impact.status !==
        'pending_review'
    ) {

      return res.redirect(
        `/plan?pursuit=${proposal._id}`
      );

    }


    /* =================================================
       REQUIRE GENERATED PROPOSAL
    ================================================== */

    if (
      !impact.proposedChanges ||
      !impact.proposedChanges.generatedAt
    ) {

      return res.status(400).send(
        'No proposed plan changes are available to accept.'
      );

    }


    /* =================================================
       APPLY PLAN CHANGES
    ================================================== */

    proposal.plan =
      proposal.plan &&
      typeof proposal.plan ===
        'object'
        ? proposal.plan
        : {};


    if (
      impact.proposedChanges.schedule
    ) {

      proposal.plan.schedule =
        impact.proposedChanges.schedule;

    }


    if (
      impact.proposedChanges.milestones
    ) {

      proposal.plan.milestones =
        impact.proposedChanges.milestones;

    }


    if (
      impact.proposedChanges.production
    ) {

      proposal.plan.production =
        impact.proposedChanges.production;

    }


    proposal.markModified(
      'plan'
    );


    /* =================================================
       APPLY TASK DATE CHANGES
    ================================================== */

    const proposedTasks =
      Array.isArray(
        impact.proposedChanges.tasks
      )
        ? impact.proposedChanges.tasks
        : [];


    for (
      const proposedTask of proposedTasks
    ) {

      if (
        !proposedTask.taskId ||
        !proposedTask.proposedDueDate
      ) {

        continue;

      }


      const task =
        proposal.tasks.id(
          proposedTask.taskId
        );


      if (
        !task
      ) {

        continue;

      }


      task.dueDate =
        proposedTask.proposedDueDate;

    }


    /* =================================================
       MARK IMPACT ACCEPTED
    ================================================== */

    impact.status =
      'accepted';

    impact.reviewedAt =
      new Date();


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    return res.redirect(
      `/plan?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'ACCEPT CHANGE IMPACT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

/* =====================================================
   DISMISS CHANGE IMPACT
===================================================== */

exports.dismissChangeImpact =
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


    const impactId =
      typeof req.params.impactId ===
        'string'
        ? req.params.impactId.trim()
        : '';


    if (
      !pursuitId ||
      !impactId
    ) {

      return res.redirect(
        '/pursuits'
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
       FIND CHANGE IMPACT
    ================================================== */

    const impact =
      proposal.changeImpacts.id(
        impactId
      );


    if (
      !impact
    ) {

      return res.status(404).send(
        'Change impact not found.'
      );

    }


    if (
      impact.status !==
        'pending_review'
    ) {

      return res.redirect(
        `/plan?pursuit=${proposal._id}`
      );

    }


    /* =================================================
       KEEP CURRENT PLAN
    ================================================== */

    impact.status =
      'dismissed';

    impact.reviewedAt =
      new Date();


    /* =================================================
       SAVE PURSUIT
    ================================================== */

    await proposal.save();


    return res.redirect(
      `/plan?pursuit=${proposal._id}`
    );


  } catch (
    error
  ) {

    console.error(
      'DISMISS CHANGE IMPACT FAILED:',
      error
    );


    return next(
      error
    );

  }

};

