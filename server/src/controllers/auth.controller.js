const { supabaseAdmin, supabase } = require('../config/supabase');
const bcrypt = require('bcryptjs');

/**
 * POST /api/auth/submit-registration
 * Public — insert a new pending registration, clearing any stale approved/rejected record first
 */
async function submitRegistration(req, res) {
  try {
    const {
      accountType, name, email, department, gender,
      studentId, course, courseId, term, groupId, projectName, projectIdea,
      teammateSubmittedIdea, employeeNumber,
    } = req.body;

    if (!email || !name || !accountType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Block if account already exists in profiles
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in instead.' });
    }

    // Check if a pending registration already exists — block re-submission while waiting
    const { data: existing } = await supabaseAdmin
      .from('pending_registrations')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();

    if (existing?.status === 'pending') {
      return res.status(409).json({ error: 'A registration request with this email is already pending. Please wait for admin approval.' });
    }

    // Remove any stale approved/rejected record so the email can be re-used
    if (existing) {
      await supabaseAdmin.from('pending_registrations').delete().eq('email', email);
    }

    const { error } = await supabaseAdmin.from('pending_registrations').insert({
      account_type: accountType,
      name,
      email,
      department: department || null,
      gender: gender || null,
      student_id: studentId || null,
      course: course || null,
      course_id: courseId || null,
      term: term || null,
      group_id: groupId || null,
      project_name: projectName || null,
      project_idea: projectIdea || null,
      teammate_submitted_idea: teammateSubmittedIdea ?? false,
      employee_number: employeeNumber || null,
      status: 'pending',
    });

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting registration:', error);
    res.status(500).json({ error: error.message || 'Failed to submit registration' });
  }
}

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

    // Coordinator scope check — coordinator can approve their own course's students and any supervisor
    if (req.user.activeRole === 'coordinator') {
      if (!req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
      if (registration.account_type !== 'supervisor' && registration.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only approve registrations for your assigned course' });
      }
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

    // Look up existing auth user created during registration
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      return res.status(500).json({ error: 'Failed to look up user account' });
    }

    const existingUser = users.find(u => u.email?.toLowerCase() === registration.email.toLowerCase());
    if (!existingUser) {
      return res.status(404).json({ error: 'User account not found. The user may not have completed registration.' });
    }

    const authUser = { user: existingUser };

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
        gender: registration.gender || null,
      });

    if (profileError) {
      console.error('Error upserting profile:', profileError);
      // Still proceed — auth user was created successfully
    }

    // ── Insert into user_roles table ─────────────────────────────────────────
    const roleName = registration.account_type === 'student' ? 'student' : 'supervisor';
    const { data: roleRow } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .maybeSingle();

    if (roleRow) {
      await supabaseAdmin
        .from('user_roles')
        .upsert(
          { user_id: authUser.user.id, role_id: roleRow.id, coordinator_course_id: null },
          { onConflict: 'user_id,role_id' }
        );
    }

    // ── Group assignment (students only) ──────────────────────────────────────
    if (registration.account_type === 'student') {
      const userId = authUser.user.id;
      const termMap = { First: '01', Second: '02', Summer: '03' };
      const termCode = termMap[registration.term] || '01';
      const year = new Date().getFullYear().toString();

      // Resolve course_id for group scope (prefer UUID, fallback to code lookup)
      let resolvedCourseId = registration.course_id || null;
      if (!resolvedCourseId && registration.course) {
        const { data: courseRow } = await supabaseAdmin
          .from('courses')
          .select('id')
          .eq('code', registration.course)
          .maybeSingle();
        resolvedCourseId = courseRow?.id || null;
      }

      if (registration.project_name) {
        // ── HAS IDEA: auto-create a new group ──────────────────────────────
        // Find the highest existing group_number for this course
        let groupQuery = supabaseAdmin
          .from('groups')
          .select('group_number')
          .order('group_number', { ascending: false })
          .limit(1);

        if (resolvedCourseId) {
          groupQuery = groupQuery.eq('course_id', resolvedCourseId);
        }

        const { data: existingGroups, error: numError } = await groupQuery;

        if (!numError) {
          const lastNum = existingGroups?.[0]?.group_number ?? 0;
          if (lastNum >= 50) {
            console.warn(`Group limit reached for course ${resolvedCourseId}`);
          } else {
            const nextNum = lastNum + 1;

            // New group code format: DEPT_SECTION_COURSENUM_YEAR_GROUPNUM_GENDER
            // Example: IS_13_499_2026_01_M
            // Section defaults to term code (01/02/03) for auto-created groups
            const dept        = (registration.department || 'IS').toUpperCase();
            const section     = termCode; // e.g. '01', '02', '03'
            const courseNum   = (registration.course || '000').replace(/[^0-9]/g, '').slice(-3);
            const groupNum    = String(nextNum).padStart(2, '0');
            const genderCode  = registration.gender === 'male' ? 'M' : registration.gender === 'female' ? 'F' : 'U';
            const groupCode   = `${dept}_${section}_${courseNum}_${year}_${groupNum}_${genderCode}`;

            const { data: newGroup, error: groupError } = await supabaseAdmin
              .from('groups')
              .insert({
                group_code: groupCode,
                group_number: nextNum,
                course_id: resolvedCourseId,
                course_number: courseNum || null,
                department: registration.department || null,
                gender: registration.gender || null,
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
              const { error: memberInsertError } = await supabaseAdmin.from('group_members').insert({
                group_id: newGroup.id,
                student_id: userId,
              });
              if (memberInsertError) {
                console.error(`approveRegistration: failed to add student ${userId} to new group ${newGroup.id}:`, memberInsertError.message);
              }
            }
          }
        }
      } else if (registration.group_id) {
        // ── NO IDEA: join an existing group selected during registration ──
        const { data: group, error: groupLookupError } = await supabaseAdmin
          .from('groups')
          .select('id, members:group_members(student_id)')
          .eq('id', registration.group_id)
          .single();

        if (groupLookupError || !group) {
          console.error(`approveRegistration: group ${registration.group_id} not found for student ${userId}:`, groupLookupError?.message);
        } else {
          const memberCount = (group.members || []).length;
          if (memberCount >= 3) {
            console.warn(`approveRegistration: group ${registration.group_id} is full (${memberCount}/3) — student ${userId} not added`);
          } else {
            // Guard against duplicate membership (avoids unique-constraint violations)
            const alreadyMember = (group.members || []).some((m) => m.student_id === userId);
            if (alreadyMember) {
              console.warn(`approveRegistration: student ${userId} is already a member of group ${registration.group_id}`);
            } else {
              const { error: memberInsertError } = await supabaseAdmin.from('group_members').insert({
                group_id: registration.group_id,
                student_id: userId,
              });
              if (memberInsertError) {
                console.error(`approveRegistration: failed to add student ${userId} to group ${registration.group_id}:`, memberInsertError.message);
              }
            }
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

    // Log the action in audit log (non-fatal if table missing)
    const { error: auditLogError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: 'APPROVE_REGISTRATION',
      entity: 'registration',
      context: {
        registrationId,
        email: registration.email,
        accountType: registration.account_type,
      }
    });
    if (auditLogError) console.error('Error inserting audit log:', auditLogError);

    // Record in approvals table
    const { error: approvalInsertError } = await supabaseAdmin.from('approvals').insert({
      registration_id: registrationId,
      reviewed_by: req.user.id,
      status: 'approved',
      course_id: registration.course_id || null,
    });
    if (approvalInsertError) console.error('Error inserting approval record:', approvalInsertError);

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

    // Coordinator scope check — coordinator can reject their own course's students and any supervisor
    if (req.user.activeRole === 'coordinator') {
      if (!req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
      if (registration.account_type !== 'supervisor' && registration.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only reject registrations for your assigned course' });
      }
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

    // Delete the Supabase auth user created during registration
    try {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const authUser = users.find(u => u.email?.toLowerCase() === registration.email.toLowerCase());
      if (authUser) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.id);
      }
    } catch (deleteErr) {
      console.error('Failed to delete auth user on rejection:', deleteErr.message);
      // Non-fatal — registration is already marked rejected
    }

    // Log the action in audit log (non-fatal if table missing)
    const { error: rejectAuditError } = await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: 'REJECT_REGISTRATION',
      entity: 'registration',
      context: {
        registrationId,
        email: registration.email,
        accountType: registration.account_type,
      }
    });
    if (rejectAuditError) console.error('Error inserting audit log:', rejectAuditError);

    // Record in approvals table
    const { error: rejectionInsertError } = await supabaseAdmin.from('approvals').insert({
      registration_id: registrationId,
      reviewed_by: req.user.id,
      status: 'rejected',
      course_id: registration.course_id || null,
    });
    if (rejectionInsertError) console.error('Error inserting rejection record:', rejectionInsertError);

    res.json({
      success: true,
      message: 'Registration rejected successfully',
    });
  } catch (error) {
    console.error('Error rejecting registration:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
}

/**
 * POST /api/auth/repair-groups
 * Admin only — retroactively assigns missing groups for already-approved students.
 * Handles both paths:
 *   1. Student submitted a project idea → create a new group for them
 *   2. Student selected an existing group (group_id) → add them to that group
 * Safe to call multiple times (skips students already in a group).
 */
async function repairGroups(req, res) {
  try {
    // Fetch ALL approved student registrations
    const { data: approvedRegs, error: fetchErr } = await supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .eq('status', 'approved')
      .eq('account_type', 'student');

    if (fetchErr) throw fetchErr;

    let created = 0;
    let assigned = 0;
    let skipped = 0;

    for (const reg of (approvedRegs || [])) {
      // Find the student's profile by email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', reg.email)
        .maybeSingle();

      if (!profile) { skipped++; continue; }

      // Check if the student is already in a group — skip if so
      const { data: existing } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('student_id', profile.id)
        .maybeSingle();

      if (existing) { skipped++; continue; }

      // ── PATH 1: student selected an existing group (no idea) ─────────────
      if (reg.group_id && !reg.project_name) {
        const { data: group, error: groupLookupErr } = await supabaseAdmin
          .from('groups')
          .select('id, members:group_members(student_id)')
          .eq('id', reg.group_id)
          .single();

        if (groupLookupErr || !group) {
          console.error(`repairGroups: group ${reg.group_id} not found for ${reg.email}`);
          skipped++;
          continue;
        }

        const memberCount = (group.members || []).length;
        if (memberCount >= 3) {
          console.warn(`repairGroups: group ${reg.group_id} is full — cannot add ${reg.email}`);
          skipped++;
          continue;
        }

        const { error: insertErr } = await supabaseAdmin.from('group_members').insert({
          group_id: reg.group_id,
          student_id: profile.id,
        });

        if (insertErr) {
          console.error(`repairGroups: failed to add ${reg.email} to group ${reg.group_id}:`, insertErr.message);
          skipped++;
        } else {
          assigned++;
        }
        continue;
      }

      // ── PATH 2: student submitted a project idea → create new group ──────
      if (!reg.project_name) { skipped++; continue; }

      // Resolve course_id
      let resolvedCourseId = reg.course_id || null;
      if (!resolvedCourseId && reg.course) {
        const { data: courseRow } = await supabaseAdmin
          .from('courses')
          .select('id')
          .eq('code', reg.course)
          .maybeSingle();
        resolvedCourseId = courseRow?.id || null;
      }

      // Find next group_number for this course
      let numQuery = supabaseAdmin
        .from('groups')
        .select('group_number')
        .order('group_number', { ascending: false })
        .limit(1);
      if (resolvedCourseId) {
        numQuery = numQuery.eq('course_id', resolvedCourseId);
      }
      const { data: existingGroups } = await numQuery;
      const lastNum = existingGroups?.[0]?.group_number ?? 0;
      if (lastNum >= 50) { skipped++; continue; }

      const nextNum = lastNum + 1;
      const termMap = { First: '01', Second: '02', Summer: '03' };
      const termCode = termMap[reg.term] || '01';
      const year = new Date(reg.submitted_at || Date.now()).getFullYear().toString();
      const courseCode = (reg.course || 'GRP').replace(/[^A-Z0-9]/gi, '');
      const groupCode = `${courseCode}_${String(nextNum).padStart(2, '0')}_${year}_${termCode}`;

      const { data: newGroup, error: groupErr } = await supabaseAdmin
        .from('groups')
        .insert({
          group_code: groupCode,
          group_number: nextNum,
          course_id: resolvedCourseId,
          course_number: (reg.course || '').split('-').pop() || null,
          department: reg.department || null,
          gender: reg.gender || null,
          project_name: reg.project_name,
          project_description: reg.project_idea || '',
          is_locked: true,
          status: 'pending',
        })
        .select('id')
        .single();

      if (groupErr) {
        console.error(`repairGroups: failed to create group for ${reg.email}:`, groupErr.message);
        skipped++;
        continue;
      }

      const { error: memberErr } = await supabaseAdmin.from('group_members').insert({
        group_id: newGroup.id,
        student_id: profile.id,
      });

      if (memberErr) {
        console.error(`repairGroups: failed to add ${reg.email} to new group ${newGroup.id}:`, memberErr.message);
        skipped++;
      } else {
        created++;
      }
    }

    res.json({ success: true, created, assigned, skipped });
  } catch (error) {
    console.error('Error repairing groups:', error);
    res.status(500).json({ error: 'Failed to repair groups' });
  }
}

/**
 * GET /api/auth/pending-registrations
 * Admin: all registrations. Coordinator: scoped to their course_id.
 */
async function listRegistrations(req, res) {
  try {
    const { status } = req.query; // optional filter: pending|approved|rejected
    const isAdmin = req.user.roles.includes('admin');
    const isCoordinator = req.user.activeRole === 'coordinator' && req.user.coordinatorCourseId;

    let query = supabaseAdmin
      .from('pending_registrations')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (status) query = query.eq('status', status);

    if (!isAdmin && isCoordinator) {
      // Coordinators see student registrations for their course AND all supervisor registrations
      query = query.or(`course_id.eq.${req.user.coordinatorCourseId},account_type.eq.supervisor`);
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Error listing registrations:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
}

module.exports = {
  submitRegistration,
  approveRegistration,
  rejectRegistration,
  listRegistrations,
  repairGroups,
};
