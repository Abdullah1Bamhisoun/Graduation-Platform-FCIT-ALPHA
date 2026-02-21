const { supabaseAdmin } = require('../config/supabase');

/**
 * POST /api/roles/switch
 * Logs a role switch event for the authenticated user.
 */
async function switchRole(req, res) {
  try {
    const { fromRole, toRole } = req.body;

    if (!fromRole || !toRole) {
      return res.status(400).json({ error: 'fromRole and toRole are required' });
    }

    if (!req.user.roles.includes(toRole)) {
      return res.status(403).json({ error: 'You do not have the requested role' });
    }

    const { error } = await supabaseAdmin
      .from('role_switch_logs')
      .insert({
        user_id:    req.user.id,
        from_role:  fromRole,
        to_role:    toRole,
        switched_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Error logging role switch:', error);
    }

    res.json({ success: true, activeRole: toRole });
  } catch (error) {
    console.error('Error in switchRole:', error);
    res.status(500).json({ error: 'Failed to switch role' });
  }
}

/**
 * GET /api/roles/mine
 * Returns all roles for the authenticated user with coordinator course info.
 */
async function getMyRoles(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select(`
        id,
        coordinator_course_id,
        roles ( id, name ),
        courses:coordinator_course_id ( id, code, name )
      `)
      .eq('user_id', req.user.id);

    if (error) throw error;

    const roles = (data || []).map((row) => ({
      roleId:               row.roles?.id,
      roleName:             row.roles?.name,
      coordinatorCourseId:  row.coordinator_course_id ?? null,
      coordinatorCourse:    row.courses
        ? { id: row.courses.id, code: row.courses.code, name: row.courses.name }
        : null,
    }));

    res.json({ roles });
  } catch (error) {
    console.error('Error fetching user roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
}

/**
 * POST /api/roles/assign  (admin only)
 * Assign a role to a user. For coordinator role, course_id is required.
 *
 * Primary path:   stores in platform_locks (always available, no DDL needed).
 * Secondary path: also updates profiles.coordinator_course_id if column exists.
 * Tertiary path:  also upserts into user_roles if that table exists.
 */
async function assignRole(req, res) {
  try {
    const { userId, roleName, coordinatorCourseId } = req.body;

    if (!userId || !roleName) {
      return res.status(400).json({ error: 'userId and roleName are required' });
    }

    if (roleName === 'coordinator' && !coordinatorCourseId) {
      return res.status(400).json({ error: 'coordinator role requires a coordinatorCourseId' });
    }

    if (roleName === 'coordinator') {
      // ── Primary: store in platform_locks (guaranteed to work) ────────────────
      // Remove any existing coordinator assignment for this user first
      await supabaseAdmin
        .from('platform_locks')
        .delete()
        .eq('entity_type', 'coordinator_assignment')
        .eq('locked_by', userId);

      const { error: lockErr } = await supabaseAdmin
        .from('platform_locks')
        .insert({
          entity_type: 'coordinator_assignment',
          entity_id:   coordinatorCourseId,
          locked_by:   userId,
          is_locked:   true,
        });

      if (lockErr) {
        return res.status(500).json({ error: `Failed to assign coordinator: ${lockErr.message}` });
      }

      // ── Secondary: also update profiles.coordinator_course_id if column exists ──
      // Intentionally ignore errors — column may not exist in older deployments
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ coordinator_course_id: coordinatorCourseId })
          .eq('id', userId);
      } catch (_) {}
    }

    // ── Tertiary: upsert into user_roles if the table/role exists ─────────────
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .maybeSingle();

    if (role) {
      await supabaseAdmin
        .from('user_roles')
        .upsert(
          {
            user_id:               userId,
            role_id:               role.id,
            coordinator_course_id: roleName === 'coordinator' ? coordinatorCourseId : null,
          },
          { onConflict: 'user_id,role_id' }
        );
    }

    // Log to audit_log (best-effort)
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action:   'ASSIGN_ROLE',
        entity:   'profiles',
        context:  { userId, roleName, coordinatorCourseId: coordinatorCourseId ?? null },
      });
    } catch (_) {}

    res.json({ success: true });
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: error.message || 'Failed to assign role' });
  }
}

/**
 * DELETE /api/roles/revoke  (admin only)
 * Remove a specific role from a user.
 * Primary: deletes from platform_locks.
 * Secondary: clears profiles.coordinator_course_id if column exists.
 * Tertiary: removes from user_roles if that table exists.
 */
async function revokeRole(req, res) {
  try {
    const { userId, roleName } = req.body;

    if (!userId || !roleName) {
      return res.status(400).json({ error: 'userId and roleName are required' });
    }

    if (roleName === 'coordinator') {
      // ── Primary: delete from platform_locks ──────────────────────────────────
      const { error: lockErr } = await supabaseAdmin
        .from('platform_locks')
        .delete()
        .eq('entity_type', 'coordinator_assignment')
        .eq('locked_by', userId);

      if (lockErr) {
        return res.status(500).json({ error: lockErr.message || 'Failed to revoke coordinator' });
      }

      // ── Secondary: clear profiles.coordinator_course_id if column exists ──────
      try {
        await supabaseAdmin
          .from('profiles')
          .update({ coordinator_course_id: null })
          .eq('id', userId);
      } catch (_) {}
    }

    // ── Tertiary: remove from user_roles if table exists ──────────────────────
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .maybeSingle();

    if (role) {
      await supabaseAdmin
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role_id', role.id);
    }

    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action:   'REVOKE_ROLE',
        entity:   'profiles',
        context:  { userId, roleName },
      });
    } catch (_) {}

    res.json({ success: true });
  } catch (error) {
    console.error('Error revoking role:', error);
    res.status(500).json({ error: error.message || 'Failed to revoke role' });
  }
}

/**
 * GET /api/roles/coordinators  (admin only)
 * Returns all users who have a coordinator_assignment in platform_locks.
 * Falls back to profiles.coordinator_course_id and user_roles gracefully.
 */
async function getCoordinators(req, res) {
  try {
    // ── Primary: platform_locks ───────────────────────────────────────────────
    const { data: lockRows, error: lockErr } = await supabaseAdmin
      .from('platform_locks')
      .select('locked_by, entity_id')
      .eq('entity_type', 'coordinator_assignment')
      .eq('is_locked', true);

    if (!lockErr && lockRows && lockRows.length > 0) {
      const courseIds = [...new Set(lockRows.map((r) => r.entity_id).filter(Boolean))];
      const { data: courses } = await supabaseAdmin
        .from('courses')
        .select('id, code, name')
        .in('id', courseIds.length > 0 ? courseIds : ['__none__']);
      const courseMap = Object.fromEntries((courses || []).map((c) => [c.id, c]));

      return res.json({
        coordinators: lockRows.map((r) => ({
          userId:     r.locked_by,
          courseId:   r.entity_id,
          courseCode: courseMap[r.entity_id]?.code ?? null,
          courseName: courseMap[r.entity_id]?.name ?? null,
        })),
      });
    }

    // ── Secondary: profiles.coordinator_course_id ────────────────────────────
    const { data: profiles, error: profilesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, coordinator_course_id, courses:coordinator_course_id(id, code, name)')
      .eq('role', 'supervisor')
      .not('coordinator_course_id', 'is', null);

    if (!profilesErr && profiles && profiles.length > 0) {
      return res.json({
        coordinators: profiles.map((p) => ({
          userId:     p.id,
          courseId:   p.coordinator_course_id,
          courseCode: p.courses?.code ?? null,
          courseName: p.courses?.name ?? null,
        })),
      });
    }

    // ── Tertiary: user_roles table ────────────────────────────────────────────
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'coordinator')
      .maybeSingle();

    if (!role) return res.json({ coordinators: [] });

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, coordinator_course_id, courses:coordinator_course_id(id, code, name)')
      .eq('role_id', role.id);

    if (error) return res.json({ coordinators: [] });

    res.json({
      coordinators: (data || []).map((r) => ({
        userId:     r.user_id,
        courseId:   r.coordinator_course_id,
        courseCode: r.courses?.code ?? null,
        courseName: r.courses?.name ?? null,
      })),
    });
  } catch (err) {
    console.error('Error fetching coordinators:', err);
    res.json({ coordinators: [] });
  }
}

/**
 * GET /api/roles/coordinator-info
 * Returns the coordinator course ID (and course details) for the authenticated user.
 * Reads from platform_locks primarily, falls back to profiles.coordinator_course_id.
 */
async function getCoordinatorInfo(req, res) {
  try {
    // ── Primary: platform_locks ───────────────────────────────────────────────
    const { data: lockRow } = await supabaseAdmin
      .from('platform_locks')
      .select('entity_id')
      .eq('entity_type', 'coordinator_assignment')
      .eq('locked_by', req.user.id)
      .eq('is_locked', true)
      .limit(1)
      .maybeSingle();

    let coordinatorCourseId = lockRow?.entity_id ?? null;

    // ── Secondary: profiles.coordinator_course_id ────────────────────────────
    if (!coordinatorCourseId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('coordinator_course_id')
        .eq('id', req.user.id)
        .maybeSingle();
      coordinatorCourseId = profile?.coordinator_course_id ?? null;
    }

    if (!coordinatorCourseId) {
      return res.json({ coordinatorCourseId: null, course: null });
    }

    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('id, code, name')
      .eq('id', coordinatorCourseId)
      .maybeSingle();

    res.json({ coordinatorCourseId, course: course ?? null });
  } catch (err) {
    console.error('Error fetching coordinator info:', err);
    res.json({ coordinatorCourseId: null, course: null });
  }
}

module.exports = { switchRole, getMyRoles, assignRole, revokeRole, getCoordinators, getCoordinatorInfo };
