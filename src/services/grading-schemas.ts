import { supabase } from '../lib/supabase';
import type { GradingSchema } from '../types';

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
  try {
    // Try exact semester first
    const { data: exact } = await supabase
      .from('grading_schemas')
      .select('*')
      .eq('department', department)
      .eq('course_type', courseType)
      .eq('semester', semester)
      .eq('is_active', true)
      .order('weight', { ascending: false });

    if (exact && exact.length > 0) return exact.map(mapRow);

    // Fall back to DEFAULT
    const { data: fallback } = await supabase
      .from('grading_schemas')
      .select('*')
      .eq('department', department)
      .eq('course_type', courseType)
      .eq('semester', 'DEFAULT')
      .eq('is_active', true)
      .order('weight', { ascending: false });

    return (fallback || []).map(mapRow);
  } catch {
    return [];
  }
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
