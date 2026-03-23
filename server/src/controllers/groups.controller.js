const { supabaseAdmin } = require('../config/supabase');
const emailService = require('../services/email.service');

/**
 * GET /api/groups
 * Admin: list all groups with member count and supervisor name
 */
async function getAllGroups(req, res) {
  try {
    // Step 1: fetch groups (with supervisor join) and group_members separately
    const groupSelect = `
      id, group_code, group_number, department, gender, course_number, project_name,
      project_description, is_locked, status, created_at, supervisor_id, course_id
    `;

    let query = supabaseAdmin
      .from('groups')
      .select(groupSelect)
      .order('group_code', { ascending: true });

    // Coordinators can only view groups in their assigned course
    if (req.user.activeRole === 'coordinator' && req.user.coordinatorCourseId) {
      query = query.eq('course_id', req.user.coordinatorCourseId);
    }

    const { from, to } = req.pagination;
    let { data: groupData, error: groupError } = await query.range(from, to);

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
        courseId: g.course_id ?? null,
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
    const { department, gender, course_number, course_id } = req.query;

    // Attempt the richer query with new columns (gender, course_number added in latest migration)
    let richQuery = supabaseAdmin
      .from('groups')
      .select(`id, group_code, group_number, department, project_name, is_locked, status, gender, course_number, course_id, members:group_members(student_id)`)
      .order('group_number', { ascending: true, nullsFirst: false });

    if (course_id)    richQuery = richQuery.eq('course_id', course_id);
    if (department)   richQuery = richQuery.eq('department', department);
    if (gender)       richQuery = richQuery.eq('gender', gender);
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
      .select('id, status, group_number, course_id')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Coordinator scope check
    if (!req.user.roles.includes('admin') && req.user.coordinatorCourseId) {
      if (group.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only assign supervisors to groups in your assigned course' });
      }
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

    // Coordinator scope check — can only update groups in their course
    if (!req.user.roles.includes('admin') && req.user.coordinatorCourseId) {
      const { data: group } = await supabaseAdmin
        .from('groups')
        .select('course_id')
        .eq('id', groupId)
        .maybeSingle();
      if (!group || group.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only update groups in your assigned course' });
      }
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
      .select('id, group_code, course_id')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Coordinator scope check
    if (!req.user.roles.includes('admin') && req.user.coordinatorCourseId) {
      if (group.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only delete groups in your assigned course' });
      }
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
    res.status(500).json({ error: 'Failed to delete group' });
  }
}

/**
 * PATCH /api/groups/:id
 * Admin only — update project name and/or remove specific members
 */
async function updateGroup(req, res) {
  try {
    const { id: groupId } = req.params;
    const { projectName, removeMemberIds, addMemberIds, removeSupervisor, gender } = req.body;

    // Coordinator scope check
    if (!req.user.roles.includes('admin') && req.user.coordinatorCourseId) {
      const { data: grp } = await supabaseAdmin.from('groups').select('course_id').eq('id', groupId).maybeSingle();
      if (!grp || grp.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only edit groups in your assigned course' });
      }
    }

    const groupUpdates = {};
    if (projectName !== undefined) groupUpdates.project_name = projectName;
    if (removeSupervisor === true) groupUpdates.supervisor_id = null;
    if (gender !== undefined) {
      const genderCode = gender === 'male' ? 'M' : gender === 'female' ? 'F' : 'U';
      groupUpdates.gender = gender || null;
      // Regenerate group_code: replace last segment (gender code)
      const { data: existing } = await supabaseAdmin.from('groups').select('group_code').eq('id', groupId).maybeSingle();
      if (existing?.group_code) {
        const parts = existing.group_code.split('_');
        parts[parts.length - 1] = genderCode;
        groupUpdates.group_code = parts.join('_');
      }
    }

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
    res.status(500).json({ error: 'Failed to update group' });
  }
}

/**
 * POST /api/groups
 * Admin or coordinator — create a new group manually.
 * Coordinator: courseId is forced to their coordinatorCourseId.
 */
async function createGroup(req, res) {
  try {
    const { projectName, projectDescription, department, gender, sectionNumber } = req.body;
    let { courseId } = req.body;

    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const isAdmin = req.user.roles.includes('admin');

    // Coordinator: scope to their course
    if (!isAdmin) {
      if (!req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
      courseId = req.user.coordinatorCourseId;
    }

    if (!courseId) {
      return res.status(400).json({ error: 'Course is required' });
    }

    // Look up course code for generating group_code
    const { data: course } = await supabaseAdmin
      .from('courses')
      .select('code')
      .eq('id', courseId)
      .maybeSingle();

    // Find next group_number for this course
    const { data: existing } = await supabaseAdmin
      .from('groups')
      .select('group_number')
      .eq('course_id', courseId)
      .order('group_number', { ascending: false })
      .limit(1);

    const lastNum = existing?.[0]?.group_number ?? 0;
    if (lastNum >= 50) {
      return res.status(400).json({ error: 'Group limit (50) reached for this course' });
    }

    const nextNum = lastNum + 1;
    const now = new Date();
    const year = now.getFullYear().toString();

    // New group code format: DEPT_SECTION_COURSENUM_YEAR_GROUPNUM_GENDER
    // Example: IS_13_499_2026_01_M
    const dept        = (department || 'IS').toUpperCase();
    const section     = String(sectionNumber || 1).padStart(2, '0');
    const courseNum   = (course?.code || '000').replace(/[^0-9]/g, '').slice(-3);
    const groupNum    = String(nextNum).padStart(2, '0');
    const genderCode  = gender === 'male' ? 'M' : gender === 'female' ? 'F' : 'U';
    const groupCode   = `${dept}_${section}_${courseNum}_${year}_${groupNum}_${genderCode}`;

    const { data: newGroup, error: insertErr } = await supabaseAdmin
      .from('groups')
      .insert({
        group_code: groupCode,
        group_number: nextNum,
        course_id: courseId,
        course_number: courseNum || null,
        department: department || null,
        gender: gender || null,
        project_name: projectName,
        project_description: projectDescription || '',
        is_locked: false,
        status: 'pending',
      })
      .select('id, group_code, group_number')
      .single();

    if (insertErr) throw insertErr;

    // Audit log (non-fatal)
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action: 'CREATE_GROUP',
        entity: 'group',
        context: { groupId: newGroup.id, groupCode: newGroup.group_code, courseId },
      });
    } catch { /* non-fatal */ }

    res.json({ success: true, group: newGroup });
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
}

/**
 * GET /api/groups/supervisor-grades
 *
 * Supervisor-only. Returns grade data for every group assigned to the requesting
 * supervisor — enforced at the DB level via supervisor_id filter.
 *
 * For each group the response includes:
 *  - Basic group metadata (number, project name, course, project_status)
 *  - Students list
 *  - Coordinator grading components (from grading_components table — read-only, Coordinator-owned)
 *  - Coordinator deliverable scores (coordinator_deliverable_scores)
 *  - This supervisor's evaluation total (supervisor_assessments)
 *  - Per-criterion rubric scores submitted by this supervisor (supervisor_rubric_scores)
 *  - Chapter submission approval counts
 *  - Weekly progress marks
 *
 * Grading weights/scheme come from grading_components and are NEVER hardcoded here.
 * The Coordinator retains exclusive edit rights over the scheme.
 */
async function getSupervisorGroupsWithGrades(req, res) {
  try {
    const supervisorId = req.user.id;

    // ── Step 1: Groups assigned to this supervisor ──────────────────────────
    const { data: groupsRaw, error: gError } = await supabaseAdmin
      .from('groups')
      .select(`
        id, group_number, group_code, project_name, status, course_id,
        project_status, ip_marked_by, ip_marked_at, ip_reason,
        course:courses!course_id(id, code, name),
        members:group_members(
          student_id,
          student:profiles!student_id(id, name)
        )
      `)
      .eq('supervisor_id', supervisorId)
      .order('group_number', { ascending: true });

    if (gError) {
      // Graceful fallback if project_status columns haven't been migrated yet
      if (gError.message && gError.message.includes('project_status')) {
        console.warn('project_status column missing — run migration 003. Falling back to basic select.');
        const { data: fallback, error: fbErr } = await supabaseAdmin
          .from('groups')
          .select(`
            id, group_number, group_code, project_name, status, course_id,
            course:courses!course_id(id, code, name),
            members:group_members(
              student_id,
              student:profiles!student_id(id, name)
            )
          `)
          .eq('supervisor_id', supervisorId)
          .order('group_number', { ascending: true });

        if (fbErr) throw fbErr;
        // Patch missing fields
        for (const g of fallback || []) {
          g.project_status = 'normal';
          g.ip_marked_by = null;
          g.ip_marked_at = null;
          g.ip_reason = null;
        }
        return buildGradesResponse(res, fallback || [], supervisorId);
      }
      throw gError;
    }

    return buildGradesResponse(res, groupsRaw || [], supervisorId);
  } catch (error) {
    console.error('Error fetching supervisor group grades:', error);
    res.status(500).json({ error: 'Failed to fetch group grades' });
  }
}

/** Shared assembly logic — separated so the fallback path can reuse it. */
async function buildGradesResponse(res, groupsRaw, supervisorId) {
  if (!groupsRaw.length) return res.json([]);

  const groupIds   = groupsRaw.map((g) => g.id);
  // courseIds reserved for future use

  // ── Steps 2–7: All independent — fetch in parallel ───────────────────────
  const [
    { data: components },
    { data: delivScores },
    { data: supAssessments },
    { data: rubricScores },
    { data: submissions },
    { data: weeklyReports },
  ] = await Promise.all([
    supabaseAdmin
      .from('grading_components')
      .select('course_type, component_key, component_name, total_marks, evaluator_role, display_order')
      .eq('is_active', true)
      .order('display_order'),
    supabaseAdmin
      .from('coordinator_deliverable_scores')
      .select('group_id, course_id, deliverable_key, score, max_score, graded_at')
      .in('group_id', groupIds),
    supabaseAdmin
      .from('supervisor_assessments')
      .select('student_id, group_id, course_id, score, max_score, graded_at, submission_status')
      .in('group_id', groupIds),
    supabaseAdmin
      .from('supervisor_rubric_scores')
      .select('student_id, group_id, course_id, criterion_key, raw_score, submission_status, graded_at')
      .eq('graded_by', supervisorId)
      .in('group_id', groupIds),
    supabaseAdmin
      .from('submissions')
      .select('group_id, status')
      .in('group_id', groupIds),
    supabaseAdmin
      .from('weekly_reports')
      .select('group_id, student_mark, supervisor_mark')
      .in('group_id', groupIds),
  ]);

  // ── Assemble ──────────────────────────────────────────────────────────────
  const result = groupsRaw.map((g) => {
    const courseCode = g.course?.code ?? '';
    const courseType = courseCode.includes('499') ? '499' : '498';
    const courseId   = g.course_id;

    const students = (g.members || []).map((m) => ({
      id:   m.student?.id   ?? m.student_id,
      name: m.student?.name ?? '',
    }));

    // Coordinator deliverables
    const groupDelivs = (delivScores || []).filter(
      (d) => d.group_id === g.id && d.course_id === courseId
    );
    const delivMap = {};
    for (const d of groupDelivs) delivMap[d.deliverable_key] = {
      score:    Number(d.score),
      maxScore: Number(d.max_score),
      gradedAt: d.graded_at,
    };
    const deliverablesTotal = groupDelivs.reduce((s, d) => s + Number(d.score), 0);

    // Supervisor assessment totals
    const groupAssessments = (supAssessments || []).filter(
      (a) => a.group_id === g.id && a.course_id === courseId
    );
    const supervisorEval = groupAssessments.map((a) => ({
      studentId:        a.student_id,
      score:            a.score != null ? Number(a.score) : null,
      maxScore:         Number(a.max_score),
      gradedAt:         a.graded_at,
      submissionStatus: a.submission_status ?? 'draft',
    }));

    // Total supervisor score (average across students if multiple)
    const supScoreValues = supervisorEval.map((e) => e.score).filter((s) => s != null);
    const supervisorTotalScore = supScoreValues.length
      ? supScoreValues.reduce((s, v) => s + v, 0) / supScoreValues.length
      : null;
    const supervisorMaxScore = supervisorEval[0]?.maxScore ?? (courseType === '499' ? 23 : 20);

    // Per-criterion rubric scores
    const groupRubric = (rubricScores || []).filter((r) => r.group_id === g.id);

    // Submissions / approvals
    const groupSubs = (submissions || []).filter((s) => s.group_id === g.id);
    const approvalCounts = {
      total:    groupSubs.length,
      pending:  groupSubs.filter((s) => ['submitted', 'under-review'].includes(s.status)).length,
      approved: groupSubs.filter((s) => s.status === 'approved').length,
      rejected: groupSubs.filter((s) => s.status === 'changes-requested').length,
    };

    // Weekly marks
    const groupWeekly = (weeklyReports || []).filter((r) => r.group_id === g.id);
    const weeklyScore = groupWeekly.reduce(
      (s, r) => s + (r.student_mark ?? 0) + (r.supervisor_mark ?? 0),
      0
    );

    // Grade components for this course (Coordinator-defined — never hardcoded)
    const courseComponents = (components || [])
      .filter((c) => c.course_type === courseType)
      .sort((a, b) => a.display_order - b.display_order)
      .map((c) => ({
        componentKey:  c.component_key,
        componentName: c.component_name,
        totalMarks:    Number(c.total_marks),
        evaluatorRole: c.evaluator_role,
        // Attach the score this supervisor can see for each component
        score:
          c.component_key === 'supervisor_eval'     ? supervisorTotalScore
          : c.component_key === 'coordinator_deliverables' ? deliverablesTotal
          : c.component_key === 'progress_reports'  ? weeklyScore
          : null,
        maxScore:
          c.component_key === 'supervisor_eval'            ? supervisorMaxScore
          : c.component_key === 'coordinator_deliverables' ? Number(c.total_marks)
          : c.component_key === 'progress_reports'         ? Number(c.total_marks)
          : Number(c.total_marks),
      }));

    return {
      id:            g.id,
      groupNumber:   g.group_number,
      groupCode:     g.group_code ?? null,
      projectName:   g.project_name,
      status:        g.status,
      projectStatus: g.project_status ?? 'normal',
      ipMarkedAt:    g.ip_marked_at   ?? null,
      ipReason:      g.ip_reason      ?? null,
      courseCode,
      courseType,
      courseId,
      students,
      components:    courseComponents,
      coordinatorDeliverables: delivMap,
      deliverablesTotal,
      supervisorEvaluation:   supervisorEval,
      supervisorTotalScore,
      supervisorMaxScore,
      rubricScores:  groupRubric.map((r) => ({
        studentId:        r.student_id,
        criterionKey:     r.criterion_key,
        rawScore:         r.raw_score,
        submissionStatus: r.submission_status,
        gradedAt:         r.graded_at,
      })),
      weeklyScore,
      approvalCounts,
    };
  });

  res.json(result);
}

/**
 * PATCH /api/groups/:id/project-status
 *
 * Supervisor-only. Marks (or un-marks) a group's project as IP (In Progress).
 * Backend validates supervisor ownership before updating.
 * The action is recorded in the audit_log table.
 *
 * Body: { status: 'ip' | 'normal', reason?: string }
 */
async function markGroupAsIP(req, res) {
  try {
    const { id: groupId } = req.params;
    const { status, reason } = req.body;

    if (!['ip', 'normal'].includes(status)) {
      return res.status(400).json({ error: 'status must be "ip" or "normal"' });
    }

    // Fetch group to validate ownership
    const { data: group, error: gError } = await supabaseAdmin
      .from('groups')
      .select('id, supervisor_id, project_name, group_number')
      .eq('id', groupId)
      .single();

    if (gError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Backend ownership check — only the assigned supervisor (or admin) may set IP
    if (!req.user.roles.includes('admin') && group.supervisor_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied: this group is not assigned to you',
      });
    }

    const updatePayload = {
      project_status: status,
      ip_marked_by:   status === 'ip' ? req.user.id : null,
      ip_marked_at:   status === 'ip' ? new Date().toISOString() : null,
      ip_reason:      status === 'ip' ? (reason?.trim() || null) : null,
    };

    const { error: updateError } = await supabaseAdmin
      .from('groups')
      .update(updatePayload)
      .eq('id', groupId);

    if (updateError) throw updateError;

    // Audit log
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action:   status === 'ip' ? 'MARK_GROUP_IP' : 'UNMARK_GROUP_IP',
        entity:   'group',
        context:  {
          groupId,
          groupNumber:  group.group_number,
          projectName:  group.project_name,
          reason:       reason || null,
          markedBy:     req.user.name,
          markedAt:     new Date().toISOString(),
        },
      });
    } catch {
      /* non-fatal */
    }

    res.json({ success: true, projectStatus: status });
  } catch (error) {
    console.error('Error updating group project status:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
}

/**
 * POST /api/groups/:id/supervisor-evaluation
 *
 * Supervisor submits or saves rubric-based evaluation scores for each student
 * in a group. Validates supervisor ownership and all criterion keys server-side.
 * Calculates the normalized score and syncs it to supervisor_assessments.
 *
 * Body: {
 *   evaluations: [{ studentId, scores: { criterionKey: rawScore (1–5) } }],
 *   submissionStatus: 'draft' | 'submitted'
 * }
 */
async function submitSupervisorEvaluation(req, res) {
  try {
    const { id: groupId }                          = req.params;
    const { evaluations = [], submissionStatus = 'draft' } = req.body;
    const supervisorId                             = req.user.id;

    // ── Input validation ─────────────────────────────────────────────────────
    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ error: 'evaluations array is required and must not be empty' });
    }
    if (!['draft', 'submitted'].includes(submissionStatus)) {
      return res.status(400).json({ error: 'submissionStatus must be "draft" or "submitted"' });
    }

    // ── Fetch group for ownership check + course resolution ──────────────────
    const { data: group, error: gError } = await supabaseAdmin
      .from('groups')
      .select('id, supervisor_id, course_id, course:courses!course_id(code)')
      .eq('id', groupId)
      .single();

    if (gError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Backend ownership check — only the assigned supervisor (or admin) may evaluate
    if (!req.user.roles.includes('admin') && group.supervisor_id !== supervisorId) {
      return res.status(403).json({ error: 'You are not the supervisor of this group' });
    }

    const courseId   = group.course_id;
    const courseType = group.course?.code?.includes('499') ? '499' : '498';

    // ── Fetch criteria, component, and members in parallel ───────────────────
    const [
      { data: criteria, error: cError },
      { data: component },
      { data: members },
    ] = await Promise.all([
      supabaseAdmin
        .from('grading_rubric_criteria')
        .select('criterion_key, max_raw_score')
        .eq('course_type', courseType)
        .eq('component_key', 'supervisor_eval')
        .eq('is_active', true),
      supabaseAdmin
        .from('grading_components')
        .select('total_marks')
        .eq('course_type', courseType)
        .eq('component_key', 'supervisor_eval')
        .single(),
      supabaseAdmin
        .from('group_members')
        .select('student_id')
        .eq('group_id', groupId),
    ]);

    if (cError || !criteria || criteria.length === 0) {
      return res.status(400).json({ error: 'No rubric criteria defined for this course type' });
    }

    const criteriaMap   = Object.fromEntries(criteria.map((c) => [c.criterion_key, c]));
    const maxRawTotal   = criteria.reduce((s, c) => s + Number(c.max_raw_score), 0);
    const totalMarks = component ? Number(component.total_marks) : (courseType === '499' ? 23 : 18);

    const memberIds = new Set((members || []).map((m) => m.student_id));

    // ── Validate each evaluation entry and build upsert rows ─────────────────
    const rubricRows   = [];
    const assessments  = [];

    for (const ev of evaluations) {
      const { studentId, scores } = ev;

      if (!studentId || typeof scores !== 'object') {
        return res.status(400).json({ error: 'Each evaluation must have studentId and scores' });
      }
      if (!memberIds.has(studentId)) {
        return res.status(400).json({ error: `Student ${studentId} is not a member of this group` });
      }

      let rawTotal = 0;

      for (const [criterionKey, rawScore] of Object.entries(scores)) {
        if (!criteriaMap[criterionKey]) {
          return res.status(400).json({ error: `Invalid criterion key: ${criterionKey}` });
        }
        const numScore = Number(rawScore);
        if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
          return res.status(400).json({
            error: `Score for "${criterionKey}" must be an integer between 1 and 5`,
          });
        }
        rawTotal += numScore;
        rubricRows.push({
          student_id:        studentId,
          group_id:          groupId,
          course_id:         courseId,
          criterion_key:     criterionKey,
          raw_score:         numScore,
          graded_by:         supervisorId,
          graded_at:         new Date().toISOString(),
          submission_status: submissionStatus,
        });
      }

      // Normalized score: (rawTotal / maxRawTotal) × totalMarks, rounded to 2 dp
      const normalizedScore = maxRawTotal > 0
        ? Math.round((rawTotal / maxRawTotal) * totalMarks * 100) / 100
        : 0;

      assessments.push({ studentId, normalizedScore });
    }

    // ── Upsert rubric scores ──────────────────────────────────────────────────
    const { error: upsertError } = await supabaseAdmin
      .from('supervisor_rubric_scores')
      .upsert(rubricRows, { onConflict: 'student_id,group_id,course_id,criterion_key' });

    if (upsertError) throw upsertError;

    // ── Batch upsert all normalized scores in one DB call ────────────────────
    const now = new Date().toISOString();
    const assessmentRows = assessments.map(({ studentId, normalizedScore }) => ({
      student_id:        studentId,
      group_id:          groupId,
      course_id:         courseId,
      score:             normalizedScore,
      max_score:         totalMarks,
      graded_by:         supervisorId,
      graded_at:         now,
      submission_status: submissionStatus,
    }));
    await supabaseAdmin
      .from('supervisor_assessments')
      .upsert(assessmentRows, { onConflict: 'student_id,group_id,course_id' });

    // ── Fire-and-forget email to each evaluated student (final submit only) ──
    if (submissionStatus === 'submitted') {
      const courseName = group.course?.code ?? '';
      const studentIds = assessments.map((a) => a.studentId);
      supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', studentIds)
        .then(({ data: profiles }) => {
          const emailMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.email]));
          assessments.forEach(({ studentId, normalizedScore }) => {
            const email = emailMap[studentId];
            if (email) {
              emailService.sendSupervisorEvaluation(email, {
                courseName,
                normalizedScore,
                maxScore: totalMarks,
              }).catch(console.error);
            }
          });
        })
        .catch((err) => console.error('[groups] Failed to send supervisor evaluation emails:', err.message));
    }

    res.json({
      success: true,
      results: assessments.map(({ studentId, normalizedScore }) => ({
        studentId,
        normalizedScore,
        maxScore:        totalMarks,
        submissionStatus,
      })),
    });
  } catch (error) {
    console.error('Error submitting supervisor evaluation:', error);
    res.status(500).json({ error: 'Failed to submit evaluation' });
  }
}

// ============================================================================
// COORDINATOR-SPECIFIC ENDPOINTS
// ============================================================================

/**
 * GET /api/groups/coordinator-grades?courseType=498
 * Fetch all groups in coordinator's assigned course with grade data
 * Coordinators see all groups from their assigned course
 */
async function getGroupsWithCoordinatorGrades(req, res) {
  try {
    const { courseType } = req.query;
    const coordinatorId = req.user.id;
    const isAdmin = req.user.activeRole === 'admin';

    if (!courseType || !['498', '499'].includes(courseType)) {
      return res.status(400).json({ error: 'Valid courseType (498 or 499) required' });
    }

    // Build the groups query based on role
    let groupsQuery = supabaseAdmin
      .from('groups')
      .select('id, group_code, group_number, project_name, course_id, status, supervisor_id')
      .order('group_number');

    if (isAdmin) {
      // Admin: look up all course UUIDs matching courseType, then filter groups by either
      // course_id (UUID) or course_number ('498'/'499') to cover both old and new groups.
      const { data: courseRows } = await supabaseAdmin
        .from('courses')
        .select('id')
        .ilike('code', `%${courseType}%`);
      const courseIds = (courseRows || []).map(c => c.id);

      if (courseIds.length > 0) {
        groupsQuery = groupsQuery.or(`course_number.eq.${courseType},course_id.in.(${courseIds.join(',')})`);
      } else {
        // No course records found — fall back to matching course_number only
        groupsQuery = groupsQuery.eq('course_number', courseType);
      }
    } else if (req.user.coordinatorCourseId) {
      groupsQuery = groupsQuery.eq('course_id', req.user.coordinatorCourseId);
    } else {
      return res.status(403).json({ error: 'No course assigned to your coordinator account' });
    }

    // 1. Fetch all groups in the resolved course(s)
    const { data: groups, error: groupsError } = await groupsQuery;

    if (groupsError) throw groupsError;

    if (!groups || groups.length === 0) {
      return res.json({ groups: [] });
    }

    const groupIds = groups.map(g => g.id);

    // 2. Fetch members + components in parallel (both independent of each other)
    const supervisorIds = [...new Set((groups || []).map(g => g.supervisor_id).filter(Boolean))];

    const [
      { data: members, error: membersError },
      { data: components, error: componentError },
    ] = await Promise.all([
      supabaseAdmin.from('group_members').select('group_id, student_id').in('group_id', groupIds),
      supabaseAdmin
        .from('grading_components')
        .select('component_key, component_name, evaluator_role, total_marks, display_order')
        .eq('course_type', courseType)
        .eq('is_active', true)
        .order('display_order'),
    ]);

    if (membersError) throw membersError;
    if (componentError) throw componentError;

    // 3. Fetch student + supervisor profiles in parallel
    const studentIds = [...new Set((members || []).map(m => m.student_id))];
    const [{ data: studentProfiles, error: profilesError }, { data: supervisorProfiles }] = await Promise.all([
      studentIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, name, student_id').in('id', studentIds)
        : { data: [] },
      supervisorIds.length > 0
        ? supabaseAdmin.from('profiles').select('id, name').in('id', supervisorIds)
        : { data: [] },
    ]);

    if (profilesError) throw profilesError;

    const supervisorMap = {};
    (supervisorProfiles || []).forEach(p => { supervisorMap[p.id] = p; });

    const profileMap = {};
    (studentProfiles || []).forEach(p => { profileMap[p.id] = p; });

    const membersByGroup = {};
    (members || []).forEach(m => {
      if (!membersByGroup[m.group_id]) membersByGroup[m.group_id] = [];
      membersByGroup[m.group_id].push(m);
    });

    // 5. Batch fetch all assessment data to populate grade component scores
    // Collect the course IDs from the fetched groups to scope coordinator_deliverable_scores
    const courseIds = [...new Set((groups || []).map(g => g.course_id).filter(Boolean))];

    const [
      { data: allSupAssessments },
      { data: allCommEvaluations },
      { data: allDelivScores },
      { data: allWeeklyReports },
      { data: allCoordAssessments },
      { data: allPeerEvaluations },
    ] = await Promise.all([
      supabaseAdmin.from('supervisor_assessments').select('group_id, score, max_score').in('group_id', groupIds),
      supabaseAdmin.from('committee_evaluations').select('group_id, student_id, score, max_score').in('group_id', groupIds),
      // Filter by both group_id and course_id so scores from other courses are never mixed in
      (courseIds.length > 0
        ? supabaseAdmin.from('coordinator_deliverable_scores').select('group_id, score').in('group_id', groupIds).in('course_id', courseIds)
        : supabaseAdmin.from('coordinator_deliverable_scores').select('group_id, score').in('group_id', groupIds)),
      supabaseAdmin.from('weekly_reports').select('group_id, student_mark, supervisor_mark').in('group_id', groupIds),
      (isAdmin
        ? supabaseAdmin.from('coordinator_assessments').select('group_id, component_key, normalized_score, max_score, submission_status').in('group_id', groupIds)
        : supabaseAdmin.from('coordinator_assessments').select('group_id, component_key, normalized_score, max_score, submission_status').eq('coordinator_id', coordinatorId).in('group_id', groupIds)),
      supabaseAdmin.from('peer_evaluations').select('group_id, student_id, score').in('group_id', groupIds),
    ]);

    // 6. Batch-prefetch per-group data (replaces N+1 per-group queries)
    const [
      { data: allChapterSubs },
      { data: allCoordEvals },
      { data: allCoordAssessBatch },
    ] = await Promise.all([
      supabaseAdmin.from('chapter_submissions').select('group_id, status').in('group_id', groupIds),
      isAdmin
        ? supabaseAdmin.from('coordinator_evaluations').select('group_id, id, submission_status').in('group_id', groupIds)
        : supabaseAdmin.from('coordinator_evaluations').select('group_id, id, submission_status').eq('coordinator_id', coordinatorId).in('group_id', groupIds),
      isAdmin
        ? supabaseAdmin.from('coordinator_assessments').select('group_id, normalized_score, max_score, submission_status').in('group_id', groupIds)
        : supabaseAdmin.from('coordinator_assessments').select('group_id, normalized_score, max_score, submission_status').eq('coordinator_id', coordinatorId).in('group_id', groupIds),
    ]);

    // Build lookup maps for O(1) access inside the loop
    const chapterSubsByGroup = {};
    (allChapterSubs || []).forEach(s => {
      if (!chapterSubsByGroup[s.group_id]) chapterSubsByGroup[s.group_id] = [];
      chapterSubsByGroup[s.group_id].push(s);
    });
    const coordEvalByGroup = {};
    (allCoordEvals || []).forEach(e => { coordEvalByGroup[e.group_id] = e; });
    const coordAssessByGroup = {};
    (allCoordAssessBatch || []).forEach(a => { coordAssessByGroup[a.group_id] = a; });

    const result = (groups || []).map((group) => {
      const approvals = chapterSubsByGroup[group.id] || [];
      const approvalCounts = {
        total:    approvals.length,
        approved: approvals.filter(a => a.status === 'approved').length,
        pending:  approvals.filter(a => a.status === 'pending').length,
        rejected: approvals.filter(a => a.status === 'rejected').length,
      };

      const coordEval   = coordEvalByGroup[group.id]   ?? null;
      const coordAssess = coordAssessByGroup[group.id] ?? null;

      // Compute per-component scores from batched data
      const groupSupScores = (allSupAssessments || []).filter(a => a.group_id === group.id);
      const supScoreValues = groupSupScores.map(a => a.score).filter(s => s != null);
      const supervisorScore = supScoreValues.length
        ? supScoreValues.reduce((s, v) => s + Number(v), 0) / supScoreValues.length
        : null;

      const groupCommScores = (allCommEvaluations || []).filter(a => a.group_id === group.id);
      const committeeScore = groupCommScores.length > 0
        ? groupCommScores.reduce((s, r) => s + Number(r.score ?? 0), 0) / groupCommScores.length
        : null;

      const groupDelivs = (allDelivScores || []).filter(d => d.group_id === group.id);
      const deliverablesTotal = groupDelivs.length > 0
        ? groupDelivs.reduce((s, d) => s + Number(d.score ?? 0), 0)
        : null;

      const groupWeekly = (allWeeklyReports || []).filter(r => r.group_id === group.id);
      const weeklyRaw = groupWeekly.reduce((s, r) => s + (r.student_mark ?? 0) + (r.supervisor_mark ?? 0), 0);
      const weeklyMaxScore = courseType === '499' ? 22 : 20;
      const weeklyScore = groupWeekly.length > 0 ? Math.min(weeklyRaw, weeklyMaxScore) : null;

      const groupCoordAssessMap = {};
      (allCoordAssessments || []).filter(a => a.group_id === group.id).forEach(a => {
        groupCoordAssessMap[a.component_key] = a.normalized_score;
      });

      const groupPeerScores = (allPeerEvaluations || []).filter(p => p.group_id === group.id);
      const peerScoreValues = groupPeerScores.map(p => Number(p.score)).filter(s => !isNaN(s));
      const peerAvgRaw = peerScoreValues.length > 0
        ? peerScoreValues.reduce((s, v) => s + v, 0) / peerScoreValues.length
        : null;
      const peerComponent = components?.find(c => c.component_key === 'peer_review');
      const peerWeight = peerComponent ? Number(peerComponent.total_marks) : 5;
      const peerScore = peerAvgRaw != null ? (peerAvgRaw / 5) * peerWeight : null;

      const gMembers = membersByGroup[group.id] || [];

      return {
        id: group.id,
        number: group.group_number,
        groupCode: group.group_code || null,
        name: group.project_name,
        courseCode: courseType === '498' ? 'CPIS-498' : 'CPIS-499',
        courseType,
        supervisorId: group.supervisor_id || null,
        supervisorName: group.supervisor_id ? (supervisorMap[group.supervisor_id]?.name || null) : null,
        students: gMembers.map(m => ({
          id: m.student_id,
          name: profileMap[m.student_id]?.name || '',
          studentId: profileMap[m.student_id]?.student_id,
        })),
        projectStatus: group.status || 'normal',
        ipMarkedAt: null,
        totalScore: null, // Calculated on frontend from components
        gradeComponents: components?.map(c => {
          let score = null;
          switch (c.component_key) {
            case 'supervisor_eval':
              score = supervisorScore;
              break;
            case 'committee_eval':
              score = committeeScore;
              break;
            case 'coordinator_deliverables':
              score = deliverablesTotal;
              break;
            case 'progress_reports':
              score = weeklyScore;
              break;
            case 'peer_review':
              score = peerScore;
              break;
            default:
              if (c.evaluator_role === 'coordinator') {
                score = groupCoordAssessMap[c.component_key] ?? null;
              }
          }
          return {
            componentKey: c.component_key,
            componentName: c.component_name,
            evaluatorRole: c.evaluator_role,
            weight: c.total_marks,
            score,
            maxScore: c.total_marks,
          };
        }) || [],
        approvalCounts,
        coordinatorEvaluation: coordEval ? {
          submissionStatus: coordAssess?.submission_status || 'draft',
          normalizedScore: coordAssess?.normalized_score || null,
          maxScore: coordAssess?.max_score || null,
          submittedAt: coordEval ? new Date().toISOString() : null,
        } : null,
      };
    });

    res.json({ groups: result });
  } catch (error) {
    console.error('Error fetching coordinator grades:', error);
    res.status(500).json({ error: 'Failed to fetch coordinator grades' });
  }
}

/**
 * POST /api/groups/{id}/coordinator-evaluation
 * Submit Coordinator Evaluation for a group
 */
async function submitCoordinatorEvaluation(req, res) {
  try {
    const { id: groupId } = req.params;
    const { courseType, evaluations, submissionStatus } = req.body;
    const coordinatorId = req.user.id;

    if (!courseType || !['498', '499'].includes(courseType)) {
      return res.status(400).json({ error: 'Valid courseType required' });
    }

    if (!submissionStatus || !['draft', 'submitted'].includes(submissionStatus)) {
      return res.status(400).json({ error: 'submissionStatus must be draft or submitted' });
    }

    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ error: 'evaluations array required' });
    }

    // 1. Validate group exists and belongs to coordinator's course
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, course_id, course:courses!course_id(code)')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.course_id !== req.user.coordinatorCourseId && req.user.activeRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied: group not in your assigned course' });
    }

    // 2. Dynamically find the coordinator grading component from Grade Scheme Editor
    const { data: coordComponent } = await supabaseAdmin
      .from('grading_components')
      .select('component_key, total_marks')
      .eq('course_type', courseType)
      .eq('evaluator_role', 'coordinator')
      .eq('is_active', true)
      .order('display_order')
      .limit(1)
      .maybeSingle();

    const componentKey = coordComponent?.component_key ?? 'coordinator_eval';
    const componentWeight = coordComponent?.total_marks ?? 20;

    // 3. Fetch criteria for that component
    const { data: criteria, error: criteriaError } = await supabaseAdmin
      .from('grading_rubric_criteria')
      .select('id, criterion_key, max_raw_score')
      .eq('course_type', courseType)
      .eq('component_key', componentKey)
      .eq('is_active', true);

    if (criteriaError) throw criteriaError;

    const criteriaMap = {};
    let totalMaxRaw = 0;
    (criteria || []).forEach(c => {
      criteriaMap[c.criterion_key] = c;
      totalMaxRaw += c.max_raw_score;
    });

    // 4. Validate each evaluation
    let rawTotal = 0;
    const evaluationRows = [];

    for (const ev of evaluations) {
      const { criterionId, criterionKey: evCriterionKey, rawScore } = ev;

      if (!criteriaMap[evCriterionKey]) {
        return res.status(400).json({ error: `Invalid criterion key: ${evCriterionKey}` });
      }

      const numScore = Number(rawScore);
      if (!Number.isInteger(numScore) || numScore < 1 || numScore > 5) {
        return res.status(400).json({ error: `Score for "${evCriterionKey}" must be between 1 and 5` });
      }

      rawTotal += numScore;
      evaluationRows.push({
        group_id: groupId,
        course_type: courseType,
        coordinator_id: coordinatorId,
        criterion_id: criterionId,
        criterion_key: evCriterionKey,
        raw_score: numScore,
        submission_status: submissionStatus,
      });
    }

    const normalizedScore = totalMaxRaw > 0
      ? Math.round((rawTotal / totalMaxRaw) * componentWeight * 100) / 100
      : 0;

    // 5. Upsert coordinator_evaluations
    const { error: upserEvalsError } = await supabaseAdmin
      .from('coordinator_evaluations')
      .upsert(evaluationRows, { onConflict: 'group_id,coordinator_id,criterion_id' });

    if (upserEvalsError) throw upserEvalsError;

    // 6. Upsert coordinator_assessments (use dynamic component_key)
    const { error: upserAssessError } = await supabaseAdmin
      .from('coordinator_assessments')
      .upsert({
        group_id: groupId,
        course_type: courseType,
        coordinator_id: coordinatorId,
        component_key: componentKey,
        normalized_score: normalizedScore,
        max_score: componentWeight,
        submission_status: submissionStatus,
      }, { onConflict: 'group_id,coordinator_id,component_key' });

    if (upserAssessError) throw upserAssessError;

    // ── Fire-and-forget email to group members (final submit only) ────────────
    if (submissionStatus === 'submitted') {
      const courseName = group.course?.code ?? courseType;
      supabaseAdmin
        .from('group_members')
        .select('student_id')
        .eq('group_id', groupId)
        .then(({ data: memberRows }) => {
          const studentIds = (memberRows || []).map((m) => m.student_id);
          if (studentIds.length === 0) return;
          return supabaseAdmin.from('profiles').select('email').in('id', studentIds)
            .then(({ data: profiles }) => {
              (profiles || []).filter((p) => p.email).forEach((p) => {
                emailService.sendCoordinatorEvaluation(p.email, {
                  courseName,
                  normalizedScore,
                  maxScore: componentWeight,
                }).catch(console.error);
              });
            });
        })
        .catch((err) => console.error('[groups] Failed to send coordinator evaluation emails:', err.message));
    }

    res.json({
      success: true,
      evaluations: evaluationRows.map(e => ({
        criterionKey: e.criterion_key,
        rawScore: e.raw_score,
      })),
      totalNormalized: normalizedScore,
      maxPossible: componentWeight,
      submissionStatus,
    });
  } catch (error) {
    console.error('Error submitting coordinator evaluation:', error);
    res.status(500).json({ error: 'Failed to submit evaluation' });
  }
}

/**
 * GET /api/groups/{id}/coordinator-evaluation?courseType=498
 * Fetch existing Coordinator Evaluation for a group (for modal pre-fill)
 */
async function getCoordinatorEvaluation(req, res) {
  try {
    const { id: groupId } = req.params;
    const { courseType } = req.query;
    const coordinatorId = req.user.id;

    if (!courseType || !['498', '499'].includes(courseType)) {
      return res.status(400).json({ error: 'Valid courseType required' });
    }

    // 1. Validate group exists and belongs to coordinator's course
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, course_id')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.course_id !== req.user.coordinatorCourseId && req.user.activeRole !== 'admin') {
      return res.status(403).json({ error: 'Access denied: group not in your assigned course' });
    }

    // 2. Dynamically find the coordinator grading component from Grade Scheme Editor
    const { data: coordComponent } = await supabaseAdmin
      .from('grading_components')
      .select('component_key')
      .eq('course_type', courseType)
      .eq('evaluator_role', 'coordinator')
      .eq('is_active', true)
      .order('display_order')
      .limit(1)
      .maybeSingle();

    const componentKey = coordComponent?.component_key ?? 'coordinator_eval';

    // 3. Fetch criteria for that component
    const { data: criteria, error: criteriaError } = await supabaseAdmin
      .from('grading_rubric_criteria')
      .select('id, criterion_key, criterion_name, max_raw_score, description_1, description_2, description_3, description_4, description_5')
      .eq('course_type', courseType)
      .eq('component_key', componentKey)
      .eq('is_active', true)
      .order('display_order');

    if (criteriaError) throw criteriaError;

    // 3. Fetch existing coordinator evaluations for this group
    const { data: evaluations, error: evaluationsError } = await supabaseAdmin
      .from('coordinator_evaluations')
      .select('criterion_id, criterion_key, raw_score, submission_status')
      .eq('group_id', groupId)
      .eq('coordinator_id', coordinatorId);

    if (evaluationsError) throw evaluationsError;

    const evalMap = {};
    let submissionStatus = null;
    (evaluations || []).forEach(e => {
      evalMap[e.criterion_key] = e.raw_score;
      submissionStatus = e.submission_status;
    });

    // 4. Build response with criteria and pre-filled scores
    const result = {
      evaluations: (criteria || []).map(c => ({
        criterionId: c.id,
        criterionKey: c.criterion_key,
        criterionName: c.criterion_name,
        maxRawScore: c.max_raw_score,
        rawScore: evalMap[c.criterion_key] || null,
        description1: c.description_1,
        description2: c.description_2,
        description3: c.description_3,
        description4: c.description_4,
        description5: c.description_5,
      })),
      submissionStatus: submissionStatus || 'draft',
      submittedAt: submissionStatus === 'submitted' ? new Date().toISOString() : null,
    };

    res.json(result);
  } catch (error) {
    console.error('Error fetching coordinator evaluation:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation' });
  }
}

module.exports = {
  getAllGroups,
  getAvailableGroups,
  assignSupervisor,
  updateGroupStatus,
  deleteGroup,
  updateGroup,
  createGroup,
  getSupervisorGroupsWithGrades,
  markGroupAsIP,
  submitSupervisorEvaluation,
  getGroupsWithCoordinatorGrades,
  submitCoordinatorEvaluation,
  getCoordinatorEvaluation,
};
