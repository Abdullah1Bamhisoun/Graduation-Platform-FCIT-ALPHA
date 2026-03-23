const express  = require('express');
const router   = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { paginate } = require('../middleware/paginate.middleware');

// List profiles — admin sees all, coordinator sees only users in their course.
// Capped at 200 rows to prevent full-table scans (increase defaultLimit if needed).
router.get(
  '/',
  authenticate,
  requireCoordinatorOrAdmin,
  paginate({ defaultLimit: 200, maxLimit: 200 }),
  controller.listUsers
);

// Coordinator or Admin: delete a user (coordinators cannot delete admin users)
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteUser);

module.exports = router;
