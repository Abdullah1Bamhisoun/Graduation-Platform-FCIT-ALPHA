const express = require('express');
const router = express.Router();
const controller = require('../controllers/settings.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Public — any client can read the current term (e.g. registration form, dashboards)
router.get('/current-term', controller.getCurrentTerm);

// Admin only — change the current term (may trigger 498→499 migration)
router.put('/current-term', authenticate, requireAdmin, controller.setCurrentTerm);

module.exports = router;
