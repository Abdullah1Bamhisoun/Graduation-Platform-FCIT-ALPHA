const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/groups
 * Admin: list all groups with member count and supervisor name
 */
async function getAllGroups(req, res) {
  try {
    // Step 1: fetch groups (with supervisor join) and group_members separately
    const groupSelect = `
      id, group_code, group_number, department, gender, course_number, project_name,
      project_description, is_locked, status, created_at, supervisor_id
    `;

    let { data: groupData, error: groupError } = await supabaseAdmin
      .from('groups')
      .select(groupSelect)
      .order('group_code', { ascending: true });

    if (groupError) throw groupError;

    // Step 2: fetch all group_members rows
    const { data: membersData, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select('group_id, student_id');

    if (membersError) {
      console.warn('getAllGroups: could not fetch group_members:', membersError.message);
    }

    // Step 3: collect unique student_ids and supervisor_ids, fetch profiles in one query
    const memberRows = membersData || [];
    const studentIds = [...new Set(memberRows.map((m) => m.student_id))];
    const supervisorIds = [...new Set((groupData || []).map((g) => g.supervisor_id).filter(Boolean))];
    const allProfileIds = [...new Set([...studentIds, ...supervisorIds])];

    let profileMap = {};
    if (allProfileIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, name, student_id')
        .in('id', allProfileIds);

      if (profilesError) {
        console.warn('getAllGroups: could not fetch profiles:', profilesError.message);
      } else {
        for (const p of (profilesData || [])) {
          profileMap[p.id] = p;
        }
      }
    }

    // Step 4: build a map of group_id → member rows
    const membersByGroup = {};
    for (const m of memberRows) {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      membersByGroup[m.group_id].push(m);
    }

    const groups = (groupData || []).map((g) => {
      const gMembers = membersByGroup[g.id] || [];
      const supervisor = g.supervisor_id ? profileMap[g.supervisor_id] : null;
      return {
        id: g.id,
        groupCode: g.group_code,
        groupNumber: g.group_number ?? null,
        department: g.department ?? null,
        gender: g.gender ?? null,
        courseNumber: g.course_number ?? null,
        projectName: g.project_name,
        projectDescription: g.project_description,
        isLocked: g.is_locked ?? false,
        status: g.status ?? 'pending',
        supervisorId: supervisor?.id ?? null,
        supervisorName: supervisor?.name ?? null,
        members: gMembers.map((m) => ({
          id: m.student_id,
          name: profileMap[m.student_id]?.name ?? '',
          studentId: profileMap[m.student_id]?.student_id ?? undefined,
        })),
        membersCount: gMembers.length,
        createdAt: g.created_at,
      };
    });

    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
}

/**
 * GET /api/groups/available
 * Public (unauthenticated): return groups for registration dropdown
 * Query params: department, gender, course_number
 */
async function getAvailableGroups(req, res) {
  try {
    const { department, gender, course_number } = req.query;

    // Attempt the richer query with new columns (gender, course_number added in latest migration)
    let richQuery = supabaseAdmin
      .from('groups')
      .select(`id, group_code, group_number, department, project_name, is_locked, status, gender, course_number, members:group_members(student_id)`)
      .order('group_number', { ascending: true, nullsFirst: false });

    if (department) richQuery = richQuery.eq('department', department);
    if (gender) richQuery = richQuery.eq('gender', gender);
    if (course_number) richQuery = richQuery.eq('course_number', course_number);

    const { data: richData, error: richError } = await richQuery;

    if (!richError) {
      // New columns exist — filter to non-rejected groups
      const groups = (richData || [])
        .filter((g) => g.status !== 'rejected')
        .map((g) => ({
          id: g.id,
          groupNumber: g.group_number ?? parseInt(g.group_code?.split('_')[1], 10) ?? null,
          department: g.department ?? null,
          projectName: g.project_name || null,
          isLocked: g.is_locked ?? false,
          status: g.status ?? 'pending',
          gender: g.gender ?? null,
          courseNumber: g.course_number ?? null,
          membersCount: (g.members || []).length,
        }));
      return res.json(groups);
    }

    // Fallback: migration not applied yet — use only existing columns
    let fallbackQuery = supabaseAdmin
      .from('groups')
      .select(`id, group_code, project_name, members:group_members(student_id)`)
      .order('group_code', { ascending: true });

    if (department) fallbackQuery = fallbackQuery.ilike('group_code', `%_${department}%`);

    const { data, error } = await fallbackQuery;
    if (error) throw error;

    const groups = (data || []).map((g, idx) => ({
      id: g.id,
      groupNumber: parseInt(g.group_code?.split('_')[0], 10) || idx + 1,
      department: null,
      projectName: g.project_name || null,
      isLocked: false,
      status: 'pending',
      gender: null,
      courseNumber: null,
      membersCount: (g.members || []).length,
    }));

    res.json(groups);
  } catch (error) {
    console.error('Error fetching available groups:', error);
    res.status(500).json({ error: 'Failed to fetch available groups' });
  }
}

/**
 * POST /api/groups/:id/assign-supervisor
 * Admin only — assign a supervisor to an approved group
 */
async function assignSupervisor(req, res) {
  try {
    const { id: groupId } = req.params;
    const { supervisor_id } = req.body;

    if (!supervisor_id) {
      return res.status(400).json({ error: 'supervisor_id is required' });
    }

    // Verify group exists and is approved
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, status, group_number')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Verify supervisor exists and has correct role + status
    const { data: supervisor, error: supError } = await supabaseAdmin
      .from('profiles')
      .select('id, role, name')
      .eq('id', supervisor_id)
      .single();

    if (supError || !supervisor) {
      return res.status(404).json({ error: 'Supervisor not found' });
    }

    if (supervisor.role !== 'supervisor') {
      return res.status(400).json({ error: 'User is not a supervisor' });
    }

    // Optional: enforce max 5 groups per supervisor
    const { count, error: countError } = await supabaseAdmin
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('supervisor_id', supervisor_id);

    if (!countError && count >= 5) {
      return res.status(400).json({
        error: `${supervisor.name} has already reached the maximum of 5 assigned groups`,
      });
    }

    // Perform assignment
    const { error: updateError } = await supabaseAdmin
      .from('groups')
      .update({ supervisor_id })
      .eq('id', groupId);

    if (updateError) throw updateError;

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: 'ASSIGN_SUPERVISOR',
      entity: 'group',
      context: { groupId, supervisorId: supervisor_id, supervisorName: supervisor.name },
    });

    res.json({ success: true, message: `Supervisor assigned successfully` });
  } catch (error) {
    console.error('Error assigning supervisor:', error);
    res.status(500).json({ error: 'Failed to assign supervisor' });
  }
}

/**
 * PATCH /api/groups/:id/status
 * Admin only — approve or reject a group
 */
async function updateGroupStatus(req, res) {
  try {
    const { id: groupId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const { error } = await supabaseAdmin
      .from('groups')
      .update({ status })
      .eq('id', groupId);

    if (error) throw error;

    await supabaseAdmin.from('audit_log').insert({
      actor_id: req.user.id,
      action: `GROUP_${status.toUpperCase()}`,
      entity: 'group',
      context: { groupId },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating group status:', error);
    res.status(500).json({ error: 'Failed to update group status' });
  }
}

/**
 * DELETE /api/groups/:id
 * Admin only — permanently delete a group and its members
 */
async function deleteGroup(req, res) {
  try {
    const { id: groupId } = req.params;

    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, group_code')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Remove members first to avoid FK violation
    await supabaseAdmin.from('group_members').delete().eq('group_id', groupId);

    const { error } = await supabaseAdmin.from('groups').delete().eq('id', groupId);
    if (error) throw error;

    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action: 'DELETE_GROUP',
        entity: 'group',
        context: { groupId, groupCode: group.group_code },
      });
    } catch { /* non-fatal */ }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: error.message || 'Failed to delete group' });
  }
}

/**
 * PATCH /api/groups/:id
 * Admin only — update project name and/or remove specific members
 */
async function updateGroup(req, res) {
  try {
    const { id: groupId } = req.params;
    const { projectName, removeMemberIds, addMemberIds, removeSupervisor } = req.body;

    const groupUpdates = {};
    if (projectName !== undefined) groupUpdates.project_name = projectName;
    if (removeSupervisor === true) groupUpdates.supervisor_id = null;

    if (Object.keys(groupUpdates).length > 0) {
      const { error } = await supabaseAdmin
        .from('groups')
        .update(groupUpdates)
        .eq('id', groupId);
      if (error) throw error;
    }

    if (Array.isArray(removeMemberIds) && removeMemberIds.length > 0) {
      const { error } = await supabaseAdmin
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .in('student_id', removeMemberIds);
      if (error) throw error;
    }

    if (Array.isArray(addMemberIds) && addMemberIds.length > 0) {
      const rows = addMemberIds.map((student_id) => ({ group_id: groupId, student_id }));
      const { error } = await supabaseAdmin.from('group_members').upsert(rows, { onConflict: 'group_id,student_id' });
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: error.message || 'Failed to update group' });
  }
}

module.exports = { getAllGroups, getAvailableGroups, assignSupervisor, updateGroupStatus, deleteGroup, updateGroup };
