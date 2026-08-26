const express = require(
  'express'
);


const ensureOrganization = require(
  '../../middleware/ensureOrganization'
);


const instructionResourceUpload = require(
  '../../middleware/instructionResourceUpload'
);


const pursuitDocumentUpload = require(
  '../../middleware/pursuitDocumentUpload'
);


const {
  verifyCsrfToken
} = require(
  '../../middleware/csrfProtection'
);


const organizationController = require(
  '../../controllers/organizationController'
);


const proposalController = require(
  '../../controllers/proposalController'
);


const analyzeController = require(
  '../../controllers/analyzeController'
);


const planController = require(
  '../../controllers/planController'
);


const instructionController = require(
  '../../controllers/instructionController'
);


const openaiController = require(
  '../../controllers/openaiController'
);


const writeController = require(
  '../../controllers/writeController'
);


const router =
  express.Router();


/* =====================================================
   HOME
===================================================== */

router.get(
  '/',
  (
    req,
    res
  ) => {

    return res.render(
      'sasha_homepage',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Sasha | Proposal Assistant'
      }
    );

  }
);


/* =====================================================
   CREATE A PURSUIT
===================================================== */

router.get(
  '/create_pursuit',
  ensureOrganization,
  proposalController.getCreatePursuit
);


/* =====================================================
   ANALYZE PURSUIT MATERIAL DURING CREATION
===================================================== */

router.post(
  '/create_pursuit/analyze',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  openaiController.analyzePursuit
);


/* =====================================================
   SAVE NEW PURSUIT
===================================================== */

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


/* =====================================================
   PURSUIT DASHBOARD
===================================================== */

router.get(
  '/pursuit/:id',
  ensureOrganization,
  proposalController.getPursuitDashboard
);


/* =====================================================
   ADD DOCUMENTS TO EXISTING PURSUIT
===================================================== */

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


/* =====================================================
   RECORD GO / NO GO DECISION
===================================================== */

router.post(
  '/analyze/decision',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.postGoNoGoDecision
);


/* =====================================================
   RECORD EFFORT LEVEL
===================================================== */

router.post(
  '/analyze/effort',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.postEffortLevel
);


/* =====================================================
   ANALYZE PURSUIT CHAT
===================================================== */

router.post(
  '/analyze/chat',
  ensureOrganization,
  verifyCsrfToken,
  analyzeController.postAnalyzeChat
);


/* =====================================================
   PLAN | WIN STRATEGY
===================================================== */

router.get(
  '/plan',
  ensureOrganization,
  planController.getPlanPursuit
);


/* =====================================================
   PLAN | WIN STRATEGY CHAT
===================================================== */

router.post(
  '/plan/chat',
  ensureOrganization,
  verifyCsrfToken,
  planController.postPlanChat
);


/* =====================================================
   REVIEW PLAN CHANGE IMPACT
===================================================== */

router.post(
  '/plan/change-impact/:impactId/review',
  ensureOrganization,
  verifyCsrfToken,
  planController.reviewChangeImpact
);


/* =====================================================
   ACCEPT PLAN CHANGE IMPACT
===================================================== */

router.post(
  '/plan/change-impact/:impactId/accept',
  ensureOrganization,
  verifyCsrfToken,
  planController.acceptChangeImpact
);


/* =====================================================
   DISMISS PLAN CHANGE IMPACT
===================================================== */

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


/* =====================================================
   REVIEW
===================================================== */

router.get(
  '/review',
  ensureOrganization,
  proposalController.getReviewPursuit
);


/* =====================================================
   SASHA INSTRUCTIONS
===================================================== */

router.get(
  '/add_instructions',
  ensureOrganization,
  instructionController.getAddInstructions
);


/* =====================================================
   ANALYZE INSTRUCTION RESOURCE
===================================================== */

router.post(
  '/add_instructions/analyze',
  ensureOrganization,
  instructionResourceUpload,
  instructionController.analyzeInstruction
);


/* =====================================================
   SAVE INSTRUCTION RESOURCE
===================================================== */

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

module.exports =
  router;