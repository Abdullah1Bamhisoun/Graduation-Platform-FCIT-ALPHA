const { supabaseAdmin, supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

/**
 * Approve a pending registration and create a Supabase Auth user
 */
async function approveRegistration(req, res) {
  try {
    const { registrationId } = req.body;

    if (!registrationId) {
      return res.status(400).json({ error: 'Registration ID is required' });
    }

    // Fetch the pending registration
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        error: `Registration has already been ${registration.status}`
      });
    }

    // Create user in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: registration.email,
      password: registration.password_hash, // Use the stored password
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name: registration.name,
        role: registration.account_type === 'student' ? 'student' : 'supervisor',
      }
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return res.status(500).json({
        error: 'Failed to create user account',
        details: authError.message
      });
    }

    // Update the profile with additional details
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        name: registration.name,
        role: registration.account_type === 'student' ? 'student' : 'supervisor',
        student_id: registration.student_id,
        employee_number: registration.employee_number,
        department: registration.department,
      })
      .eq('id', authUser.user.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // Don't fail the request, profile will be auto-created by trigger
    }

    // Update registration status
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'approved',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Error updating registration:', updateError);
    }

    // Log the action in audit log
    await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: 'APPROVE_REGISTRATION',
      entity: 'registration',
      context: {
        registrationId,
        email: registration.email,
        accountType: registration.account_type,
      }
    });

    res.json({
      success: true,
      message: 'Registration approved successfully',
      userId: authUser.user.id,
    });
  } catch (error) {
    console.error('Error approving registration:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
}

/**
 * Reject a pending registration
 */
async function rejectRegistration(req, res) {
  try {
    const { registrationId } = req.body;

    if (!registrationId) {
      return res.status(400).json({ error: 'Registration ID is required' });
    }

    // Fetch the pending registration
    const { data: registration, error: fetchError } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('id', registrationId)
      .single();

    if (fetchError || !registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    if (registration.status !== 'pending') {
      return res.status(400).json({
        error: `Registration has already been ${registration.status}`
      });
    }

    // Update registration status
    const { error: updateError } = await supabaseAdmin
      .from('pending_registrations')
      .update({
        status: 'rejected',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', registrationId);

    if (updateError) {
      console.error('Error updating registration:', updateError);
      return res.status(500).json({ error: 'Failed to reject registration' });
    }

    // Log the action in audit log
    await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: 'REJECT_REGISTRATION',
      entity: 'registration',
      context: {
        registrationId,
        email: registration.email,
        accountType: registration.account_type,
      }
    });

    res.json({
      success: true,
      message: 'Registration rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
}

module.exports = {
  approveRegistration,
  rejectRegistration,
};
