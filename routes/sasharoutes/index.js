const express = require(
  'express'
);

const ensureOrganization = require(
  '../../middleware/ensureOrganization'
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
  proposalController.getAnalyzePursuit
);


/* =====================================================
PLAN | WIN STRATEGY
===================================================== */

router.get(
  '/plan',
  ensureOrganization,
  proposalController.getPlanPursuit
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