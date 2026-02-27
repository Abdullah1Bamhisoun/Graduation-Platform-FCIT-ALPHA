const express = require('express');
const router = express.Router();
const controller = require('../controllers/grading.controller');
const { authenticate } = require('../middleware/auth.middleware');

/**
 * Grading Scheme Routes
 *
 * GET /api/grading/scheme
 *   All authenticated roles: read the live grading scheme.
 *   The response includes a `readOnly` flag so each role knows whether it can edit.
 *   Coordinator-only write operations are enforced via:
 *     1. Route-level: the GradeSchemeEditor page is protected by ProtectedRoute(['coordinator','admin'])
 *     2. DB-level: Supabase RLS policies reject writes from non-coordinator sessions
 */
router.get('/scheme', authenticate, controller.getGradingScheme);

module.exports = router;
