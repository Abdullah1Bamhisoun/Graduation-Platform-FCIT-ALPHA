const express  = require('express');
const multer   = require('multer');
const router   = express.Router();
const controller = require('../controllers/evaluations.controller');

const { authenticate, requireSupervisorOrAdmin } = require('../middleware/auth.middleware');

// Memory storage — file bytes are passed directly to Supabase Storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/**
 * GET /api/evaluations/groups
 * Supervisor: returns groups they can evaluate (excludes their own supervised group).
 * If evaluation_assignments exist, only officially assigned groups are returned.
 */
router.get('/groups', authenticate, requireSupervisorOrAdmin, controller.getGroupsForEvaluation);

/**
 * POST /api/evaluations/scores
 * Supervisor or committee member: submit rubric scores for a group.
 * Fires Trigger 4: auto-announcement + per-student notifications on save.
 */
router.post('/scores', authenticate, requireSupervisorOrAdmin, controller.saveScores);

/**
 * POST /api/evaluations/committee-evaluation
 * Committee member: save or submit committee evaluation with optional feedback file.
 * Saves criterion scores + aggregate score + comment + file info.
 * On submissionStatus='submitted' fires student notifications.
 */
router.post('/committee-evaluation', authenticate, requireSupervisorOrAdmin, controller.submitCommitteeEvaluation);

/**
 * POST /api/evaluations/milestone-feedback
 * Committee member: save feedback comment for a milestone submission.
 * Uses supabaseAdmin to avoid RLS on committee_milestone_feedback.
 */
router.post('/milestone-feedback', authenticate, requireSupervisorOrAdmin, controller.saveMilestoneFeedback);

/**
 * POST /api/evaluations/upload-feedback-file
 * Upload committee feedback file via supabaseAdmin — bypasses storage bucket RLS.
 */
router.post('/upload-feedback-file', authenticate, requireSupervisorOrAdmin, upload.single('file'), controller.uploadFeedbackFile);

module.exports = router;
