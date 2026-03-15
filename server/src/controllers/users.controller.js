const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/users?role=student|supervisor|admin
 * Admin only — list profiles, optionally filtered by role
 */
async function listUsers(req, res) {
  try {
    const { role } = req.query;
    const isAdmin = req.user.roles.includes('admin');
    const isCoordinator = req.user.activeRole === 'coordinator';

    // Coordinators must have a course assigned
    if (!isAdmin && isCoordinator && !req.user.coordinatorCourseId) {
      return res.status(403).json({ error: 'No course assigned to your coordinator account' });
    }

    let query = supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, student_id, employee_number, department, gender')
      .order('name');

    if (role) query = query.eq('role', role);

    // Coordinators only see students in their course.
    // Supervisor/admin profiles are platform-wide and must not be scoped.
    // Apply whenever the result could include students (role=student or no role filter).
    if (!isAdmin && isCoordinator && (!role || role === 'student')) {
      const { data: groups } = await supabaseAdmin
        .from('groups')
        .select('id')
        .eq('course_id', req.user.coordinatorCourseId);

      const groupIds = (groups || []).map((g) => g.id);

      const { data: members } = groupIds.length > 0
        ? await supabaseAdmin.from('group_members').select('student_id').in('group_id', groupIds)
        : { data: [] };

      const studentIds = (members || []).map((m) => m.student_id).filter(Boolean);

      if (role === 'student') {
        // Requested students only — return empty if none in course
        if (studentIds.length === 0) return res.json([]);
        query = query.in('id', studentIds);
      } else {
        // No role filter — exclude students not in this course
        if (studentIds.length > 0) {
          query = query.or(`role.neq.student,id.in.(${studentIds.join(',')})`);
        } else {
          query = query.neq('role', 'student');
        }
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    // Fetch all user_roles in one query to avoid N+1
    const userIds = (data || []).map((p) => p.id);
    let rolesMap = {};
    if (userIds.length > 0) {
      const { data: userRolesData } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, coordinator_course_id, roles(name)')
        .in('user_id', userIds);

      for (const ur of (userRolesData || [])) {
        const uid = ur.user_id;
        if (!rolesMap[uid]) rolesMap[uid] = [];
        if (ur.roles?.name) rolesMap[uid].push(ur.roles.name);
      }
    }

    res.json((data || []).map((p) => {
      const roles = rolesMap[p.id]?.length > 0 ? rolesMap[p.id] : [p.role];
      return {
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        roles,
        activeRole: p.role,
        studentId: p.student_id ?? undefined,
        employeeNumber: p.employee_number ?? undefined,
        department: p.department ?? undefined,
        gender: p.gender ?? undefined,
      };
    }));
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

/**
 * DELETE /api/users/:id
 * Admin only — permanently delete a user (auth + profile)
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    // Verify the target user exists
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, role, email')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Coordinators cannot delete admin users
    const isCoordinatorOnly = req.user.roles.includes('coordinator') && !req.user.roles.includes('admin');
    if (isCoordinatorOnly && profile.role === 'admin') {
      return res.status(403).json({ error: 'Coordinators cannot delete admin users' });
    }

    // Delete from Supabase Auth (cascades to profile via DB trigger if configured)
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) throw authError;

    // Also delete profile row directly in case there is no cascade
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    // Remove pending_registrations record so the email can be re-used
    await supabaseAdmin.from('pending_registrations').delete().eq('email', profile.email);

    // Audit log (non-fatal)
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action: 'DELETE_USER',
        entity: 'profile',
        context: { deletedUserId: id, deletedUserName: profile.name, role: profile.role },
      });
    } catch { /* non-fatal */ }

    res.json({ success: true, message: `User ${profile.name} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
}

module.exports = { listUsers, deleteUser };
