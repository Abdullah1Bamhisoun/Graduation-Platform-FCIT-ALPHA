const { supabaseAdmin } = require('../config/supabase');

/**
 * Returns true if the Supabase/PostgREST error indicates the table doesn't exist yet.
 * PostgreSQL error code 42P01 = undefined_table.
 */
function isTableMissing(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('relation') ||
    msg.includes('undefined_table')
  );
}

/**
 * Returns true if the requesting user is a committee member assigned to this group
 * (supervisors can serve as committee evaluators for other groups).
 */
async function isCommitteeMemberForGroup(userId, groupId) {
  const { data: schedule } = await supabaseAdmin
    .from('presentation_schedules')
    .select('committee_members')
    .eq('group_id', groupId)
    .maybeSingle();
  return (schedule?.committee_members || []).includes(userId);
}

/**
 * Determine the effective role of the caller relative to a specific group.
 * Returns: 'admin' | 'supervisor' | 'committee' | 'coordinator' | 'student' | null (no access)
 */
async function resolveCallerRole(userId, groupId, userRoles, activeRole, groupRow) {
  if (userRoles.includes('admin')) return 'admin';

  if (activeRole === 'coordinator') return 'coordinator';

  if (userRoles.includes('supervisor') || activeRole === 'supervisor') {
    const isSupervisorOfGroup = groupRow?.supervisor_id === userId;
    if (isSupervisorOfGroup) return 'supervisor';

    // Supervisor acting as committee evaluator for this group?
    const isCommittee = await isCommitteeMemberForGroup(userId, groupId);
    if (isCommittee) return 'committee';

    return null; // supervisor of a different group — no access
  }

  // Check student membership
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('student_id', userId)
    .maybeSingle();

  return membership ? 'student' : null;
}

/**
 * Visibility rules for comments:
 *
 * visibility_scope = 'supervisor_only' (or author_role = 'supervisor' on legacy rows):
 *   → visible to: supervisor of the group, students of the group
 *   → NOT visible to: committee members, coordinators
 *
 * visibility_scope = 'committee_and_above' (or author_role = 'committee'):
 *   → visible to: committee members, coordinator, supervisor, students
 *
 * visibility_scope = 'all' (or student comments):
 *   → visible to all with group access
 */
function canSeeComment(comment, callerRole) {
  const scope = comment.visibility_scope;
  const authorRole = comment.author_role;

  // Determine effective visibility scope
  let effectiveScope = scope;
  if (!effectiveScope || effectiveScope === 'all') {
    // Legacy rows: derive from author_role
    if (authorRole === 'supervisor') effectiveScope = 'supervisor_only';
    else if (authorRole === 'committee') effectiveScope = 'committee_and_above';
    else effectiveScope = 'all';
  }

  if (effectiveScope === 'supervisor_only') {
    return callerRole === 'admin' || callerRole === 'supervisor' || callerRole === 'student';
  }
  if (effectiveScope === 'committee_and_above') {
    return ['admin', 'supervisor', 'committee', 'coordinator', 'student'].includes(callerRole);
  }
  // 'all'
  return true;
}

/**
 * GET /api/submissions/:id/comments
 *
 * Returns discussion comments for a submission, filtered by the caller's role.
 *
 * Visibility rules (same-group only):
 *   - supervisor_only comments: visible to supervisor + students only
 *   - committee_and_above comments: visible to committee + coordinator + supervisor + students
 *   - all: visible to everyone with group access
 */
async function getComments(req, res) {
  try {
    const { id: submissionId } = req.params;

    const { data: submission, error: sError } = await supabaseAdmin
      .from('submissions')
      .select('id, student_id, group_id')
      .eq('id', submissionId)
      .single();

    if (sError || !submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const userId = req.user.id;
    const userRoles = req.user.roles;
    const activeRole = req.user.activeRole;

    // Fetch group and comments in parallel — neither depends on the other
    const [{ data: groupRow }, { data: comments, error: cError }] = await Promise.all([
      supabaseAdmin.from('groups').select('supervisor_id').eq('id', submission.group_id).single(),
      supabaseAdmin
        .from('submission_comments')
        .select('id, content, author_id, author_role, visibility_scope, created_at')
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: true }),
    ]);

    const callerRole = await resolveCallerRole(userId, submission.group_id, userRoles, activeRole, groupRow);

    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (cError) {
      if (isTableMissing(cError)) return res.json([]);
      throw cError;
    }

    if (!comments || comments.length === 0) return res.json([]);

    // Apply per-comment visibility filter
    const visibleComments = comments.filter((c) => canSeeComment(c, callerRole));

    // Look up author names in a single batch query
    const authorIds = [...new Set(visibleComments.map((c) => c.author_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .in('id', authorIds);

    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));

    res.json(
      visibleComments.map((c) => ({
        id: c.id,
        content: c.content,
        authorId: c.author_id,
        authorName: nameMap[c.author_id] ?? 'Unknown',
        authorRole: c.author_role,
        visibilityScope: c.visibility_scope ?? 'all',
        createdAt: c.created_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching submission comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

/**
 * POST /api/submissions/:id/comments
 *
 * Adds a discussion comment.  The visibility_scope is set automatically based on
 * the author's role:
 *   supervisor  → 'supervisor_only'
 *   committee   → 'committee_and_above'
 *   coordinator → 'committee_and_above'
 *   student     → 'all'
 */
async function addComment(req, res) {
  try {
    const { id: submissionId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const { data: submission, error: sError } = await supabaseAdmin
      .from('submissions')
      .select('id, student_id, group_id')
      .eq('id', submissionId)
      .single();

    if (sError || !submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const userId = req.user.id;
    const userRoles = req.user.roles;
    const activeRole = req.user.activeRole;

    const { data: groupRow } = await supabaseAdmin
      .from('groups')
      .select('supervisor_id')
      .eq('id', submission.group_id)
      .single();

    const callerRole = await resolveCallerRole(userId, submission.group_id, userRoles, activeRole, groupRow);

    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Map caller role → author_role stored in DB
    let authorRole;
    let visibilityScope;
    if (callerRole === 'admin' || callerRole === 'supervisor') {
      authorRole = 'supervisor';
      visibilityScope = 'supervisor_only';
    } else if (callerRole === 'committee') {
      authorRole = 'committee';
      visibilityScope = 'committee_and_above';
    } else if (callerRole === 'coordinator') {
      authorRole = 'coordinator';
      visibilityScope = 'committee_and_above';
    } else {
      authorRole = 'student';
      visibilityScope = 'all';
    }

    const { data: comment, error: cError } = await supabaseAdmin
      .from('submission_comments')
      .insert({
        submission_id: submissionId,
        author_id: userId,
        author_role: authorRole,
        content: content.trim(),
        visibility_scope: visibilityScope,
      })
      .select('id, content, author_role, visibility_scope, created_at')
      .single();

    if (cError) {
      if (isTableMissing(cError)) {
        return res.status(503).json({
          error: 'Discussion feature not yet set up. Please run docs/sql/007_submission_comments.sql in Supabase.',
        });
      }
      throw cError;
    }

    res.status(201).json({
      id: comment.id,
      content: comment.content,
      authorId: userId,
      authorName: req.user.name,
      authorRole: comment.author_role,
      visibilityScope: comment.visibility_scope,
      createdAt: comment.created_at,
    });
  } catch (error) {
    console.error('Error adding submission comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

module.exports = { getComments, addComment };
