import { supabase } from '../lib/supabase';
import type { Course } from '../types';

/**
 * Fetch all courses from the database.
 * Used by the registration form and anywhere courses need to be listed.
 * Does NOT require authentication (public read via RLS).
 */
export async function getActiveCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, code, name')
    .order('code', { ascending: true });

  if (error) {
    console.error('Error fetching courses:', error.message);
    return [];
  }

  return (data || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));
}

/**
 * Fetch all courses – admin use.
 */
export async function getAllCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, code, name')
    .order('code', { ascending: true });

  if (error) {
    console.error('Error fetching all courses:', error.message);
    return [];
  }

  return (data || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
  }));
}

/**
 * Fetch a single course by its UUID.
 */
export async function getCourseById(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from('courses')
    .select('id, code, name')
    .eq('id', courseId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    code: data.code,
    name: data.name,
  };
}

/**
 * Map a course UUID to its course_type ('498' or '499').
 * Extracts the 3-digit course number from the course code (e.g., 'CPIS-498' → '498').
 * Used by the Coordinator interface to restrict access to their assigned course.
 */
export async function getCourseTypeFromUUID(courseId: string): Promise<'498' | '499' | null> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('code')
      .eq('id', courseId)
      .single();

    if (error) throw error;

    // Extract course_type from course.code (e.g., "CPIS-498" → "498")
    const match = data?.code?.match(/(\d{3})$/);
    return match ? (match[1] as '498' | '499') : null;
  } catch (err) {
    console.error('Failed to map course UUID to type:', err);
    return null;
  }
}
