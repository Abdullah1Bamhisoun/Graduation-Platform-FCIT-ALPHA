const { supabaseAdmin } = require('../config/supabase');

/**
 * Determine whether the requesting user is a committee member assigned to the given group.
 * Committee membership is stored in presentation_schedules.committee_members (TEXT[]).
 */
async function isCommitteeMemberForGroup(userId, groupId) {
  const { data: schedule } = await supabaseAdmin
    .from('presentation_schedules')
    .select('committee_members')
    .eq('group_id', groupId)
    .maybeSingle();
  return (schedule?.committee_members || []).includes(userId);
}

/**
 * Determine whether the requesting user is the supervisor of the given group.
 */
async function isSupervisorForGroup(userId, groupId) {
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('supervisor_id')
    .eq('id', groupId)
    .single();
  return group?.supervisor_id === userId;
}

/**
 * Determine whether the requesting user is a member (student) of the given group.
 */
async function isStudentInGroup(userId, groupId) {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('student_id', userId)
    .maybeSingle();
  return !!data;
}

/**
 * Build a Supabase query filter that restricts rows to those the caller may see.
 *
 * Visibility rules:
 *   supervisor  → all files for the group
 *   committee   → target_role='committee' OR submit_to_committee=true  (plus their own uploads)
 *   coordinator → same as committee
 *   student     → target_role='all' OR submit_to_committee=true
 *   admin       → all files
 */
function applyVisibilityFilter(query, callerRole, callerUserId) {
  if (callerRole === 'admin' || callerRole === 'supervisor') {
    return query; // see everything
  }
  if (callerRole === 'coordinator') {
    // committee files + their own uploads
    return query.or(
      `target_role.eq.committee,submit_to_committee.eq.true,uploaded_by.eq.${callerUserId}`
    );
  }
  if (callerRole === 'committee') {
    // committee files + their own uploads
    return query.or(
      `target_role.eq.committee,submit_to_committee.eq.true,uploaded_by.eq.${callerUserId}`
    );
  }
  // student — committee files (they can see committee feedback) but NOT supervisor-only files
  return query.or(
    `target_role.eq.all,submit_to_committee.eq.true`
  );
}

/**
 * GET /api/groups/:groupId/files
 *
 * Returns files for a group, filtered by the caller's role.
 * Optional query params:
 *   ?committee=true   — only return files submitted to committee
 *   ?courseNumber=CPIS-498   — filter by course number
 */
async function getGroupFiles(req, res) {
  try {
    const { groupId } = req.params;
    const { committee, courseNumber } = req.query;

    const userId = req.user.id;
    const userRoles = req.user.roles;
    const activeRole = req.user.activeRole;

    // Determine the effective role for visibility purposes
    let effectiveRole = activeRole;
    if (userRoles.includes('admin')) {
      effectiveRole = 'admin';
    } else if (activeRole === 'supervisor' && await isSupervisorForGroup(userId, groupId)) {
      effectiveRole = 'supervisor';
    } else if (activeRole === 'supervisor' && await isCommitteeMemberForGroup(userId, groupId)) {
      // Supervisor acting as committee evaluator for this group
      effectiveRole = 'committee';
    } else if (activeRole === 'coordinator') {
      effectiveRole = 'coordinator';
    } else {
      // student — verify membership
      const isMember = await isStudentInGroup(userId, groupId);
      const isSup = !isMember && await isSupervisorForGroup(userId, groupId);
      if (!isMember && !isSup && !userRoles.includes('admin')) {
        return res.status(403).json({ error: 'Access denied' });
      }
      effectiveRole = isMember ? 'student' : 'supervisor';
    }

    let query = supabaseAdmin
      .from('group_files')
      .select('id, group_id, course_id, uploaded_by, uploader_role, file_name, file_size, file_path, target_role, submit_to_committee, version_number, parent_file_id, course_number, notes, uploaded_at')
      .eq('group_id', groupId)
      .order('uploaded_at', { ascending: false });

    // Apply role-based visibility
    query = applyVisibilityFilter(query, effectiveRole, userId);

    // Optional filters
    if (committee === 'true') {
      query = query.eq('submit_to_committee', true);
    }
    if (courseNumber) {
      query = query.eq('course_number', courseNumber);
    }

    const { data: files, error } = await query;
    if (error) throw error;

    // Enrich with uploader names
    const uploaderIds = [...new Set((files || []).map((f) => f.uploaded_by))];
    let nameMap = {};
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .in('id', uploaderIds);
      nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
    }

    res.json(
      (files || []).map((f) => ({
        id: f.id,
        groupId: f.group_id,
        courseId: f.course_id,
        uploadedBy: f.uploaded_by,
        uploaderName: nameMap[f.uploaded_by] ?? 'Unknown',
        uploaderRole: f.uploader_role,
        fileName: f.file_name,
        fileSize: f.file_size,
        filePath: f.file_path,
        targetRole: f.target_role,
        submitToCommittee: f.submit_to_committee,
        versionNumber: f.version_number,
        parentFileId: f.parent_file_id,
        courseNumber: f.course_number,
        notes: f.notes,
        uploadedAt: f.uploaded_at,
      }))
    );
  } catch (error) {
    console.error('Error fetching group files:', error);
    res.status(500).json({ error: 'Failed to fetch group files' });
  }
}

/**
 * POST /api/groups/:groupId/files
 *
 * Registers a file upload (after the file has already been stored in Supabase Storage).
 *
 * Body: {
 *   fileName, fileSize, filePath,
 *   targetRole?,          // 'supervisor' | 'committee' | 'coordinator' | 'all'
 *   submitToCommittee?,   // boolean
 *   courseId?,
 *   courseNumber?,        // 'CPIS-498' | 'CPIS-499'
 *   notes?,
 *   parentFileId?,        // UUID of file being versioned
 * }
 */
async function createGroupFile(req, res) {
  try {
    const { groupId } = req.params;
    const {
      fileName, fileSize, filePath,
      targetRole, submitToCommittee,
      courseId, courseNumber, notes, parentFileId,
    } = req.body;

    if (!fileName || !filePath) {
      return res.status(400).json({ error: 'fileName and filePath are required' });
    }

    const userId = req.user.id;
    const activeRole = req.user.activeRole;
    const userRoles = req.user.roles;

    // Determine uploader role
    let uploaderRole = activeRole;
    if (userRoles.includes('admin')) {
      uploaderRole = 'coordinator'; // admins filing on behalf of coord
    } else if (activeRole === 'supervisor') {
      // Could be acting as committee for this group
      const isCommittee = await isCommitteeMemberForGroup(userId, groupId);
      uploaderRole = isCommittee ? 'committee' : 'supervisor';
    }

    // Validate caller has access to this group
    if (!userRoles.includes('admin')) {
      const isSup = await isSupervisorForGroup(userId, groupId);
      const isMember = await isStudentInGroup(userId, groupId);
      const isComm = activeRole === 'supervisor' && await isCommitteeMemberForGroup(userId, groupId);
      const isCoord = activeRole === 'coordinator';

      if (!isSup && !isMember && !isComm && !isCoord) {
        return res.status(403).json({ error: 'Access denied: you are not associated with this group' });
      }
    }

    // Determine version number if this is a new version of an existing file
    let versionNumber = 1;
    if (parentFileId) {
      const { data: existing } = await supabaseAdmin
        .from('group_files')
        .select('version_number')
        .eq('group_id', groupId)
        .eq('parent_file_id', parentFileId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        versionNumber = existing.version_number + 1;
      } else {
        // Check the parent file itself
        const { data: parent } = await supabaseAdmin
          .from('group_files')
          .select('version_number')
          .eq('id', parentFileId)
          .maybeSingle();
        versionNumber = (parent?.version_number ?? 1) + 1;
      }
    }

    const { data: file, error } = await supabaseAdmin
      .from('group_files')
      .insert({
        group_id: groupId,
        course_id: courseId ?? null,
        uploaded_by: userId,
        uploader_role: uploaderRole,
        file_name: fileName,
        file_size: fileSize ?? null,
        file_path: filePath,
        target_role: targetRole ?? 'all',
        submit_to_committee: submitToCommittee ?? false,
        version_number: versionNumber,
        parent_file_id: parentFileId ?? null,
        course_number: courseNumber ?? null,
        notes: notes ?? null,
      })
      .select('id, uploaded_at, version_number')
      .single();

    if (error) throw error;

    res.status(201).json({
      id: file.id,
      uploadedAt: file.uploaded_at,
      versionNumber: file.version_number,
    });
  } catch (error) {
    console.error('Error creating group file:', error);
    res.status(500).json({ error: 'Failed to register group file' });
  }
}

/**
 * GET /api/groups/:groupId/previous-committee-feedback
 *
 * For CPIS-499 groups: returns committee evaluation data and files from
 * the corresponding CPIS-498 group (matched by group_number).
 * Committee members in 499 can view previous committee work (read-only).
 */
async function getPreviousCommitteeFeedback(req, res) {
  try {
    const { groupId } = req.params;
    const userId = req.user.id;
    const userRoles = req.user.roles;
    const activeRole = req.user.activeRole;

    // Access check: must be related to this group
    if (!userRoles.includes('admin') && activeRole !== 'coordinator') {
      const isSup = await isSupervisorForGroup(userId, groupId);
      const isMember = await isStudentInGroup(userId, groupId);
      const isComm = await isCommitteeMemberForGroup(userId, groupId);

      if (!isSup && !isMember && !isComm) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Fetch the current group's number and course
    const { data: group, error: groupErr } = await supabaseAdmin
      .from('groups')
      .select('id, group_number, course_number, course_id')
      .eq('id', groupId)
      .single();

    if (groupErr || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Only meaningful for CPIS-499 groups
    const isIn499 = (group.course_number ?? '').includes('499');
    if (!isIn499) {
      return res.json({ previousGroup: null, scores: [], files: [], comments: [] });
    }

    // Find the corresponding CPIS-498 group by group_number
    const { data: prevGroups } = await supabaseAdmin
      .from('groups')
      .select('id, group_number, course_number, course_id')
      .eq('group_number', group.group_number)
      .ilike('course_number', '%498%');

    if (!prevGroups || prevGroups.length === 0) {
      return res.json({ previousGroup: null, scores: [], files: [], comments: [] });
    }

    const prevGroup = prevGroups[0];

    // Get committee rubric scores from 498 group
    const { data: scores } = await supabaseAdmin
      .from('committee_rubric_scores')
      .select('criterion_key, score, evaluator_id, submission_status')
      .eq('group_id', prevGroup.id);

    // Get committee milestone feedback from 498 group
    const { data: milestoneComments } = await supabaseAdmin
      .from('committee_milestone_feedback')
      .select('id, milestone_id, evaluator_id, comment, created_at')
      .eq('group_id', prevGroup.id);

    // Get files from 498 group that are committee-related
    const { data: prevFiles } = await supabaseAdmin
      .from('group_files')
      .select('id, file_name, file_size, file_path, uploader_role, uploaded_by, uploaded_at, version_number, course_number, notes')
      .eq('group_id', prevGroup.id)
      .or('uploader_role.eq.committee,submit_to_committee.eq.true')
      .order('uploaded_at', { ascending: false });

    // Enrich evaluator names
    const evaluatorIds = [
      ...new Set([
        ...(scores || []).map((s) => s.evaluator_id),
        ...(milestoneComments || []).map((c) => c.evaluator_id),
        ...(prevFiles || []).map((f) => f.uploaded_by),
      ].filter(Boolean)),
    ];
    let nameMap = {};
    if (evaluatorIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name')
        .in('id', evaluatorIds);
      nameMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.name]));
    }

    res.json({
      previousGroup: {
        id: prevGroup.id,
        groupNumber: prevGroup.group_number,
        courseNumber: prevGroup.course_number,
      },
      scores: (scores || []).map((s) => ({
        criterionKey: s.criterion_key,
        score: s.score,
        evaluatorId: s.evaluator_id,
        evaluatorName: nameMap[s.evaluator_id] ?? 'Previous Committee',
        submissionStatus: s.submission_status,
      })),
      comments: (milestoneComments || []).map((c) => ({
        id: c.id,
        milestoneId: c.milestone_id,
        evaluatorId: c.evaluator_id,
        evaluatorName: nameMap[c.evaluator_id] ?? 'Previous Committee',
        comment: c.comment,
        createdAt: c.created_at,
      })),
      files: (prevFiles || []).map((f) => ({
        id: f.id,
        fileName: f.file_name,
        fileSize: f.file_size,
        filePath: f.file_path,
        uploaderRole: f.uploader_role,
        uploadedBy: f.uploaded_by,
        uploaderName: nameMap[f.uploaded_by] ?? 'Previous Committee',
        uploadedAt: f.uploaded_at,
        versionNumber: f.version_number,
        courseNumber: f.course_number ?? 'CPIS-498',
        notes: f.notes,
      })),
    });
  } catch (error) {
    console.error('Error fetching previous committee feedback:', error);
    res.status(500).json({ error: 'Failed to fetch previous committee feedback' });
  }
}

module.exports = {
  getGroupFiles,
  createGroupFile,
  getPreviousCommitteeFeedback,
};
