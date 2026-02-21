const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/courses/active  (public)
 * Returns only active courses — used by the registration form.
 */
async function getActiveCourses(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('id, code, name')
      .order('code');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching active courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

/**
 * GET /api/courses  (admin only)
 * Returns all courses — used by admin management UI.
 */
async function getAllCourses(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('id, code, name')
      .order('code');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching all courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

module.exports = { getActiveCourses, getAllCourses };
