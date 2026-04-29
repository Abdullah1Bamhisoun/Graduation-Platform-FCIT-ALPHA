import { supabase } from '../lib/supabase';
import type { Course } from '../types';

// ── Module-level TTL cache (courses change rarely → long TTL) ────────────────
const COURSES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
interface CacheEntry<T> { data: T; fetchedAt: number }
let _allCoursesCache: CacheEntry<Course[]> | undefined;
const _byIdCache = new Map<string, CacheEntry<Course | null>>();
const _typeCache = new Map<string, CacheEntry<'498' | '499' | null>>();

function _isFresh<T>(e?: CacheEntry<T>): e is CacheEntry<T> {
  return !!e && Date.now() - e.fetchedAt < COURSES_CACHE_TTL;
}

export function clearCoursesCache() {
  _allCoursesCache = undefined;
  _byIdCache.clear();
  _typeCache.clear();
}

/**
 * Fetch all courses from the database.
 * Used by the registration form and anywhere courses need to be listed.
 * Does NOT require authentication (public read via RLS).
 */
export async function getActiveCourses(): Promise<Course[]> {
  if (_isFresh(_allCoursesCache)) return _allCoursesCache.data;

  const { data, error } = await supabase
    .from('courses')
    .select('id, code, name')
    .order('code', { ascending: true });

  if (error) {
    console.error('Error fetching courses:', error.message);
    return [];
  }

  const result = (data || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));
  _allCoursesCache = { data: result, fetchedAt: Date.now() };
  return result;
}

/**
 * Fetch all courses – admin use.
 */
export async function getAllCourses(): Promise<Course[]> {
  return getActiveCourses();
}

/**
 * Fetch a single course by its UUID.
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
  const cached = _byIdCache.get(courseId);
  if (_isFresh(cached)) return cached.data;

  const { data, error } = await supabase
    .from('courses')
    .select('id, code, name')
    .eq('id', courseId)
    .maybeSingle();

  if (error || !data) {
    _byIdCache.set(courseId, { data: null, fetchedAt: Date.now() });
    return null;
  }

  const result = {
    id: data.id,
    code: data.code,
    name: data.name,
  };
  _byIdCache.set(courseId, { data: result, fetchedAt: Date.now() });
  return result;
}

/**
 * Map a course UUID to its course_type ('498' or '499').
 * Extracts the 3-digit course number from the course code (e.g., 'CPIS-498' → '498').
 * Used by the Coordinator interface to restrict access to their assigned course.
 */
export async function getCourseTypeFromUUID(courseId: string): Promise<'498' | '499' | null> {
  const cached = _typeCache.get(courseId);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data, error } = await supabase
      .from('courses')
      .select('code')
      .eq('id', courseId)
      .single();

    if (error) throw error;

    const match = data?.code?.match(/(\d{3})$/);
    const result = match ? (match[1] as '498' | '499') : null;
    _typeCache.set(courseId, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('Failed to map course UUID to type:', err);
    return null;
  }
}
