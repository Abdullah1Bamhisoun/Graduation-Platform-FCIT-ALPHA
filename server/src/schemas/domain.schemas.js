/**
 * Joi validation schemas for domain endpoints.
 * Used by validate() middleware — see middleware/validate.middleware.js
 */
const Joi = require('joi');

// ── Announcements ─────────────────────────────────────────────────────────────

const VALID_ROLES = ['student', 'supervisor', 'coordinator', 'admin'];

const createAnnouncementSchema = Joi.object({
  title:       Joi.string().min(1).max(200).trim().required(),
  content:     Joi.string().min(1).max(5000).trim().required(),
  targetRoles: Joi.array()
    .items(Joi.string().valid(...VALID_ROLES))
    .min(1)
    .required(),
  expiresAt: Joi.string().isoDate().allow(null, '').optional(),
  groupId:   Joi.string().uuid().allow(null, '').optional(),
});

const updateAnnouncementSchema = Joi.object({
  title:       Joi.string().min(1).max(200).trim().optional(),
  content:     Joi.string().min(1).max(5000).trim().optional(),
  targetRoles: Joi.array()
    .items(Joi.string().valid(...VALID_ROLES))
    .min(1)
    .optional(),
  expiresAt: Joi.string().isoDate().allow(null, '').optional(),
}).min(1); // at least one field required for update

// ── Milestones ────────────────────────────────────────────────────────────────

const MILESTONE_TYPES      = ['chapter', 'report', 'presentation', 'other'];
const ALLOWED_FILE_TYPES   = ['pdf', 'docx', 'pptx', 'xlsx', 'zip'];

const createMilestoneSchema = Joi.object({
  name:                   Joi.string().min(1).max(200).trim().required(),
  type:                   Joi.string().valid(...MILESTONE_TYPES).default('chapter'),
  courseId:               Joi.string().uuid().required(),
  openDate:               Joi.string().isoDate().required(),
  dueDate:                Joi.string().isoDate().required(),
  visible:                Joi.boolean().default(true),
  allowLateSubmission:    Joi.boolean().default(false),
  requireJustification:   Joi.boolean().default(false),
  description:            Joi.string().max(2000).trim().allow('', null).optional(),
  gradingCriterionId:     Joi.string().uuid().allow(null, '').optional(),
  includeInCommitteeEval: Joi.boolean().default(false),
  allowedFileType:        Joi.string().valid(...ALLOWED_FILE_TYPES).allow(null, '').optional(),
});

const updateMilestoneSchema = Joi.object({
  name:                   Joi.string().min(1).max(200).trim().optional(),
  type:                   Joi.string().valid(...MILESTONE_TYPES).optional(),
  openDate:               Joi.string().isoDate().optional(),
  closeDate:              Joi.string().isoDate().optional(), // alias for dueDate used by config form
  dueDate:                Joi.string().isoDate().optional(),
  visible:                Joi.boolean().optional(),
  allowLateSubmission:    Joi.boolean().optional(),
  requireJustification:   Joi.boolean().optional(),
  description:            Joi.string().max(2000).trim().allow('', null).optional(),
  gradingCriterionId:     Joi.string().uuid().allow(null, '').optional(),
  includeInCommitteeEval: Joi.boolean().optional(),
  allowedFileType:        Joi.string().valid(...ALLOWED_FILE_TYPES).allow(null, '').optional(),
});

// ── Submissions ───────────────────────────────────────────────────────────────

const createSubmissionSchema = Joi.object({
  milestoneId: Joi.string().uuid().required(),
  studentId:   Joi.string().uuid().required(),
  groupId:     Joi.string().uuid().required(),
  fileName:    Joi.string().min(1).max(255).trim().required(),
  fileSize:    Joi.number().integer().positive().max(50 * 1024 * 1024).required(), // max 50 MB
  filePath:    Joi.string().min(1).max(1000).trim().required(),
  notes:       Joi.string().max(2000).trim().allow('', null).optional(),
});

const createSubmissionVersionSchema = Joi.object({
  version:  Joi.number().integer().positive().required(),
  fileName: Joi.string().min(1).max(255).trim().required(),
  fileSize: Joi.number().integer().positive().max(50 * 1024 * 1024).required(),
  filePath: Joi.string().min(1).max(1000).trim().required(),
  notes:    Joi.string().max(2000).trim().allow('', null).optional(),
});

const updateSubmissionApprovalSchema = Joi.object({
  action:   Joi.string().valid('approve', 'request_changes').required(),
  feedback: Joi.string().max(3000).trim().allow('', null).optional(),
});

// ── Supervisor Evaluation ─────────────────────────────────────────────────────

const supervisorEvaluationSchema = Joi.object({
  submissionStatus: Joi.string()
    .valid('draft', 'submitted')
    .default('submitted'),
  // evaluations: one entry per student, scores is a key→value map of criterion → rawScore
  evaluations: Joi.array()
    .items(
      Joi.object({
        studentId: Joi.string().uuid().required(),
        scores:    Joi.object()
          .pattern(Joi.string().min(1).max(100), Joi.number().integer().min(1).max(5))
          .required(),
        comment:   Joi.string().max(3000).trim().allow('', null).optional(),
      })
    )
    .min(1)
    .required(),
});

// ── Coordinator Evaluation ────────────────────────────────────────────────────

const coordinatorEvaluationSchema = Joi.object({
  submissionStatus: Joi.string()
    .valid('draft', 'submitted')
    .default('submitted'),
  courseType: Joi.string().valid('498', '499').optional(), // also accepted in query
  comment:    Joi.string().max(3000).trim().allow('', null).optional(),
  evaluations: Joi.array()
    .items(
      Joi.object({
        criterionId:  Joi.string().uuid().optional(),
        criterionKey: Joi.string().min(1).max(100).required(),
        rawScore:     Joi.number().integer().min(1).max(5).required(),
      })
    )
    .min(1)
    .required(),
});

// ── Group File Registration ────────────────────────────────────────────────────

const createGroupFileSchema = Joi.object({
  fileName:    Joi.string().min(1).max(255).trim().required(),
  fileSize:    Joi.number().integer().positive().max(50 * 1024 * 1024).required(),
  filePath:    Joi.string().min(1).max(1000).trim().required(),
  fileType:    Joi.string().max(50).trim().allow('', null).optional(),
  milestoneId: Joi.string().uuid().allow(null, '').optional(),
  visibility:  Joi.string()
    .valid('all', 'supervisor_only', 'student_only', 'coordinator_only')
    .default('all'),
});

// ── Submission Comment ────────────────────────────────────────────────────────

const addCommentSchema = Joi.object({
  content:  Joi.string().min(1).max(3000).trim().required(),
  isPrivate: Joi.boolean().default(false),
});

// ── Meetings ──────────────────────────────────────────────────────────────────

const createMeetingSchema = Joi.object({
  title:      Joi.string().min(1).max(200).trim().required(),
  meeting_url: Joi.string().uri().max(2000).required(),
  date_time:  Joi.string().isoDate().required(),
  group_id:   Joi.string().uuid().required(),
  notes:      Joi.string().max(2000).trim().allow('', null).optional(),
});

const updateMeetingSchema = Joi.object({
  title:      Joi.string().min(1).max(200).trim().optional(),
  meeting_url: Joi.string().uri().max(2000).optional(),
  date_time:  Joi.string().isoDate().optional(),
  notes:      Joi.string().max(2000).trim().allow('', null).optional(),
}).min(1);

module.exports = {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  createMilestoneSchema,
  updateMilestoneSchema,
  createSubmissionSchema,
  createSubmissionVersionSchema,
  updateSubmissionApprovalSchema,
  supervisorEvaluationSchema,
  coordinatorEvaluationSchema,
  createGroupFileSchema,
  addCommentSchema,
  createMeetingSchema,
  updateMeetingSchema,
};
