const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/important-files
 * - Admin / unauthenticated: returns all files
 * - Coordinator: returns only files for their course + admin-managed files (course_id IS NULL)
 */
async function listFiles(req, res) {
  try {
    let query = supabaseAdmin
      .from('important_files')
      .select('id, name, description, size, type, file_url, course_id, uploaded_at, courses(code)')
      .order('uploaded_at', { ascending: false });

    // Scope to coordinator's course + global (null) files
    if (req.user?.activeRole === 'coordinator' && req.user.coordinatorCourseId) {
      query = query.or(`course_id.eq.${req.user.coordinatorCourseId},course_id.is.null`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json((data || []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      size: f.size,
      type: f.type,
      fileUrl: f.file_url || null,
      courseId: f.course_id || null,
      courseCode: f.courses?.code || null,
      uploadedAt: f.uploaded_at,
    })));
  } catch (error) {
    console.error('Error listing important files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
}

/**
 * POST /api/important-files
 * - Admin: course_id comes from body (or null for global files)
 * - Coordinator: course_id forced to their assigned course
 */
async function createFile(req, res) {
  try {
    const { name, description, size, type, fileUrl, courseId } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'name and type are required' });
    }

    // Determine course_id
    let resolvedCourseId = null;
    if (req.user?.activeRole === 'coordinator') {
      if (!req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
      resolvedCourseId = req.user.coordinatorCourseId;
    } else {
      // Admin may optionally scope a file to a specific course
      resolvedCourseId = courseId || null;
    }

    const { data, error } = await supabaseAdmin
      .from('important_files')
      .insert({
        name,
        description: description || '',
        size: size || '',
        type,
        file_url: fileUrl || null,
        course_id: resolvedCourseId,
        uploaded_at: new Date().toISOString(),
      })
      .select('id, name, description, size, type, file_url, course_id, uploaded_at, courses(code)')
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      name: data.name,
      description: data.description,
      size: data.size,
      type: data.type,
      fileUrl: data.file_url || null,
      courseId: data.course_id || null,
      courseCode: data.courses?.code || null,
      uploadedAt: data.uploaded_at,
    });
  } catch (error) {
    console.error('Error creating important file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
}

/**
 * PATCH /api/important-files/:id
 * - Coordinator: can only update files belonging to their course
 * - Admin: can update any file
 */
async function updateFile(req, res) {
  try {
    const { id } = req.params;
    const { name, description, size, type, fileUrl } = req.body;

    // Enforce coordinator course scope
    if (req.user?.activeRole === 'coordinator') {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('important_files')
        .select('course_id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'File not found' });
      }
      if (existing.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'Access denied: this file does not belong to your course' });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (size !== undefined) updates.size = size;
    if (type !== undefined) updates.type = type;
    if (fileUrl !== undefined) updates.file_url = fileUrl;

    const { error } = await supabaseAdmin
      .from('important_files')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating important file:', error);
    res.status(500).json({ error: 'Failed to update file' });
  }
}

/**
 * DELETE /api/important-files/:id
 * - Coordinator: can only delete files belonging to their course
 * - Admin: can delete any file
 */
async function deleteFile(req, res) {
  try {
    const { id } = req.params;

    // Enforce coordinator course scope
    if (req.user?.activeRole === 'coordinator') {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('important_files')
        .select('course_id')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return res.status(404).json({ error: 'File not found' });
      }
      if (existing.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'Access denied: this file does not belong to your course' });
      }
    }

    const { error } = await supabaseAdmin
      .from('important_files')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting important file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
}

module.exports = { listFiles, createFile, updateFile, deleteFile };
