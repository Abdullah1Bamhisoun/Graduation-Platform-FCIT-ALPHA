const { supabaseAdmin } = require('../config/supabase');

/**
 * Returns true when a Supabase error means the table doesn't exist yet.
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
 * Resolves the group associated with a submission document path.
 * document_id format: "submissions/{studentProfileId}/..."
 * Returns { groupId, supervisorId, courseId } or null.
 */
async function resolveGroupFromDocument(documentId) {
  const match = documentId.match(/^submissions\/([^/]+)\//);
  if (!match) return null;
  const docStudentId = match[1];

  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('student_id', docStudentId)
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('id, supervisor_id, course_id')
    .eq('id', membership.group_id)
    .maybeSingle();

  if (!group) return null;
  return { groupId: group.id, supervisorId: group.supervisor_id, courseId: group.course_id };
}

/**
 * Which highlight-creator roles a given viewer role is allowed to see.
 *
 * Channels are intentionally isolated:
 *   supervisor ↔ student  — invisible to coordinator / admin
 *   coordinator ↔ student — invisible to supervisor / admin
 *   committee   ↔ student — invisible to supervisor / coordinator / admin
 *   admin channel         — only visible to admins
 *
 * Students sit at the centre and receive feedback from every channel.
 */
const CHANNEL_VISIBILITY = {
  student:     new Set(['student', 'supervisor', 'coordinator', 'committee']),
  supervisor:  new Set(['supervisor', 'student']),
  coordinator: new Set(['coordinator', 'student']),
  committee:   new Set(['committee', 'student']),
  admin:       new Set(['admin']),
};

/**
 * GET /api/highlights?documentId=<file_path>
 *
 * Returns highlights for a document filtered by two rules:
 * 1. Group access — viewer must be related to the document's group.
 * 2. Channel visibility — each role sees only its own communication channel
 *    (supervisor↔student, coordinator↔student, committee↔student, admin-only).
 */
async function getHighlights(req, res) {
  try {
    const { documentId } = req.query;
    if (!documentId) {
      return res.status(400).json({ error: 'documentId query param is required' });
    }

    const userId = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin = userRoles.includes('admin');

    // ── Determine this viewer's relationship to THIS specific group ──────────
    // Channels are granted per-relationship, not per global role list, so a
    // user who supervises Group A and coordinates Course X only gets supervisor
    // channel on Group A's docs and coordinator channel on Course X's docs.
    let isSupervisorHere = false;
    let isCoordinatorHere = false;
    let isStudentHere = false;

    if (!isAdmin && documentId.startsWith('submissions/')) {
      const groupInfo = await resolveGroupFromDocument(documentId);

      if (groupInfo) {
        isSupervisorHere = groupInfo.supervisorId === userId;
        isCoordinatorHere =
          req.user.coordinatorCourseId != null &&
          req.user.coordinatorCourseId === groupInfo.courseId;

        if (!isSupervisorHere && !isCoordinatorHere) {
          const { data: membership } = await supabaseAdmin
            .from('group_members')
            .select('group_id')
            .eq('group_id', groupInfo.groupId)
            .eq('student_id', userId)
            .maybeSingle();
          isStudentHere = !!membership;
        }

        if (!isSupervisorHere && !isCoordinatorHere && !isStudentHere) {
          return res.json([]);
        }
      }
    }

    // Build allowed creator roles from THIS document's relationships only.
    const allowedCreatorRoles = (() => {
      if (isAdmin) return CHANNEL_VISIBILITY.admin;
      const roles = new Set();
      if (isSupervisorHere)  CHANNEL_VISIBILITY.supervisor.forEach((r)  => roles.add(r));
      if (isCoordinatorHere) CHANNEL_VISIBILITY.coordinator.forEach((r) => roles.add(r));
      if (isStudentHere)     CHANNEL_VISIBILITY.student.forEach((r)     => roles.add(r));
      // Non-submission docs: fall back to the user's active role
      if (roles.size === 0) {
        const active = req.user.activeRole || req.user.role || 'student';
        (CHANNEL_VISIBILITY[active] ?? [active]).forEach((r) => roles.add(r));
      }
      return roles;
    })();

    const { data: highlights, error: hErr } = await supabaseAdmin
      .from('document_highlights')
      .select('id, document_id, selected_text, page_number, x_percent, y_percent, width_percent, height_percent, start_position, end_position, highlight_color, user_id, role, created_at')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });

    if (hErr) {
      if (isTableMissing(hErr)) return res.json([]);
      throw hErr;
    }
    if (!highlights || highlights.length === 0) return res.json([]);

    // Fetch comments for all highlights in one query
    const highlightIds = highlights.map((h) => h.id);
    const { data: allComments, error: cErr } = await supabaseAdmin
      .from('highlight_comments')
      .select('id, highlight_id, user_id, role, content, created_at')
      .in('highlight_id', highlightIds)
      .order('created_at', { ascending: true });

    if (cErr && !isTableMissing(cErr)) throw cErr;
    const comments = allComments || [];

    // Batch-fetch author names
    const userIds = [
      ...new Set([
        ...highlights.map((h) => h.user_id),
        ...comments.map((c) => c.user_id),
      ]),
    ];
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name')
      .in('id', userIds);
    const nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));

    // Group comments by highlight_id
    const commentsByHighlight = {};
    for (const c of comments) {
      if (!commentsByHighlight[c.highlight_id]) commentsByHighlight[c.highlight_id] = [];
      commentsByHighlight[c.highlight_id].push({
        id: c.id,
        highlightId: c.highlight_id,
        userId: c.user_id,
        userName: nameMap[c.user_id] ?? 'Unknown',
        role: c.role,
        content: c.content,
        createdAt: c.created_at,
      });
    }

    // ── Channel visibility filter ──────────────────────────────────────────
    const result = highlights
      .filter((h) => allowedCreatorRoles.has(h.role))
      .map((h) => ({
        id: h.id,
        documentId: h.document_id,
        selectedText: h.selected_text,
        pageNumber: h.page_number,
        xPercent: h.x_percent,
        yPercent: h.y_percent,
        widthPercent: h.width_percent,
        heightPercent: h.height_percent,
        startPosition: h.start_position,
        endPosition: h.end_position,
        highlightColor: h.highlight_color,
        userId: h.user_id,
        userName: nameMap[h.user_id] ?? 'Unknown',
        role: h.role,
        createdAt: h.created_at,
        comments: (commentsByHighlight[h.id] || []).filter((c) =>
          allowedCreatorRoles.has(c.role)
        ),
      }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching highlights:', err);
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
}

/**
 * POST /api/highlights
 *
 * Creates a new highlight with an optional initial comment.
 * Body: { documentId, selectedText, pageNumber, xPercent, yPercent,
 *         widthPercent, heightPercent, startPosition?, endPosition?,
 *         highlightColor?, comment? }
 */
async function createHighlight(req, res) {
  try {
    const {
      documentId,
      selectedText,
      pageNumber = 1,
      xPercent = 0,
      yPercent = 0,
      widthPercent = 0,
      heightPercent = 0,
      startPosition,
      endPosition,
      highlightColor,
      comment,
    } = req.body;

    if (!documentId || !selectedText?.trim()) {
      return res.status(400).json({ error: 'documentId and selectedText are required' });
    }

    const userId = req.user.id;
    const role = req.user.activeRole || req.user.role || 'student';

    // Role → colour defaults
    const roleColors = {
      student: '#FFF59D',
      supervisor: '#BBDEFB',
      coordinator: '#C8E6C9',
      committee: '#F8BBD0',
      admin: '#E1BEE7',
    };
    const color = highlightColor || roleColors[role] || '#FFF59D';

    const { data: highlight, error: hErr } = await supabaseAdmin
      .from('document_highlights')
      .insert({
        document_id: documentId,
        selected_text: selectedText.trim(),
        page_number: pageNumber,
        x_percent: xPercent,
        y_percent: yPercent,
        width_percent: widthPercent,
        height_percent: heightPercent,
        start_position: startPosition ?? null,
        end_position: endPosition ?? null,
        highlight_color: color,
        user_id: userId,
        role,
      })
      .select('id, document_id, selected_text, page_number, x_percent, y_percent, width_percent, height_percent, start_position, end_position, highlight_color, user_id, role, created_at')
      .single();

    if (hErr) {
      if (isTableMissing(hErr)) {
        return res.status(503).json({
          error: 'Highlights feature not yet set up. Please run docs/sql/010_document_highlights.sql in Supabase.',
        });
      }
      throw hErr;
    }

    // Optionally attach an initial comment
    let initialComment = null;
    if (comment?.trim()) {
      const { data: c, error: cErr } = await supabaseAdmin
        .from('highlight_comments')
        .insert({
          highlight_id: highlight.id,
          user_id: userId,
          role,
          content: comment.trim(),
        })
        .select('id, highlight_id, user_id, role, content, created_at')
        .single();

      if (!cErr && c) {
        initialComment = {
          id: c.id,
          highlightId: c.highlight_id,
          userId: c.user_id,
          userName: req.user.name,
          role: c.role,
          content: c.content,
          createdAt: c.created_at,
        };
      }
    }

    res.status(201).json({
      id: highlight.id,
      documentId: highlight.document_id,
      selectedText: highlight.selected_text,
      pageNumber: highlight.page_number,
      xPercent: highlight.x_percent,
      yPercent: highlight.y_percent,
      widthPercent: highlight.width_percent,
      heightPercent: highlight.height_percent,
      startPosition: highlight.start_position,
      endPosition: highlight.end_position,
      highlightColor: highlight.highlight_color,
      userId: highlight.user_id,
      userName: req.user.name,
      role: highlight.role,
      createdAt: highlight.created_at,
      comments: initialComment ? [initialComment] : [],
    });
  } catch (err) {
    console.error('Error creating highlight:', err);
    res.status(500).json({ error: 'Failed to create highlight' });
  }
}

/**
 * DELETE /api/highlights/:id
 *
 * Deletes a highlight (and all its comments via CASCADE).
 * Only the creator or an admin can delete.
 */
async function deleteHighlight(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    const { data: highlight, error: fetchErr } = await supabaseAdmin
      .from('document_highlights')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (fetchErr || !highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    if (!userRoles.includes('admin') && highlight.user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own highlights' });
    }

    const { error: delErr } = await supabaseAdmin
      .from('document_highlights')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting highlight:', err);
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
}

/**
 * POST /api/highlights/:id/comments
 *
 * Adds a reply comment to an existing highlight.
 * Body: { content }
 */
async function addHighlightComment(req, res) {
  try {
    const { id: highlightId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const { data: highlight, error: hErr } = await supabaseAdmin
      .from('document_highlights')
      .select('id')
      .eq('id', highlightId)
      .single();

    if (hErr || !highlight) {
      return res.status(404).json({ error: 'Highlight not found' });
    }

    const userId = req.user.id;
    const role = req.user.activeRole || req.user.role || 'student';

    const { data: comment, error: cErr } = await supabaseAdmin
      .from('highlight_comments')
      .insert({
        highlight_id: highlightId,
        user_id: userId,
        role,
        content: content.trim(),
      })
      .select('id, highlight_id, user_id, role, content, created_at')
      .single();

    if (cErr) {
      if (isTableMissing(cErr)) {
        return res.status(503).json({ error: 'Highlights feature not yet set up.' });
      }
      throw cErr;
    }

    res.status(201).json({
      id: comment.id,
      highlightId: comment.highlight_id,
      userId: comment.user_id,
      userName: req.user.name,
      role: comment.role,
      content: comment.content,
      createdAt: comment.created_at,
    });
  } catch (err) {
    console.error('Error adding highlight comment:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

/**
 * DELETE /api/highlights/:highlightId/comments/:commentId
 *
 * Deletes a single reply comment. Only the author or admin can delete.
 */
async function deleteHighlightComment(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles || [];

    const { data: comment, error: fetchErr } = await supabaseAdmin
      .from('highlight_comments')
      .select('id, user_id')
      .eq('id', commentId)
      .single();

    if (fetchErr || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (!userRoles.includes('admin') && comment.user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    const { error: delErr } = await supabaseAdmin
      .from('highlight_comments')
      .delete()
      .eq('id', commentId);

    if (delErr) throw delErr;

    res.status(204).send();
  } catch (err) {
    console.error('Error deleting highlight comment:', err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

module.exports = {
  getHighlights,
  createHighlight,
  deleteHighlight,
  addHighlightComment,
  deleteHighlightComment,
};
