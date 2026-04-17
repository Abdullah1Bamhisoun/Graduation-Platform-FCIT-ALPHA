const { supabaseAdmin } = require('../config/supabase');
const { normalizeCourseCode } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const { buildStudentGradesSummary } = require('../utils/gradesSummary');

/**
 * GET /api/evaluations/groups
 * Supervisor: returns all groups available for committee evaluation,
 * EXCLUDING any group that this supervisor supervises.
 *
 * Rule: A supervisor may not evaluate their own supervised group.
 * If an evaluation_assignments table exists, only officially assigned groups
 * are returned (still excluding the supervisor's own group).
 * Otherwise, all non-supervised groups are returned.
 */
/**
 * Map a group row to the API response shape.
 * scheduleMap: Map<groupId, { scheduled_at: string|null }>
 * Evaluation is active when scheduled_at exists and is in the past (server time).
 * This check is performed on every request — no caching.
 */
function mapGroup(g, scheduleMap) {
  const sched = scheduleMap ? scheduleMap.get(g.id) : null;
  const scheduledAt = sched?.scheduled_at ?? null;
  // Evaluation unlocks only after the presentation time has passed (server time).
  const evaluationActive = scheduledAt !== null && new Date(scheduledAt) <= new Date();

  return {
    id: g.id,
    groupCode: g.group_code ?? null,
    groupNumber: g.group_number,
    projectName: g.project_name,
    courseNumber: g.course_number,
    courseCode: normalizeCourseCode(g.course?.code ?? ''),
    courseId: g.course_id ?? null,
    scheduledAt,
    evaluationActive,
    students: (g.members || []).map((m) => ({ id: m.student?.id ?? '', name: m.student?.name ?? '' })).filter((s) => s.id),
  };
}

/**
 * Fetch presentation scheduled_at for a list of group IDs.
 * Returns a Map<groupId, { scheduled_at }>. Gracefully handles the case
 * where the scheduled_at column has not yet been migrated (returns empty map).
 */
async function fetchScheduleMap(groupIds) {
  if (!groupIds || groupIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('presentation_schedules')
    .select('group_id, scheduled_at')
    .in('group_id', groupIds);

  if (error) {
    // Missing column → migration pending; treat as no schedules
    const isMissing =
      error.code === '42703' ||
      (error.message || '').toLowerCase().includes('does not exist');
    if (isMissing) return new Map();
    throw error;
  }

  return new Map((data || []).map((s) => [s.group_id, { scheduled_at: s.scheduled_at }]));
}

const GROUP_SELECT =
  'id, group_code, group_number, project_name, course_number, course_id, course:courses!course_id(code), members:group_members(student:profiles!student_id(id, name))';

async function getGroupsForEvaluation(req, res) {
  try {
    const supervisorId   = req.user.id;
    const supervisorName = req.user.name ?? '';

    // ── Steps 1 + 2: independent — fetch in parallel ───────────────────────
    const [
      { data: supervisedRows, error: supError },
      { data: allSchedules, error: schedErr },
    ] = await Promise.all([
      supabaseAdmin.from('groups').select('id').eq('supervisor_id', supervisorId),
      supervisorName
        ? supabaseAdmin.from('presentation_schedules').select('group_id, committee_members, scheduled_at')
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (supError) throw supError;

    if (schedErr) {
      const isMissing =
        schedErr.code === '42P01' ||
        schedErr.code === '42703' ||
        (schedErr.message || '').toLowerCase().includes('does not exist');
      if (isMissing) return res.json({ groups: [], assignmentMode: true });
      throw schedErr;
    }

    const supervisedGroupIds = (supervisedRows || []).map((g) => g.id);

    // Build schedule map from parallel result
    const scheduleMap = new Map((allSchedules || []).map((s) => [s.group_id, { scheduled_at: s.scheduled_at }]));

    // Filter to groups where this supervisor is a committee member
    const assignedGroupIds = (allSchedules || [])
      .filter((s) => Array.isArray(s.committee_members) && s.committee_members.includes(supervisorName))
      .map((s) => s.group_id)
      .filter((id) => !supervisedGroupIds.includes(id));

    if (assignedGroupIds.length === 0) {
      return res.json({ groups: [], assignmentMode: true });
    }

    // ── Step 3: fetch assigned group details ────────────────────────────────
    const { data: assignedGroups, error: agError } = await supabaseAdmin
      .from('groups')
      .select(GROUP_SELECT)
      .in('id', assignedGroupIds)
      .order('group_number', { ascending: true });

    if (agError) throw agError;

    return res.json({
      groups: (assignedGroups || []).map((g) => mapGroup(g, scheduleMap)),
      assignmentMode: true,
    });
  } catch (error) {
    console.error('Error fetching evaluation groups:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation groups' });
  }
}

// ─── POST /api/evaluations/scores ─────────────────────────────────────────────

/**
 * Save supervisor or committee rubric scores for a group.
 *
 * Body: {
 *   groupId:        string,
 *   evaluationType: 'supervisor' | 'committee',
 *   scores: [{ criterionKey: string, score: number, comment?: string }]
 * }
 *
 * Upserts into supervisor_rubric_scores or committee_rubric_scores.
 * Trigger 4: fires announcement + per-student notifications after saving.
 */
async function saveScores(req, res) {
  try {
    const { groupId, evaluationType, scores } = req.body;

    if (!groupId || !evaluationType || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'groupId, evaluationType, and scores[] are required' });
    }

    if (!['supervisor', 'committee'].includes(evaluationType)) {
      return res.status(400).json({ error: 'evaluationType must be supervisor or committee' });
    }

    const evaluatorId = req.user.id;
    const isAdmin     = (req.user.roles || []).includes('admin');

    // Coordinators are not evaluators
    if (req.user.activeRole === 'coordinator' && !isAdmin) {
      return res.status(403).json({ error: 'Coordinators cannot submit evaluation scores' });
    }

    // Resolve group + course
    const { data: group, error: gErr } = await supabaseAdmin
      .from('groups')
      .select('id, course_id, supervisor_id, group_number')
      .eq('id', groupId)
      .single();

    if (gErr || !group) return res.status(404).json({ error: 'Group not found' });

    // Supervisor can only evaluate groups they supervise; committee evaluators are validated via presentation_schedules
    if (!isAdmin) {
      if (evaluationType === 'supervisor' && group.supervisor_id !== evaluatorId) {
        return res.status(403).json({ error: 'You are not the supervisor of this group' });
      }
      if (evaluationType === 'committee') {
        const { data: schedule } = await supabaseAdmin
          .from('presentation_schedules')
          .select('committee_members')
          .eq('group_id', groupId)
          .maybeSingle();

        const memberName = req.user.name ?? '';
        const isCommittee = Array.isArray(schedule?.committee_members) && schedule.committee_members.includes(memberName);
        if (!isCommittee) {
          return res.status(403).json({ error: 'You are not assigned as a committee member for this group' });
        }
      }
    }

    const table = evaluationType === 'supervisor' ? 'supervisor_rubric_scores' : 'committee_rubric_scores';

    // Upsert each score row. Schema assumption: (group_id, evaluator_id, criterion_key) is unique.
    const rows = scores.map((s) => ({
      group_id:      groupId,
      evaluator_id:  evaluatorId,
      criterion_key: s.criterionKey,
      score:         s.score,
      comment:       s.comment ?? null,
      course_id:     group.course_id ?? null,
    }));

    // Conflict key depends on the table; committee table has an extra course_id column in its unique constraint
    const conflictKey = evaluationType === 'committee'
      ? 'group_id,course_id,evaluator_id,criterion_key'
      : 'student_id,group_id,course_id,criterion_key';

    const { error: upsertErr } = await supabaseAdmin
      .from(table)
      .upsert(rows, { onConflict: conflictKey, ignoreDuplicates: false });

    if (upsertErr) {
      // If the table or column doesn't exist, surface a clear error
      console.error('[evaluations] saveScores upsert error:', upsertErr.message);
      return res.status(500).json({ error: `Failed to save scores: ${upsertErr.message}` });
    }

    res.json({ success: true });

    // ── Trigger 4: notify group students of evaluation completion ─────────────
    ;(async () => {
      try {
        const members  = await notificationService.getGroupMembers(groupId);
        const courseId = group.course_id ?? null;
        const studentIds = members.map((m) => m.id);
        if (studentIds.length === 0) return;

        const evaluatorLabel = evaluationType === 'supervisor' ? 'Supervisor' : 'Committee';
        const today = new Date().toISOString().slice(0, 10);

        await Promise.all([
          notificationService.createAnnouncement({
            title:       `Your Project Has Been Evaluated`,
            content:     `${evaluatorLabel} evaluation scores have been submitted for Group ${group.group_number ?? groupId}.`,
            targetRoles: ['student'],
            courseId,
            authorId:    evaluatorId,
          }),
          notificationService.createUserNotifications(studentIds, {
            type:    'grade',
            title:   `${evaluatorLabel} Evaluation Complete`,
            message: `Your ${evaluatorLabel.toLowerCase()} has submitted evaluation scores for your group.`,
            link:    '/student/milestones',
          }),
          notificationService.createCalendarEvent({
            title:   `${evaluatorLabel} Evaluation Submitted — Group ${group.group_number ?? ''}`,
            date:    today,
            type:    'meeting',
            courseId,
          }),
        ]);
      } catch (e) {
        console.error('[evaluations] Trigger-4 notification error:', e.message);
      }
    })();
  } catch (error) {
    console.error('Error saving evaluation scores:', error);
    res.status(500).json({ error: 'Failed to save evaluation scores' });
  }
}

// ─── POST /api/evaluations/committee-evaluation ───────────────────────────────
/**
 * Save or submit a committee evaluation (rubric scores + comment + optional file).
 *
 * Body: {
 *   groupId:          string,
 *   scores:           [{ criterionKey: string, score: number }],
 *   comment?:         string,
 *   commentFilePath?: string,   // Supabase Storage path (uploaded by client first)
 *   commentFileName?: string,   // original filename shown to students
 *   submissionStatus: 'draft' | 'submitted'
 * }
 *
 * - Upserts per-criterion scores into committee_rubric_scores.
 * - Upserts a single summary row into committee_evaluations
 *   (one row per evaluator per group — student_id is set to null).
 * - On final submission fires announcement + per-student notifications.
 */
async function submitCommitteeEvaluation(req, res) {
  try {
    const {
      groupId,
      scores,
      comment,
      commentFilePath,
      commentFileName,
      submissionStatus = 'draft',
    } = req.body;

    if (!groupId || !Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'groupId and scores[] are required' });
    }
    if (!['draft', 'submitted'].includes(submissionStatus)) {
      return res.status(400).json({ error: 'submissionStatus must be draft or submitted' });
    }

    const evaluatorId = req.user.id;
    const isAdmin     = (req.user.roles || []).includes('admin');

    // Verify this evaluator is assigned to the group as a committee member
    if (!isAdmin) {
      const { data: schedule } = await supabaseAdmin
        .from('presentation_schedules')
        .select('committee_members')
        .eq('group_id', groupId)
        .maybeSingle();

      const memberName  = req.user.name ?? '';
      const isCommittee =
        Array.isArray(schedule?.committee_members) &&
        schedule.committee_members.includes(memberName);

      if (!isCommittee) {
        return res.status(403).json({ error: 'You are not assigned as a committee member for this group' });
      }
    }

    // Resolve group details
    const { data: group, error: gErr } = await supabaseAdmin
      .from('groups')
      .select('id, course_id, group_number, group_code, project_name, course:courses!course_id(code, name)')
      .eq('id', groupId)
      .single();

    if (gErr || !group) return res.status(404).json({ error: 'Group not found' });

    // ── 1. Upsert per-criterion scores into committee_rubric_scores ──────────
    const rubricRows = scores.map((s) => ({
      group_id:          groupId,
      evaluator_id:      evaluatorId,
      criterion_key:     s.criterionKey,
      score:             s.score,
      course_id:         group.course_id ?? null,
      submission_status: submissionStatus,
    }));

    // Upsert each criterion score individually to avoid onConflict key mismatches
    for (const row of rubricRows) {
      const { data: updatedRows, error: rUpdateErr } = await supabaseAdmin
        .from('committee_rubric_scores')
        .update({ score: row.score, submission_status: row.submission_status })
        .eq('group_id',      row.group_id)
        .eq('evaluator_id',  row.evaluator_id)
        .eq('criterion_key', row.criterion_key)
        .select('id');

      if (rUpdateErr) {
        console.error('[evaluations] committee_rubric_scores update error:', rUpdateErr.message);
        return res.status(500).json({ error: `Failed to save rubric scores: ${rUpdateErr.message}` });
      }

      if (!updatedRows || updatedRows.length === 0) {
        const { error: rInsertErr } = await supabaseAdmin
          .from('committee_rubric_scores')
          .insert(row);

        if (rInsertErr) {
          console.error('[evaluations] committee_rubric_scores insert error:', rInsertErr.message);
          return res.status(500).json({ error: `Failed to save rubric scores: ${rInsertErr.message}` });
        }
      }
    }

    // ── 2. Compute aggregate score ───────────────────────────────────────────
    const totalScore = scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
    const maxScore   = 40;

    // ── 3. Upsert summary into committee_evaluations ─────────────────────────
    const evaluationRow = {
      group_id:          groupId,
      course_id:         group.course_id ?? null,
      evaluator_id:      evaluatorId,
      score:             totalScore,
      max_score:         maxScore,
      comment:           comment ?? null,
      comment_file_url:  commentFilePath  ?? null,
      comment_file_name: commentFileName ?? null,
      uploaded_at:       commentFilePath  ? new Date().toISOString() : null,
      submission_status: submissionStatus,
    };

    // Manual upsert: try UPDATE first; if nothing matched, INSERT.
    // This avoids dependence on the exact unique-constraint column list.
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('committee_evaluations')
      .update(evaluationRow)
      .eq('group_id',      groupId)
      .eq('evaluator_id',  evaluatorId)
      .select('id');

    if (updateErr) {
      console.error('[evaluations] committee_evaluations update error:', updateErr.message);
      return res.status(500).json({ error: `Failed to save evaluation: ${updateErr.message}` });
    }

    if (!updated || updated.length === 0) {
      // No existing row — insert a fresh one
      const { error: insertErr } = await supabaseAdmin
        .from('committee_evaluations')
        .insert(evaluationRow);

      if (insertErr) {
        console.error('[evaluations] committee_evaluations insert error:', insertErr.message);
        return res.status(500).json({ error: `Failed to save evaluation: ${insertErr.message}` });
      }
    }

    res.json({ success: true });

    // ── 4. Notifications on final submission ─────────────────────────────────
    if (submissionStatus === 'submitted') {
      ;(async () => {
        try {
          const [members, supervisor] = await Promise.all([
            notificationService.getGroupMembers(groupId),
            notificationService.getSupervisorOfGroup(groupId),
          ]);
          const courseId   = group.course_id ?? null;
          const studentIds = members.map((m) => m.id);
          if (studentIds.length === 0 && !supervisor) return;

          const courseCode    = normalizeCourseCode(group.course?.code ?? '');
          const courseName    = group.course?.name ?? courseCode;
          const projectName   = group.project_name ?? '';
          const groupLabel    = group.group_code ?? `Group ${group.group_number ?? groupId}`;
          const projectLine   = projectName ? `\nProject: ${projectName}` : '';

          const announcementContent = [
            `Committee evaluation scores have been submitted for ${groupLabel}.`,
            `Course: ${courseName || courseCode}${projectLine}`,
            'Students can now view their grade and download feedback from My Grades.',
          ].join('\n');

          const notificationRecipients = [
            ...studentIds,
            ...(supervisor ? [supervisor.id] : []),
          ];

          await Promise.all([
            // Announcement scoped to this specific group — visible only to its
            // students and the group's supervisor (requires migration 006).
            notificationService.createAnnouncement({
              title:       'Committee Evaluation Released',
              content:     announcementContent,
              targetRoles: ['student', 'supervisor'],
              courseId,
              groupId,
              authorId:    evaluatorId,
            }),
            // Bell-icon notification for all group members + supervisor
            notificationService.createUserNotifications(notificationRecipients, {
              type:    'grade',
              title:   'Committee Evaluation Complete',
              message: `The committee evaluation for ${groupLabel} has been published. Students can view their grade and download feedback from My Grades.`,
              link:    '/student/grades',
            }),
          ]);
          // ── Grades summary email to each student ──────────────────────────
          const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, email, name')
            .in('id', studentIds);

          for (const profile of profiles || []) {
            if (!profile.email) continue;
            try {
              const summary = await buildStudentGradesSummary(profile.id, groupId);
              if (!summary) continue;
              await emailService.sendAllGrades(profile.email, {
                courseName:  summary.courseCode || courseCode,
                studentName: profile.name || 'Student',
                trigger:     'Examination Committee Evaluation Submitted',
                components:  summary.componentList,
                totalScore:  summary.totalScore,
                totalMax:    summary.totalMax,
              });
            } catch (mailErr) {
              console.error('[evaluations] grades summary email failed for', profile.email, mailErr.message);
            }
          }
        } catch (e) {
          console.error('[evaluations] committee submit notification error:', e.message);
        }
      })();
    }
  } catch (error) {
    console.error('Error submitting committee evaluation:', error);
    res.status(500).json({ error: 'Failed to submit committee evaluation' });
  }
}

// ─── POST /api/evaluations/milestone-feedback ────────────────────────────────
/**
 * Save committee member feedback for a specific milestone submission.
 * Uses supabaseAdmin to bypass RLS — the user's JWT is validated by authenticate().
 *
 * Body: { groupId, courseId, milestoneId, comment }
 */
async function saveMilestoneFeedback(req, res) {
  try {
    const evaluatorId = req.user.id;
    const { groupId, courseId, milestoneId, comment } = req.body;

    if (!groupId || !milestoneId || !comment?.trim()) {
      return res.status(400).json({ error: 'groupId, milestoneId and comment are required' });
    }

    // Try UPDATE first; if no row exists, INSERT
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('committee_milestone_feedback')
      .update({ comment: comment.trim() })
      .eq('group_id',     groupId)
      .eq('course_id',    courseId ?? null)
      .eq('milestone_id', milestoneId)
      .eq('evaluator_id', evaluatorId)
      .select('id');

    if (updateErr) {
      return res.status(500).json({ error: updateErr.message });
    }

    if (!updated || updated.length === 0) {
      const { error: insertErr } = await supabaseAdmin
        .from('committee_milestone_feedback')
        .insert({
          group_id:     groupId,
          course_id:    courseId ?? null,
          milestone_id: milestoneId,
          evaluator_id: evaluatorId,
          comment:      comment.trim(),
          created_at:   new Date().toISOString(),
        });
      if (insertErr) {
        return res.status(500).json({ error: insertErr.message });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving milestone feedback:', error);
    res.status(500).json({ error: 'Failed to save milestone feedback' });
  }
}

// ─── POST /api/evaluations/upload-feedback-file ──────────────────────────────
/**
 * Upload a committee feedback file to Supabase Storage using the service role key,
 * bypassing bucket RLS. Returns the stored file path.
 *
 * Expects multipart/form-data with field "file".
 * Query params: groupId, evaluatorId (optional — falls back to req.user.id)
 */
async function uploadFeedbackFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const groupId     = req.body.groupId || req.query.groupId;
    const evaluatorId = req.body.evaluatorId || req.query.evaluatorId || req.user.id;

    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const timestamp = Date.now();
    const safeName  = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath  = `committee-feedback/${groupId}/${evaluatorId}/${timestamp}-${safeName}`;
    const bucket    = 'File Upload';

    const { error: uploadErr } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadErr) {
      console.error('[evaluations] storage upload error:', uploadErr.message);
      return res.status(500).json({ error: uploadErr.message });
    }

    res.json({ filePath, fileName: req.file.originalname });
  } catch (error) {
    console.error('Error uploading feedback file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}

module.exports = { getGroupsForEvaluation, saveScores, submitCommitteeEvaluation, saveMilestoneFeedback, uploadFeedbackFile };
