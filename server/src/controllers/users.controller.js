const { supabaseAdmin } = require('../config/supabase');

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
      .select('id, name, role')
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

    // Audit log (non-fatal)
    await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: 'DELETE_USER',
      entity: 'profile',
      context: { deletedUserId: id, deletedUserName: profile.name, role: profile.role },
    }).catch(() => {});

    res.json({ success: true, message: `User ${profile.name} deleted successfully` });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Failed to delete user' });
  }
}

module.exports = { deleteUser };
