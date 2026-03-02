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
 * GET /api/submissions/:id/comments
 *
 * Returns all discussion comments for a submission.
 * Returns [] if the submission_comments table hasn't been created yet.
 * Accessible by: the student who submitted, the supervisor of the group, or admin.
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

    if (!userRoles.includes('admin')) {
      const isStudent = submission.student_id === userId;
      let isSupervisor = false;

      if (userRoles.includes('supervisor')) {
        const { data: group } = await supabaseAdmin
          .from('groups')
          .select('supervisor_id')
          .eq('id', submission.group_id)
          .single();
        isSupervisor = group?.supervisor_id === userId;
      }

      if (!isStudent && !isSupervisor) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Fetch comments — no FK join to avoid schema-cache issues with new table
    const { data: comments, error: cError } = await supabaseAdmin
      .from('submission_comments')
      .select('id, content, author_id, author_role, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    // If the table doesn't exist yet (migration not run), return empty list gracefully
    if (cError) {
      if (isTableMissing(cError)) {
        return res.json([]);
      }
      throw cError;
    }

    if (!comments || comments.length === 0) {
      return res.json([]);
    }

    // Look up author names in a single batch query
    const authorIds = [...new Set(comments.map((c) => c.author_id))];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .in('id', authorIds);

    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));

    res.json(
      comments.map((c) => ({
        id: c.id,
        content: c.content,
        authorName: nameMap[c.author_id] ?? 'Unknown',
        authorRole: c.author_role,
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
 * Adds a discussion comment to a submission.
 * Accessible by: the student who submitted, the supervisor of the group, or admin.
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
    let authorRole = null;

    if (userRoles.includes('admin') || userRoles.includes('supervisor')) {
      if (!userRoles.includes('admin')) {
        const { data: group } = await supabaseAdmin
          .from('groups')
          .select('supervisor_id')
          .eq('id', submission.group_id)
          .single();
        if (group?.supervisor_id !== userId) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      authorRole = 'supervisor';
    } else if (submission.student_id === userId) {
      authorRole = 'student';
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: comment, error: cError } = await supabaseAdmin
      .from('submission_comments')
      .insert({
        submission_id: submissionId,
        author_id: userId,
        author_role: authorRole,
        content: content.trim(),
      })
      .select('id, content, author_role, created_at')
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
      authorName: req.user.name,
      authorRole: comment.author_role,
      createdAt: comment.created_at,
    });
  } catch (error) {
    console.error('Error adding submission comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

module.exports = { getComments, addComment };
