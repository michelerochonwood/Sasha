const express = require(
  'express'
);

const ensureOrganization = require(
  '../../middleware/ensureOrganization'
);

const instructionResourceUpload = require(
  '../../middleware/instructionResourceUpload'
);

const planController = require(
  '../../controllers/planController'
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

const instructionController = require(
  '../../controllers/instructionController'
);

const pursuitDocumentUpload = require(
  '../../middleware/pursuitDocumentUpload'
);



const openaiController = require(
  '../../controllers/openaiController'
);
const analyzeController = require(
  '../../controllers/analyzeController'
);

const router = express.Router();


/* =====================================================
HOME
===================================================== */

router.get(
  '/',
  (req, res) => {

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
   ANALYZE PURSUIT MATERIAL
===================================================== */

router.post(
  '/create_pursuit/analyze',
  ensureOrganization,
  pursuitDocumentUpload,
  verifyCsrfToken,
  openaiController.analyzePursuit
);


/* =====================================================
   SAVE PURSUIT
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
ANALYZE | GO NO GO
===================================================== */

router.get(
  '/analyze',
  ensureOrganization,
  analyzeController.getAnalyzePursuit
);

/* =====================================================
   SAVE INSTRUCTION RESOURCE
===================================================== */

router.post(
  '/add_instructions',
  ensureOrganization,
  instructionResourceUpload,
  verifyCsrfToken,
  instructionController.postAddInstructions
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

router.post(
  '/plan/chat',
  ensureOrganization,
  verifyCsrfToken,
  planController.postPlanChat
);
/* =====================================================
WRITE
===================================================== */

router.get(
  '/write',
  ensureOrganization,
  proposalController.getWritePursuit
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
ANALYZE INSTRUCTION RESOURCE
===================================================== */

router.post(
  '/add_instructions/analyze',
  ensureOrganization,
  instructionResourceUpload,
  verifyCsrfToken,
  instructionController.analyzeInstruction
);


/* =====================================================
SAVE INSTRUCTION RESOURCE
===================================================== */

router.post(
  '/add_instructions',
  ensureOrganization,
  instructionController.postAddInstructions
);


/* =====================================================
EXPORT ROUTER
===================================================== */

module.exports = router;