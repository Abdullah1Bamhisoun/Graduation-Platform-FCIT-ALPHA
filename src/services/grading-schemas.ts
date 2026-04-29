import { supabase } from '../lib/supabase';
import type { GradingSchema } from '../types';

// ── Module-level TTL cache (grading schemas almost never change → long TTL) ──
const SCHEMAS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
interface CacheEntry<T> { data: T; fetchedAt: number }
const _cache = new Map<string, CacheEntry<GradingSchema[]>>();

function _isFresh<T>(e?: CacheEntry<T>): e is CacheEntry<T> {
  return !!e && Date.now() - e.fetchedAt < SCHEMAS_CACHE_TTL;
}

export function clearGradingSchemasCache() {
  _cache.clear();
}

function mapRow(row: any): GradingSchema {
  return {
    id:            row.id,
    department:    row.department,
    courseType:    row.course_type as '498' | '499',
    componentName: row.component_name,
    weight:        Number(row.weight),
    role:          row.role,
    semester:      row.semester,
    isActive:      row.is_active,
  };
}

/**
 * Fetch active grading schemas for a course.
 * Tries the specific semester first; falls back to 'DEFAULT'.
 */
export async function getGradingSchemas(
  courseType: '498' | '499',
  semester: string,
  department = 'IS'
): Promise<GradingSchema[]> {
  const ck = `${courseType}:${semester}:${department}`;
  const cached = _cache.get(ck);
  if (_isFresh(cached)) return cached.data;

  // Try exact semester first
  const { data: exact } = await supabase
    .from('grading_schemas')
    .select('*')
    .eq('department', department)
    .eq('course_type', courseType)
    .eq('semester', semester)
    .eq('is_active', true)
    .order('weight', { ascending: false });

  if (exact && exact.length > 0) {
    const result = exact.map(mapRow);
    _cache.set(ck, { data: result, fetchedAt: Date.now() });
    return result;
  }

  // Fall back to DEFAULT
  const { data: fallback } = await supabase
    .from('grading_schemas')
    .select('*')
    .eq('department', department)
    .eq('course_type', courseType)
    .eq('semester', 'DEFAULT')
    .eq('is_active', true)
    .order('weight', { ascending: false });

  const result = (fallback || []).map(mapRow);
  _cache.set(ck, { data: result, fetchedAt: Date.now() });
  return result;
}

/** Returns the weight for a given component (case-insensitive partial match). */
export function findSchemaWeight(
  schemas: GradingSchema[],
  componentName: string
): number {
  const lc = componentName.toLowerCase();
  const match = schemas.find(s => s.componentName.toLowerCase().includes(lc));
  return match?.weight ?? 0;
}

/**
 * Validates that the sum of weights equals 100.
 * Used by the admin configuration UI before saving.
 */
export function validateSchemaTotal(schemas: GradingSchema[]): boolean {
  const total = schemas.reduce((sum, s) => sum + s.weight, 0);
  return Math.abs(total - 100) < 0.01;
}
