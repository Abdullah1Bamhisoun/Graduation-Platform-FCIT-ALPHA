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

    // Server-side email validation by role
    const email = registration.email.toLowerCase();
    if (registration.account_type === 'student') {
      if (!email.endsWith('@stu.kau.edu.sa')) {
        return res.status(400).json({
          error: 'Student email must end with @stu.kau.edu.sa'
        });
      }
    } else if (registration.account_type === 'supervisor') {
      if (!email.endsWith('@kau.edu.sa') || email.endsWith('@stu.kau.edu.sa')) {
        return res.status(400).json({
          error: 'Supervisor email must end with @kau.edu.sa'
        });
      }
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

    // Upsert the profile — creates it if no DB trigger does so automatically
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        email: registration.email,
        name: registration.name,
        role: registration.account_type === 'student' ? 'student' : 'supervisor',
        student_id: registration.student_id || null,
        employee_number: registration.employee_number || null,
        department: registration.department || null,
      });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
      // Still proceed — auth user was created successfully
    }

    // ── Group assignment (students only) ──────────────────────────────────────
    if (registration.account_type === 'student') {
      const userId = authUser.user.id;
      const dept = registration.department || '';
      const courseNum = (registration.course || '').split('-').pop() || ''; // 'CPCS-498' → '498'
      const gender = registration.gender || 'male';
      const termMap = { First: '01', Second: '02', Summer: '03' };
      const termCode = termMap[registration.term] || '01';
      const year = new Date().getFullYear().toString();
      const genderCode = gender === 'female' ? 'F' : 'M';

      if (registration.project_name) {
        // ── HAS IDEA: auto-create a new group ──────────────────────────────
        // Find the highest existing group_number for this dept+course+gender combo
        const { data: existingGroups, error: numError } = await supabaseAdmin
          .from('groups')
          .select('group_number')
          .eq('department', dept)
          .eq('course_number', courseNum)
          .eq('gender', gender)
          .order('group_number', { ascending: false })
          .limit(1);

        if (!numError) {
          const lastNum = existingGroups?.[0]?.group_number ?? 0;
          if (lastNum >= 50) {
            // Still approve the user but log the overflow
            console.warn(`Group limit reached for ${dept}/${courseNum}/${gender}`);
          } else {
            const nextNum = lastNum + 1;
            const groupCode = `${dept}_${String(nextNum).padStart(2, '0')}_${courseNum}_${year}_${termCode}_${genderCode}`;

            const { data: newGroup, error: groupError } = await supabaseAdmin
              .from('groups')
              .insert({
                group_code: groupCode,
                group_number: nextNum,
                department: dept,
                course_number: courseNum,
                gender,
                project_name: registration.project_name,
                project_description: registration.project_idea || '',
                is_locked: true,
                status: 'pending',
              })
              .select('id')
              .single();

            if (groupError) {
              console.error('Error creating group:', groupError);
            } else {
              await supabaseAdmin.from('group_members').insert({
                group_id: newGroup.id,
                student_id: userId,
              });
            }
          }
        }
      } else if (registration.group_id) {
        // ── NO IDEA: join an existing group ───────────────────────────────
        const { data: group } = await supabaseAdmin
          .from('groups')
          .select('id, gender, members:group_members(student_id)')
          .eq('id', registration.group_id)
          .single();

        if (group) {
          const memberCount = (group.members || []).length;
          if (memberCount < 3) {
            await supabaseAdmin.from('group_members').insert({
              group_id: registration.group_id,
              student_id: userId,
            });
          } else {
            console.warn(`Group ${registration.group_id} is full — student ${userId} not added`);
          }
        }
      }
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
