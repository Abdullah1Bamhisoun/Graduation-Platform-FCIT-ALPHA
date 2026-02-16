const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/users?role=student|supervisor|admin
 * Admin only — list profiles, optionally filtered by role
 */
async function listUsers(req, res) {
  try {
    const { role } = req.query;
    let query = supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, student_id, employee_number, department, gender')
      .order('name');

    if (role) query = query.eq('role', role);

    const { data, error } = await query;
    if (error) throw error;

    res.json((data || []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      studentId: p.student_id ?? undefined,
      employeeNumber: p.employee_number ?? undefined,
      department: p.department ?? undefined,
      gender: p.gender ?? undefined,
    })));
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
