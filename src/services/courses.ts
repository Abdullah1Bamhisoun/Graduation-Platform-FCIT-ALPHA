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
