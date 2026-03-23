const express    = require('express');
const rateLimit  = require('express-rate-limit');
const router     = express.Router();
const controller = require('../controllers/auth.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { paginate } = require('../middleware/paginate.middleware');
const { submitRegistrationSchema, registrationActionSchema } = require('../schemas/auth.schemas');

// ── Rate limiters ─────────────────────────────────────────────────────────────

// Strict limiter for the public registration form: 5 attempts per 15 min per IP
const registrationLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many registration attempts. Please wait 15 minutes before trying again.' },
});

// Moderate limiter for coordinator/admin actions: 60 per 15 min per IP
const actionLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many requests. Please slow down.' },
});

// ── Routes ────────────────────────────────────────────────────────────────────

// Public — submit a new registration
// Rate-limited + Joi-validated before touching the database
router.post(
  '/submit-registration',
  registrationLimiter,
  validate(submitRegistrationSchema),
  controller.submitRegistration
);

// List registrations — admin sees all, coordinator sees only their course
router.get(
  '/pending-registrations',
  authenticate,
  requireCoordinatorOrAdmin,
  paginate({ defaultLimit: 200, maxLimit: 200 }),
  controller.listRegistrations
);

// Admin: retroactively create missing groups for already-approved students
router.post(
  '/repair-groups',
  actionLimiter,
  authenticate,
  requireAdmin,
  controller.repairGroups
);

// Registration approval/rejection — accessible by coordinator (course-scoped) or admin
router.post(
  '/approve-registration',
  actionLimiter,
  authenticate,
  requireCoordinatorOrAdmin,
  validate(registrationActionSchema),
  idempotency({ ttlHours: 48 }),
  controller.approveRegistration
);

router.post(
  '/reject-registration',
  actionLimiter,
  authenticate,
  requireCoordinatorOrAdmin,
  validate(registrationActionSchema),
  controller.rejectRegistration
);

module.exports = router;
