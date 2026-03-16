const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const {
  getGroupFiles,
  createGroupFile,
  getPreviousCommitteeFeedback,
} = require('../controllers/groupFiles.controller');

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/groups/:groupId/files
 * Returns role-filtered files for the group.
 * Accessible by: admin, supervisor (own or committee-assigned group), coordinator, student (own group)
 */
router.get(
  '/:groupId/files',
  requireRole(['admin', 'supervisor', 'coordinator', 'student']),
  getGroupFiles
);

/**
 * POST /api/groups/:groupId/files
 * Register a file upload (metadata only — actual upload done via Supabase Storage).
 * Accessible by: admin, supervisor, coordinator, student
 */
router.post(
  '/:groupId/files',
  requireRole(['admin', 'supervisor', 'coordinator', 'student']),
  createGroupFile
);

/**
 * GET /api/groups/:groupId/previous-committee-feedback
 * For CPIS-499 groups: returns read-only committee feedback from the CPIS-498 predecessor group.
 * Accessible by: admin, supervisor, coordinator, student
 */
router.get(
  '/:groupId/previous-committee-feedback',
  requireRole(['admin', 'supervisor', 'coordinator', 'student']),
  getPreviousCommitteeFeedback
);

module.exports = router;
