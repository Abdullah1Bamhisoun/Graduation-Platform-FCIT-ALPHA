const express = require('express');
const router = express.Router();
const controller = require('../controllers/settings.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Public — any client can read the current term (e.g. registration form, dashboards)
router.get('/current-term', controller.getCurrentTerm);

// Admin only — change the current term (may trigger 498→499 migration)
router.put('/current-term', authenticate, requireAdmin, controller.setCurrentTerm);

// Public — any client can read the week config (current week, start day, holidays)
router.get('/week-config', controller.getWeekConfig);

// Admin only — update week config
router.put('/week-config', authenticate, requireAdmin, controller.setWeekConfig);

// Admin only — preview which groups/students will be migrated when advancing to Second Semester
router.get('/migration-preview', authenticate, requireAdmin, controller.getMigrationPreview);

// Coordinator + admin — list all terms that have group data (for term history browser)
router.get('/terms-list', authenticate, requireCoordinatorOrAdmin, controller.getTermsList);

// Coordinator + admin — read-only data (groups, grades, scheme) for a specific term
router.get('/term-data', authenticate, requireCoordinatorOrAdmin, controller.getTermData);

module.exports = router;
