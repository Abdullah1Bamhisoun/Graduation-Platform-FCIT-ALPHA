const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, TTL } = require('../utils/cache');

const CACHE_KEY = 'courses:all';

/**
 * GET /api/courses/active  (public)
 * Returns only active courses — used by the registration form.
 * Cached for LONG_TTL (5 min) — courses rarely change.
 */
async function getActiveCourses(req, res) {
  try {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return res.json(cached);

    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('id, code, name')
      .order('code');

    if (error) throw error;
    await cacheSet(CACHE_KEY, data || [], TTL.LONG);
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching active courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

/**
 * GET /api/courses  (admin only)
 * Returns all courses — used by admin management UI.
 * Shares the same cache as getActiveCourses.
 */
async function getAllCourses(req, res) {
  try {
    const cached = await cacheGet(CACHE_KEY);
    if (cached) return res.json(cached);

    const { data, error } = await supabaseAdmin
      .from('courses')
      .select('id, code, name')
      .order('code');

    if (error) throw error;
    await cacheSet(CACHE_KEY, data || [], TTL.LONG);
    res.json(data || []);
  } catch (error) {
    console.error('Error fetching all courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
}

module.exports = { getActiveCourses, getAllCourses };
