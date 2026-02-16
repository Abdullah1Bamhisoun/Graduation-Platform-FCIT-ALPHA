const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/important-files
 * Public — list all important files
 */
async function listFiles(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('important_files')
      .select('id, name, description, size, type, file_url, uploaded_at')
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    res.json((data || []).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      size: f.size,
      type: f.type,
      fileUrl: f.file_url || null,
      uploadedAt: f.uploaded_at,
    })));
  } catch (error) {
    console.error('Error listing important files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
}

/**
 * POST /api/important-files
 * Admin only — add a new file entry
 */
async function createFile(req, res) {
  try {
    const { name, description, size, type, fileUrl } = req.body;

    if (!name || !description || !type) {
      return res.status(400).json({ error: 'name, description, and type are required' });
    }

    const { data, error } = await supabaseAdmin
      .from('important_files')
      .insert({
        name,
        description,
        size: size || '',
        type,
        file_url: fileUrl || null,
        uploaded_at: new Date().toISOString(),
      })
      .select('id, name, description, size, type, file_url, uploaded_at')
      .single();

    if (error) throw error;

    res.json({
      id: data.id,
      name: data.name,
      description: data.description,
      size: data.size,
      type: data.type,
      fileUrl: data.file_url || null,
      uploadedAt: data.uploaded_at,
    });
  } catch (error) {
    console.error('Error creating important file:', error);
    res.status(500).json({ error: 'Failed to create file' });
  }
}

/**
 * PATCH /api/important-files/:id
 * Admin only — update a file entry
 */
async function updateFile(req, res) {
  try {
    const { id } = req.params;
    const { name, description, size, type, fileUrl } = req.body;

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
 * Admin only — delete a file entry
 */
async function deleteFile(req, res) {
  try {
    const { id } = req.params;

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
