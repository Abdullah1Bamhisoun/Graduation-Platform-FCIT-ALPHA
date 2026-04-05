const { supabaseAdmin } = require('../config/supabase');
const { normalizeCourseCode } = require('../utils/helpers');
const { cacheGet, cacheSet, cacheDelPattern, TTL } = require('../utils/cache');
const { queueAnnouncementEmail } = require('../services/queue.service');

/**
 * Build a deterministic cache key for the announcements list.
 * Incorporates courseId, role filter, and pagination range so different
 * users / pages never share the wrong data.
 */
function announcementCacheKey(courseId, role, from, to) {
  return `announcements:${courseId ?? 'null'}:${role ?? 'all'}:${from}-${to}`;
}

/**
 * Resolve recipient emails for an announcement blast.
 *
 * For students / supervisors: tries course-scoped group lookup first; falls
 * back to ALL platform users of that role so announcements are never silently
 * dropped when a coordinator has no groups set up yet.
 *
 * @param {string[]} targetRoles
 * @param {string|null} coordinatorCourseId
 * @returns {Promise<{ emails: string[], courseName: string }>}
 */
async function resolveRecipientEmails(targetRoles, coordinatorCourseId) {
  const recipientEmails = new Set();

  // Kick off course name lookup in parallel with all role lookups
  const courseNamePromise = coordinatorCourseId
    ? supabaseAdmin.from('courses').select('code').eq('id', coordinatorCourseId).single()
    : Promise.resolve({ data: null });

  // ── Students ──────────────────────────────────────────────────────────────
  if (targetRoles.includes('student')) {
    let foundViaGroups = false;

    if (coordinatorCourseId) {
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
          foundViaGroups = recipientEmails.size > 0;
        }
      }
    }

    if (!foundViaGroups) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles').select('email').eq('role', 'student');
      (profiles || []).forEach((p) => p.email && recipientEmails.add(p.email));
    }
  }

  // ── Supervisors ───────────────────────────────────────────────────────────
  if (targetRoles.includes('supervisor')) {
    let foundViaGroups = false;

    if (coordinatorCourseId) {
      const { data: groups } = await supabaseAdmin
        .from('groups').select('supervisor_id')
        .eq('course_id', coordinatorCourseId)
        .not('supervisor_id', 'is', null);
      const supIds = [...new Set((groups || []).map((g) => g.supervisor_id))];

      if (supIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles').select('email').in('id', supIds);
        (profiles || []).forEach((p) => p.email && recipientEmails.add(p.email));
        foundViaGroups = true;
      }
    }

    if (!foundViaGroups) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles').select('email').eq('role', 'supervisor');
      (profiles || []).forEach((p) => p.email && recipientEmails.add(p.email));
    }
  }

  // ── Admins ────────────────────────────────────────────────────────────────
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

  // ── Course name — resolve the promise started at the top ──────────────────
  const { data: course } = await courseNamePromise;
  const courseName = normalizeCourseCode(course?.code ?? '');

  return { emails: [...recipientEmails], courseName };
}

/**
 * GET /api/announcements?role=student|supervisor|admin
 * Authenticated — returns announcements targeting the given role
 */
async function listAnnouncements(req, res) {
  try {
    const { role } = req.query;
    const { from, to } = req.pagination;

    // Coordinators always see fresh data; other roles can use cache
    const isManager = req.user?.activeRole === 'coordinator' || req.user?.activeRole === 'admin';

    if (!isManager) {
      const ck = announcementCacheKey(req.user?.coordinatorCourseId ?? null, role, from, to);
      const cached = await cacheGet(ck);
      if (cached) {
        res.set('Cache-Control', 'private, max-age=60');
        return res.json(cached);
      }
    }

    let query = supabaseAdmin
      .from('announcements')
      .select('id, title, content, author_id, published_at, expires_at, target_roles')
      .order('published_at', { ascending: false });

    if (role) {
      query = query.contains('target_roles', [role]);
    }

    // ── Resolve the viewer's course ID ───────────────────────────────────────
    // Used to scope announcements for students, supervisors, and coordinators.
    let viewerCourseId = null;

    if (req.user?.activeRole === 'coordinator') {
      viewerCourseId = req.user.coordinatorCourseId ?? null;
    } else if (req.user?.activeRole === 'student') {
      // student → group_members → groups → course_id
      const { data: gm } = await supabaseAdmin
        .from('group_members').select('group_id').eq('student_id', req.user.id).limit(1).maybeSingle();
      if (gm?.group_id) {
        const { data: grp } = await supabaseAdmin
          .from('groups').select('course_id').eq('id', gm.group_id).single();
        viewerCourseId = grp?.course_id ?? null;
      }
    } else if (req.user?.activeRole === 'supervisor') {
      // supervisor → groups → course_id  (take the first group's course)
      const { data: grp } = await supabaseAdmin
        .from('groups').select('course_id').eq('supervisor_id', req.user.id).limit(1).maybeSingle();
      viewerCourseId = grp?.course_id ?? null;
    }

    // ── Apply course-scoped filter ────────────────────────────────────────────
    // Include announcements that:
    //   (a) belong to the viewer's course  (course_id = viewerCourseId), OR
    //   (b) are platform-wide / admin-posted (course_id IS NULL)
    // Strictly matching on course_id alone silently hides null-scoped announcements.
    if (viewerCourseId) {
      query = query.or(`course_id.eq.${viewerCourseId},course_id.is.null`);
    } else if (req.user?.activeRole === 'coordinator') {
      query = query.eq('author_id', req.user.id);
    }

    let { data, error } = await query.range(from, to);

    // Fallback when course_id column doesn't exist yet (pre-migration):
    // the filter above causes a DB error — resolve via platform_locks + user_roles instead.
    if (error && viewerCourseId) {
      // Gather coordinator IDs from both assignment mechanisms in parallel
      const [{ data: lockRows }, { data: roleRows }] = await Promise.all([
        supabaseAdmin.from('platform_locks').select('locked_by')
          .eq('entity_type', 'coordinator_assignment')
          .eq('entity_id', viewerCourseId)
          .eq('is_locked', true),
        supabaseAdmin.from('user_roles').select('user_id, roles(name)')
          .eq('coordinator_course_id', viewerCourseId),
      ]);
      const coordIds = [
        ...(lockRows || []).map((r) => r.locked_by).filter(Boolean),
        ...(roleRows || []).filter((r) => r.roles?.name === 'coordinator').map((r) => r.user_id).filter(Boolean),
      ];

      if (req.user?.activeRole === 'coordinator') coordIds.push(req.user.id);
      const uniqueCoordIds = [...new Set(coordIds)];

      let baseQuery = supabaseAdmin
        .from('announcements')
        .select('id, title, content, author_id, published_at, expires_at, target_roles')
        .order('published_at', { ascending: false });
      if (role) baseQuery = baseQuery.contains('target_roles', [role]);

      // If we found coordinator IDs, filter by author; otherwise return all role-matched
      // announcements (no course scope possible without course_id column).
      const fallback = uniqueCoordIds.length > 0
        ? await baseQuery.in('author_id', uniqueCoordIds).range(from, to)
        : await baseQuery.range(from, to);

      data = fallback.data;
      error = fallback.error;
    }

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

    res.set('Cache-Control', isManager ? 'no-store' : 'private, max-age=60');

    const payload = (data || []).map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      author: authorMap[a.author_id] ?? 'Admin',
      publishedAt: a.published_at,
      expiresAt: a.expires_at ?? undefined,
      targetRoles: a.target_roles ?? [],
    }));

    // Cache for non-manager roles
    if (!isManager) {
      const viewerCourseIdForKey = req.user?.coordinatorCourseId ?? null;
      await cacheSet(announcementCacheKey(viewerCourseIdForKey, role, from, to), payload, TTL.SHORT);
    }

    res.json(payload);
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

    const basePayload = {
      title,
      content,
      author_id: req.user.id,
      target_roles: targetRoles,
      expires_at: expiresAt ?? null,
      published_at: new Date().toISOString(),
    };

    // Try with course_id first (works after migration 005).
    // Fall back to base payload if column doesn't exist yet.
    let insertResult = req.user.coordinatorCourseId
      ? await supabaseAdmin.from('announcements')
          .insert({ ...basePayload, course_id: req.user.coordinatorCourseId })
          .select('id').single()
      : await supabaseAdmin.from('announcements')
          .insert(basePayload).select('id').single();

    if (insertResult.error && req.user.coordinatorCourseId) {
      // Pre-migration: column doesn't exist, retry without course_id
      insertResult = await supabaseAdmin.from('announcements')
        .insert(basePayload).select('id').single();
    }

    const { data, error } = insertResult;
    if (error) throw error;

    // Bust all announcement list caches so new entry appears immediately
    await cacheDelPattern('announcements:*');

    // ── Queue email blast (retries automatically on SMTP failure) ─────────────
    const coordinatorCourseId = req.user.coordinatorCourseId ?? null;
    const publishedAt = new Date().toISOString();

    resolveRecipientEmails(targetRoles, coordinatorCourseId)
      .then(({ emails, courseName }) => {
        if (emails.length === 0) return;
        return queueAnnouncementEmail(emails, { title, content, courseName, publishedAt });
      })
      .catch((err) => console.error('[announcements] Failed to queue announcement emails:', err.message));

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

    // Coordinators may only edit announcements belonging to their course
    if (req.user?.activeRole === 'coordinator') {
      const { data: existing } = await supabaseAdmin
        .from('announcements').select('author_id, course_id').eq('id', id).single();
      if (!existing) return res.status(403).json({ error: 'Not authorized to edit this announcement' });

      // Post-migration: check course_id. Pre-migration: check author_id or user_roles.
      let authorized = false;
      if (existing.course_id !== undefined) {
        authorized = existing.course_id === req.user.coordinatorCourseId;
      } else {
        authorized = existing.author_id === req.user.id;
        if (!authorized && req.user.coordinatorCourseId) {
          const { data: coord } = await supabaseAdmin
            .from('user_roles').select('user_id')
            .eq('user_id', existing.author_id)
            .eq('coordinator_course_id', req.user.coordinatorCourseId)
            .maybeSingle();
          authorized = !!coord;
        }
      }
      if (!authorized) return res.status(403).json({ error: 'Not authorized to edit this announcement' });
    }

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
    await cacheDelPattern('announcements:*');
    res.json({ success: true });

    // ── Queue email blast on update ───────────────────────────────────────────
    const coordinatorCourseId = req.user.coordinatorCourseId ?? null;
    const publishedAt = new Date().toISOString();

    (async () => {
      try {
        let effectiveRoles = targetRoles;
        let effectiveTitle = title;
        let effectiveContent = content;

        if (!effectiveRoles || !effectiveTitle || !effectiveContent) {
          const { data: existing } = await supabaseAdmin
            .from('announcements')
            .select('title, content, target_roles')
            .eq('id', id)
            .single();
          effectiveRoles = effectiveRoles ?? existing?.target_roles ?? [];
          effectiveTitle = effectiveTitle ?? existing?.title ?? '';
          effectiveContent = effectiveContent ?? existing?.content ?? '';
        }

        const { emails, courseName } = await resolveRecipientEmails(effectiveRoles, coordinatorCourseId);
        if (emails.length === 0) return;
        await queueAnnouncementEmail(emails, {
          title: effectiveTitle,
          content: effectiveContent,
          courseName,
          publishedAt,
        });
      } catch (emailErr) {
        console.error('[announcements] Failed to queue update emails:', emailErr.message);
      }
    })();
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

    // Coordinators may only delete announcements belonging to their course
    if (req.user?.activeRole === 'coordinator') {
      const { data: existing } = await supabaseAdmin
        .from('announcements').select('author_id, course_id').eq('id', id).single();
      if (!existing) return res.status(403).json({ error: 'Not authorized to delete this announcement' });

      let authorized = false;
      if (existing.course_id !== undefined) {
        authorized = existing.course_id === req.user.coordinatorCourseId;
      } else {
        authorized = existing.author_id === req.user.id;
        if (!authorized && req.user.coordinatorCourseId) {
          const { data: coord } = await supabaseAdmin
            .from('user_roles').select('user_id')
            .eq('user_id', existing.author_id)
            .eq('coordinator_course_id', req.user.coordinatorCourseId)
            .maybeSingle();
          authorized = !!coord;
        }
      }
      if (!authorized) return res.status(403).json({ error: 'Not authorized to delete this announcement' });
    }

    const { error } = await supabaseAdmin.from('announcements').delete().eq('id', id);
    if (error) throw error;
    await cacheDelPattern('announcements:*');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
}

module.exports = { listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement };
