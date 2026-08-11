const express = require(
  'express'
);

const ensureOrganization = require(
  '../../middleware/ensureOrganization'
);

const organizationController = require(
  '../../controllers/organizationController'
);

const proposalController = require(
  '../../controllers/proposalController'
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


router.post(
  '/create_pursuit',
  ensureOrganization,
  proposalController.postCreatePursuit
);




/* =====================================================
   ANALYZE | GO NO GO
===================================================== */

router.get(
  '/analyze',
  ensureOrganization,
  (req, res) => {
    return res.render(
      'sasha_analyze',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Analyze | Sasha'
      }
    );
  }
);


/* =====================================================
   PLAN | WIN STRATEGY
===================================================== */

router.get(
  '/plan',
  ensureOrganization,
  (req, res) => {
    return res.render(
      'sasha_plan',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Plan and Win Strategy | Sasha'
      }
    );
  }
);


/* =====================================================
   WRITE
===================================================== */

router.get(
  '/write',
  ensureOrganization,
  (req, res) => {
    return res.render(
      'sasha_write',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Write | Sasha'
      }
    );
  }
);


/* =====================================================
   REVIEW
===================================================== */

router.get(
  '/review',
  ensureOrganization,
  (req, res) => {
    return res.render(
      'sasha_review',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Review | Sasha'
      }
    );
  }
);


/* =====================================================
   ORGANIZATION AUTHENTICATION
===================================================== */

router.get(
  '/login',
  (req, res) => {
    return res.render(
      'login',
      {
        layout:
          'mainlayout',

        pageTitle:
          'Login | Sasha'
      }
    );
  }
);


/* =====================================================
   EXPORT ROUTER
===================================================== */

module.exports = router;    