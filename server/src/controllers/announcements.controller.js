const { supabaseAdmin } = require('../config/supabase');
const emailService = require('../services/email.service');

/**
 * GET /api/announcements?role=student|supervisor|admin
 * Authenticated — returns announcements targeting the given role
 */
async function listAnnouncements(req, res) {
  try {
    const { role } = req.query;

    let query = supabaseAdmin
      .from('announcements')
      .select('id, title, content, author_id, published_at, expires_at, target_roles')
      .order('published_at', { ascending: false });

    if (role) {
      query = query.contains('target_roles', [role]);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Batch-fetch author names
    const authorIds = [...new Set((data || []).map((a) => a.author_id).filter(Boolean))];
    let authorMap = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);
      for (const p of (profiles || [])) authorMap[p.id] = p.name;
    }

    res.json((data || []).map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      author: authorMap[a.author_id] ?? 'Admin',
      publishedAt: a.published_at,
      expiresAt: a.expires_at ?? undefined,
      targetRoles: a.target_roles ?? [],
    })));
  } catch (error) {
    console.error('Error listing announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
}

/**
 * POST /api/announcements
 * Admin only — create a new announcement
 */
async function createAnnouncement(req, res) {
  try {
    const { title, content, targetRoles, expiresAt } = req.body;

    if (!title || !content || !Array.isArray(targetRoles) || targetRoles.length === 0) {
      return res.status(400).json({ error: 'title, content, and targetRoles are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('announcements')
      .insert({
        title,
        content,
        author_id: req.user.id,
        target_roles: targetRoles,
        expires_at: expiresAt ?? null,
        published_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;

    // ── Fire-and-forget course-scoped email blast ─────────────────────────────
    const coordinatorCourseId = req.user.coordinatorCourseId ?? null;
    const publishedAt = new Date().toISOString();

    // Resolve email recipients per role, scoped to coordinator's course
    (async () => {
      try {
        const recipientEmails = new Set();

        if (targetRoles.includes('student') && coordinatorCourseId) {
          const { data: groups } = await supabaseAdmin
            .from('groups').select('id').eq('course_id', coordinatorCourseId);
          const groupIds = (groups || []).map((g) => g.id);
          if (groupIds.length > 0) {
            const { data: members } = await supabaseAdmin
              .from('group_members').select('student_id').in('group_id', groupIds);
            const studentIds = (members || []).map((m) => m.student_id);
            if (studentIds.length > 0) {
              const { data: profiles } = await supabaseAdmin
                .from('profiles').select('email').in('id', studentIds);
              (profiles || []).forEach((p) => p.email && recipientEmails.add(p.email));
            }
          }
        }

        if (targetRoles.includes('supervisor') && coordinatorCourseId) {
          const { data: groups } = await supabaseAdmin
            .from('groups').select('supervisor_id')
            .eq('course_id', coordinatorCourseId)
            .not('supervisor_id', 'is', null);
          const supIds = [...new Set((groups || []).map((g) => g.supervisor_id))];
          if (supIds.length > 0) {
            const { data: profiles } = await supabaseAdmin
              .from('profiles').select('email').in('id', supIds);
            (profiles || []).forEach((p) => p.email && recipientEmails.add(p.email));
          }
        }

        if (targetRoles.includes('admin')) {
          const { data: adminRoles } = await supabaseAdmin
            .from('user_roles').select('user_id').eq('role', 'admin');
          const adminIds = (adminRoles || []).map((r) => r.user_id);
          if (adminIds.length > 0) {
            const { data: profiles } = await supabaseAdmin
              .from('profiles').select('email').in('id', adminIds);
            (profiles || []).forEach((p) => p.email && recipientEmails.add(p.email));
          }
        }

        if (recipientEmails.size === 0) return;

        // Fetch course name for email subject
        let courseName = '';
        if (coordinatorCourseId) {
          const { data: course } = await supabaseAdmin
            .from('courses').select('code').eq('id', coordinatorCourseId).single();
          courseName = course?.code ?? '';
        }

        await emailService.sendAnnouncement([...recipientEmails], {
          title,
          content,
          courseName,
          publishedAt,
        });
      } catch (emailErr) {
        console.error('[announcements] Failed to send announcement emails:', emailErr.message);
      }
    })();

    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
}

/**
 * PATCH /api/announcements/:id
 * Admin only — update an announcement
 */
async function updateAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { title, content, targetRoles, expiresAt } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (targetRoles !== undefined) updates.target_roles = targetRoles;
    if (expiresAt !== undefined) updates.expires_at = expiresAt;

    const { error } = await supabaseAdmin
      .from('announcements')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
}

/**
 * DELETE /api/announcements/:id
 * Admin only — delete an announcement
 */
async function deleteAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
}

module.exports = { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
