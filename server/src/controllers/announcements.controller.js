const { supabaseAdmin } = require('../config/supabase');
const { normalizeCourseCode } = require('../utils/helpers');
const { cacheGet, cacheSet, cacheDelPattern, TTL } = require('../utils/cache');
const { queueAnnouncementEmail } = require('../services/queue.service');

/**
 * Build a deterministic cache key for the announcements list.
 * Incorporates courseId, role filter, and pagination range so different
 * users / pages never share the wrong data.
 */
function announcementCacheKey(userId, role, from, to) {
  return `announcements:${userId ?? 'anon'}:${role ?? 'all'}:${from}-${to}`;
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
      const ck = announcementCacheKey(req.user?.id, role, from, to);
      const cached = await cacheGet(ck);
      if (cached) {
        res.set('Cache-Control', 'private, max-age=60');
        return res.json(cached);
      }
    }

    let query = supabaseAdmin
      .from('announcements')
      .select('id, title, content, author_id, published_at, expires_at, target_roles, course_id')
      .order('published_at', { ascending: false });

    if (role) {
      query = query.contains('target_roles', [role]);
    }

    // Coordinators: only see announcements they authored that are course-wide
    // (group_id IS NULL). The group_id null check is what separates coordinator-
    // created announcements from supervisor-created group announcements — even
    // when both roles belong to the same user account.
    if (!role && req.user?.activeRole === 'coordinator') {
      query = query.eq('author_id', req.user.id);
      // group_id IS NULL is enforced below in the group-scope section
    }

    // Students never see scheduled (future) announcements.
    if (req.user?.activeRole === 'student') {
      query = query.lte('published_at', new Date().toISOString());
    }

    // ── Resolve the viewer's course + group context ──────────────────────────
    // Used to scope announcements for students, supervisors, and coordinators.
    let viewerCourseId  = null;
    let viewerGroupId   = null;   // student's own group (migration 006)
    let viewerCourseIds = [];     // all course IDs the viewer belongs to
    let viewerGroupIds  = [];     // all group IDs the viewer supervises / belongs to

    if (req.user?.activeRole === 'coordinator') {
      viewerCourseId  = req.user.coordinatorCourseId ?? null;
      viewerCourseIds = viewerCourseId ? [viewerCourseId] : [];
    } else if (req.user?.activeRole === 'student') {
      // student → group_members → groups → course_id + group_id
      const { data: gm } = await supabaseAdmin
        .from('group_members').select('group_id').eq('student_id', req.user.id).limit(1).maybeSingle();
      if (gm?.group_id) {
        viewerGroupId = gm.group_id;
        viewerGroupIds = [gm.group_id];
        const { data: grp } = await supabaseAdmin
          .from('groups').select('course_id').eq('id', gm.group_id).single();
        viewerCourseId  = grp?.course_id ?? null;
        viewerCourseIds = viewerCourseId ? [viewerCourseId] : [];
      }
    } else if (req.user?.activeRole === 'supervisor') {
      // supervisor → all supervised groups → distinct course IDs + group IDs
      const { data: grps } = await supabaseAdmin
        .from('groups').select('id, course_id').eq('supervisor_id', req.user.id);
      viewerGroupIds  = (grps || []).map((g) => g.id).filter(Boolean);
      viewerCourseIds = [...new Set((grps || []).map((g) => g.course_id).filter(Boolean))];
      viewerCourseId  = viewerCourseIds[0] ?? null; // kept for fallback compat
    }

    // ── Apply course-scoped filter ────────────────────────────────────────────
    // Coordinators: only their assigned course (no platform-wide fallback) so
    // they never see other courses' announcements.
    // Students / supervisors: their courses + platform-wide (course_id IS NULL).
    if (req.user?.activeRole === 'coordinator') {
      if (viewerCourseIds.length > 0) {
        query = query.eq('course_id', viewerCourseIds[0]);
      } else {
        // No course assigned — restrict to own authored posts only
        query = query.eq('author_id', req.user.id);
      }
    } else if (viewerCourseIds.length > 0) {
      const courseFilter = viewerCourseIds.map((id) => `course_id.eq.${id}`).join(',');
      query = query.or(`${courseFilter},course_id.is.null`);
    }

    // ── Apply group-scoped filter (migration 006) ─────────────────────────────
    // Coordinators only manage course-wide announcements (group_id IS NULL).
    // Group-specific supervisor↔student communications are out of their scope.
    if (req.user?.activeRole === 'coordinator') {
      query = query.is('group_id', null);
    } else if (viewerGroupIds.length > 0) {
      // Students / supervisors: show their group's announcements + course-wide ones.
      const groupParts = viewerGroupIds.map((id) => `group_id.eq.${id}`).join(',');
      query = query.or(`group_id.is.null,${groupParts}`);
    }

    let { data, error } = await query.range(from, to);

    // Fallback when course_id / group_id column doesn't exist yet (pre-migration):
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

    // Batch-fetch author names and course names in parallel
    const authorIds  = [...new Set((data || []).map((a) => a.author_id).filter(Boolean))];
    const courseIds  = [...new Set((data || []).map((a) => a.course_id).filter(Boolean))];

    const [profilesRes, coursesRes] = await Promise.all([
      authorIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, name, email').in('id', authorIds)
        : Promise.resolve({ data: [] }),
      courseIds.length > 0
        ? supabaseAdmin.from('courses').select('id, code, name').in('id', courseIds)
        : Promise.resolve({ data: [] }),
    ]);

    const authorMap = {};
    for (const p of (profilesRes.data || [])) authorMap[p.id] = p.name || p.email || null;

    const courseMap = {};
    for (const c of (coursesRes.data || [])) {
      courseMap[c.id] = normalizeCourseCode(c.code ?? '') || c.name || '';
    }

    res.set('Cache-Control', isManager ? 'no-store' : 'private, max-age=60');

    const payload = (data || []).map((a) => ({
      id:          a.id,
      title:       a.title,
      content:     a.content,
      author:      authorMap[a.author_id] ?? 'Admin',
      authorId:    a.author_id ?? null,
      courseName:  a.course_id ? (courseMap[a.course_id] ?? '') : '',
      publishedAt: a.published_at,
      expiresAt:   a.expires_at ?? undefined,
      targetRoles: a.target_roles ?? [],
      isScheduled: new Date(a.published_at) > new Date(),
    }));

    // Cache for non-manager roles
    if (!isManager) {
      await cacheSet(announcementCacheKey(req.user?.id, role, from, to), payload, TTL.SHORT);
    }

    res.json(payload);
  } catch (error) {
    console.error('Error listing announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
}

/**
 * POST /api/announcements
 * Supervisor/Coordinator/Admin — create a new announcement.
 * Supervisors must supply a groupId; their announcement is scoped to that group
 * and targets only the group's students (targetRoles is forced to ['student']).
 */
async function createAnnouncement(req, res) {
  try {
    const { title, content, targetRoles, expiresAt, groupId: bodyGroupId, scheduledFor } = req.body;

    if (!title || !content || !Array.isArray(targetRoles) || targetRoles.length === 0) {
      return res.status(400).json({ error: 'title, content, and targetRoles are required' });
    }

    const isAdmin       = req.user.roles && req.user.roles.includes('admin');
    const isCoordinator = !isAdmin && !!req.user.coordinatorCourseId;
    const isSupervisor  = !isAdmin && !isCoordinator && req.user.roles && req.user.roles.includes('supervisor');

    let courseId        = req.user.coordinatorCourseId ?? null;
    let resolvedGroupId = null;
    let effectiveRoles  = targetRoles;

    if (isSupervisor) {
      if (!bodyGroupId) {
        return res.status(400).json({ error: 'groupId is required for supervisor-created announcements' });
      }
      // Validate the supervisor owns this group
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('id, course_id')
        .eq('id', bodyGroupId)
        .eq('supervisor_id', req.user.id)
        .maybeSingle();

      if (grpErr || !grp) {
        return res.status(403).json({ error: 'You are not the supervisor of this group' });
      }
      resolvedGroupId = grp.id;
      courseId        = grp.course_id ?? null;
      effectiveRoles  = ['student']; // supervisors can only target their group's students
    }

    // Honour optional scheduling: if scheduledFor is a valid future date, use it
    // as published_at and delay the email blast accordingly.
    const now = new Date();
    const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
    const isScheduled = scheduledDate && !isNaN(scheduledDate.getTime()) && scheduledDate > now;
    const publishedAt = isScheduled ? scheduledDate.toISOString() : now.toISOString();
    const emailDelay  = isScheduled ? scheduledDate.getTime() - now.getTime() : 0;

    const basePayload = {
      title,
      content,
      author_id:    req.user.id,
      target_roles: effectiveRoles,
      expires_at:   expiresAt ?? null,
      published_at: publishedAt,
    };

    // Try with course_id + group_id first; fall back progressively.
    const fullPayload = {
      ...basePayload,
      ...(courseId        ? { course_id: courseId }        : {}),
      ...(resolvedGroupId ? { group_id:  resolvedGroupId } : {}),
    };

    let insertResult = await supabaseAdmin.from('announcements')
      .insert(fullPayload).select('id').single();

    if (insertResult.error && resolvedGroupId) {
      // group_id column missing — retry without it
      insertResult = await supabaseAdmin.from('announcements')
        .insert({ ...basePayload, ...(courseId ? { course_id: courseId } : {}) })
        .select('id').single();
    }

    if (insertResult.error && courseId) {
      // course_id column missing — retry without it
      insertResult = await supabaseAdmin.from('announcements')
        .insert(basePayload).select('id').single();
    }

    const { data, error } = insertResult;
    if (error) throw error;

    // Bust all announcement list caches so new entry appears immediately
    await cacheDelPattern('announcements:*');

    // ── Queue email blast ─────────────────────────────────────────────────────
    // For supervisor group-scoped announcements: email only the group's students.
    // For coordinator/admin announcements: use the standard course-scoped resolver.
    // Scheduled announcements pass emailDelay so the job fires at publish time.
    if (isSupervisor && resolvedGroupId) {
      // Fetch only this group's students for the email blast
      ;(async () => {
        try {
          const { data: members } = await supabaseAdmin
            .from('group_members').select('student_id').eq('group_id', resolvedGroupId);
          const studentIds = (members || []).map((m) => m.student_id).filter(Boolean);
          if (studentIds.length === 0) return;

          const { data: profiles } = await supabaseAdmin
            .from('profiles').select('email').in('id', studentIds);
          const emails = (profiles || []).map((p) => p.email).filter(Boolean);
          if (emails.length === 0) return;

          const { data: course } = courseId
            ? await supabaseAdmin.from('courses').select('code').eq('id', courseId).single()
            : { data: null };
          const courseName = normalizeCourseCode(course?.code ?? '');

          await queueAnnouncementEmail(emails, { title, content, courseName, publishedAt }, { delay: emailDelay });
        } catch (e) {
          console.error('[announcements] supervisor group email blast failed:', e.message);
        }
      })();
    } else {
      const coordinatorCourseId = req.user.coordinatorCourseId ?? null;
      resolveRecipientEmails(effectiveRoles, coordinatorCourseId)
        .then(({ emails, courseName }) => {
          if (emails.length === 0) return;
          return queueAnnouncementEmail(emails, { title, content, courseName, publishedAt }, { delay: emailDelay });
        })
        .catch((err) => console.error('[announcements] Failed to queue announcement emails:', err.message));
    }

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
    const isAdmin       = req.user?.roles?.includes('admin');
    const isCoordinator = !isAdmin && !!req.user?.coordinatorCourseId;
    const isSupervisor  = !isAdmin && !isCoordinator && req.user?.roles?.includes('supervisor');

    // Supervisors may only delete announcements they authored themselves
    if (isSupervisor) {
      const { data: existing } = await supabaseAdmin
        .from('announcements').select('author_id').eq('id', id).maybeSingle();
      if (!existing) return res.status(404).json({ error: 'Announcement not found' });
      if (existing.author_id !== req.user.id) {
        return res.status(403).json({ error: 'You can only delete announcements you posted' });
      }
    }

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
