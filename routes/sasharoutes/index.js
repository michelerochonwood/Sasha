
const express = require('express');

const ensureOrganization = require('../../middleware/ensureOrganization');
const instructionResourceUpload = require('../../middleware/instructionResourceUpload');
const pursuitDocumentUpload = require('../../middleware/pursuitDocumentUpload');

const proposalTemplateUpload = require(
  '../../middleware/proposalTemplateUpload'
);

const { verifyCsrfToken } = require('../../middleware/csrfProtection');

const organizationController = require('../../controllers/organizationController');
const proposalController = require('../../controllers/proposalController');
const analyzeController = require('../../controllers/analyzeController');
const planController = require('../../controllers/planController');
const instructionController = require('../../controllers/instructionController');
const openaiController = require('../../controllers/openaiController');
const writeController = require('../../controllers/writeController');
const outcomeController = require('../../controllers/outcomeController');
const proposalTemplateController = require(
  '../../controllers/proposalTemplateController'
);



const router = express.Router();

/* =====================================================
   GLOBAL HEADER PURSUITS
===================================================== */

router.use(
  proposalController.loadHeaderPursuits
);

/* =====================================================
   HOME
===================================================== */

router.get('/', (req, res) => {
  return res.render('sasha_homepage', {
    layout: 'mainlayout',
    pageTitle: 'Sasha | Proposal Assistant'
  });
});

/* =====================================================
   CREATE A PURSUIT
===================================================== */

router.get(
  '/create_pursuit',
  ensureOrganization,
  proposalController.getCreatePursuit
);

router.post(
  '/create_pursuit/analyze',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  openaiController.analyzePursuit
);

router.post(
  '/create_pursuit',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  proposalController.postCreatePursuit
);

/* =====================================================
   PURSUITS
===================================================== */

router.get(
  '/pursuits',
  ensureOrganization,
  proposalController.getPursuits
);

router.get(
  '/pursuit/:id',
  ensureOrganization,
  proposalController.getPursuitDashboard
);

router.get(
  '/pursuit/:id/activate',
  ensureOrganization,
  proposalController.activatePursuit
);

router.post(
  '/pursuit/:id/documents',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  proposalController.postPursuitDocuments
);

/* =====================================================
   ANALYZE | GO / NO GO
===================================================== */

router.get(
  '/analyze',
  ensureOrganization,
  analyzeController.getAnalyzePursuit
);

router.post(
  '/analyze/decision',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.postGoNoGoDecision
);

router.post(
  '/analyze/effort',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.postEffortLevel
);

router.post(
  '/analyze/chat',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.postAnalyzeChat
);

router.post(
  '/analyze/complete-rfp-analysis',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.completeRfpAnalysis
);

/* =====================================================
   PLAN | WIN STRATEGY
===================================================== */

router.get(
  '/plan',
  ensureOrganization,
  planController.getPlanPursuit
);

router.post(
  '/plan/practice-decision',
  ensureOrganization,
  planController.postPracticeDecision
);

router.post(
  '/plan/supporting-material/remove',
  ensureOrganization,
  planController.removeSupportingMaterial
);

router.post(
  '/plan/chat',
  ensureOrganization,
  verifyCsrfToken,
  planController.postPlanChat
);

router.post(
  '/plan/complete-project-evidence',
  ensureOrganization,
  planController.completeProjectEvidence
);

router.post(
  '/plan/complete-personnel-evidence',
  ensureOrganization,
  planController.completePersonnelEvidence
);

router.post(
  '/plan/complete-proposal-plan',
  ensureOrganization,
  verifyCsrfToken,
  planController.completeProposalPlan
);

router.post(
  '/plan/complete-proposal-outline',
  ensureOrganization,
  verifyCsrfToken,
  planController.completeProposalOutline
);

router.post(
  '/plan/complete-supporting-materials',
  ensureOrganization,
  verifyCsrfToken,
  planController.completeSupportingMaterials
);

/* =====================================================
   PLAN | PRACTICE PAGES
===================================================== */

const practicePages = [
  ['/plan/proposal-kickoff', 'kickoff_view', 'Proposal Kickoff'],
  ['/plan/proposal-schedule', 'proposal_schedule_view', 'Detailed Proposal Schedule'],
  ['/plan/ten-steps', 'ten_steps_view', 'Ten Steps to a Win Theme'],
  ['/plan/methodology', 'methodology_view', 'Rapid Fire Methodology Storyboarding'],
  ['/plan/project-evidence-review', 'project_evidence_review_view', 'Project Experience Evidence Review'],
  ['/plan/personnel-experience-review', 'personnel_experience_review_view', 'Personnel Experience Evidence Review'],
  ['/plan/pricing-review', 'pricing_review_view', 'Pricing Review'],
  ['/plan/proposal-graphics-review', 'proposal_graphics_review_view', 'Proposal Graphics Review'],
  ['/plan/blue-team-review', 'blue_team_review_view', 'Blue Team Review'],
  ['/plan/pink-team-review', 'pink_team_review_view', 'Pink Team Review'],
  ['/plan/red-team-review', 'red_team_review_view', 'Red Team Review'],
  ['/plan/proofreading-process', 'proofreading_process_view', 'Proposal Proofreading Process']
];

practicePages.forEach(([path, view, title]) => {
  router.get(
    path,
    ensureOrganization,
    (req, res) => {
      return res.render(view, {
        layout: 'mainlayout',
        pageTitle: `${title} | Sasha`,
        pursuitId: req.query.pursuit || null
      });
    }
  );
});

/* =====================================================
   PLAN | CHANGE IMPACTS
===================================================== */

router.post(
  '/plan/change-impact/:impactId/review',
  ensureOrganization,
  verifyCsrfToken,
  planController.reviewChangeImpact
);

router.post(
  '/plan/change-impact/:impactId/accept',
  ensureOrganization,
  verifyCsrfToken,
  planController.acceptChangeImpact
);

router.post(
  '/plan/change-impact/:impactId/dismiss',
  ensureOrganization,
  verifyCsrfToken,
  planController.dismissChangeImpact
);

/* =====================================================
   WRITE
===================================================== */

router.get(
  '/write',
  ensureOrganization,
  writeController.getWritePursuit
);

router.post(
  '/write/section',
  ensureOrganization,
  verifyCsrfToken,
  writeController.postWriteSection
);


router.post(
  '/write/chat',
  ensureOrganization,
  verifyCsrfToken,
  writeController.postWriteChat
);


/* =====================================================
   WRITE | PROPOSAL TEMPLATES
===================================================== */

/*
 * Retrieve the active proposal template
 * belonging to the logged-in organization.
 */

router.get(
  '/write/proposal-template',
  ensureOrganization,
  proposalTemplateController.getActiveProposalTemplate
);


/*
 * Upload a new Word proposal template.
 *
 * The controller stores the DOCX in Cloudinary,
 * creates its MongoDB record, and activates it
 * for the organization.
 */

router.post(
  '/write/proposal-template',
  ensureOrganization,
  proposalTemplateUpload,
  verifyCsrfToken,
  proposalTemplateController.postUploadProposalTemplate
);



/* =====================================================
   REVIEW
===================================================== */

router.get(
  '/review',
  ensureOrganization,
  proposalController.getReviewPursuit
);

/* =====================================================
   OUTCOMES
===================================================== */

router.get(
  '/outcomes',
  ensureOrganization,
  outcomeController.getOutcomePursuit
);

router.post(
  '/outcome/final-proposal',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  outcomeController.postFinalProposal
);

router.post(
  '/outcome/result',
  ensureOrganization,
  verifyCsrfToken,
  outcomeController.postOutcomeResult
);

router.post(
  '/outcome/details',
  ensureOrganization,
  verifyCsrfToken,
  outcomeController.postOutcomeDetails
);

router.post(
  '/outcome/chat',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  outcomeController.postOutcomeChat
);

/* =====================================================
   SASHA INSTRUCTIONS
===================================================== */

router.get(
  '/add_instructions',
  ensureOrganization,
  instructionController.getAddInstructions
);

router.post(
  '/add_instructions/analyze',
  ensureOrganization,
  instructionResourceUpload,
  instructionController.analyzeInstruction
);

router.post(
  '/add_instructions',
  ensureOrganization,
  instructionResourceUpload,
  instructionController.postAddInstructions
);

/* =====================================================
   ORGANIZATION AUTHENTICATION
===================================================== */

router.get(
  '/login',
  organizationController.showLogin
);

router.post(
  '/login',
  verifyCsrfToken,
  organizationController.login
);

router.post(
  '/logout',
  verifyCsrfToken,
  organizationController.logout
);

/* =====================================================
   ORGANIZATION SETUP
===================================================== */

router.get(
  '/setup-organization',
  organizationController.showSetupForm
);

router.post(
  '/setup-organization',
  verifyCsrfToken,
  organizationController.createOrganization
);

/* =====================================================
   EXPORT ROUTER
===================================================== */

module.exports = router;
