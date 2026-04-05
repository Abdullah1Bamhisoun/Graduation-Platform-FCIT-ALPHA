const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, TTL } = require('../utils/cache');

/**
 * Grading Scheme Controller
 *
 * Architecture:
 * ─────────────
 * The grading scheme (components + rubric criteria) is centrally owned by the
 * Coordinator and stored in two Supabase tables:
 *
 *   grading_components      — high-level component weights (e.g. "Supervisor Evaluation = 18 marks")
 *   grading_rubric_criteria — per-criterion definitions with 1–5 Likert scale descriptions
 *
 * RBAC:
 * ─────
 * READ  → all authenticated roles (student, supervisor, coordinator, admin)
 * WRITE → Coordinator / Admin only  (enforced via requireCoordinatorOrAdmin middleware
 *          on the frontend GradeSchemeEditor route + Supabase RLS on the tables)
 *
 * This endpoint provides a single, role-aware read path so every role can fetch the
 * live grading scheme dynamically. The `readOnly` flag in the response tells the
 * consumer whether the current user may edit the scheme.
 *
 * Writes (updateGradingComponent / updateRubricCriterion) still go through the
 * Supabase client in the Coordinator-only GradeSchemeEditor frontend page, backed
 * by Supabase RLS policies that reject writes from non-coordinator sessions.
 */

/**
 * GET /api/grading/scheme
 *
 * Returns the full grading scheme (components + criteria) for one or both courses.
 * Accessible by all authenticated roles — schema is the same for everyone; only
 * the Coordinator's UI exposes edit controls.
 *
 * Query params:
 *   courseType  — "498" | "499"  (optional; omit to return both)
 */
async function getGradingScheme(req, res) {
  try {
    const { courseType } = req.query;

    // ── NEW: Access Control for Coordinators ────────────────────────────────────
    if (req.user.activeRole === 'coordinator') {
      // Validate that coordinator's assigned course matches requested courseType
      if (courseType) {
        try {
          // 1. Fetch coordinator's assigned course
          const { data: coordinatorRole, error: roleError } = await supabaseAdmin
            .from('user_roles')
            .select('coordinator_course_id')
            .eq('user_id', req.user.id)
            .eq('role', 'coordinator')
            .single();

          if (roleError || !coordinatorRole?.coordinator_course_id) {
            return res.status(403).json({ error: 'Coordinator course assignment not found' });
          }

          // 2. Fetch course to get course_type from course code
          const { data: course, error: courseError } = await supabaseAdmin
            .from('courses')
            .select('code')
            .eq('id', coordinatorRole.coordinator_course_id)
            .single();

          if (courseError || !course?.code) {
            return res.status(403).json({ error: 'Course not found' });
          }

          // 3. Extract course_type from course.code (e.g., "CPIS-498" → "498")
          const match = course.code.match(/(\d{3})$/);
          const assignedCourseType = match ? match[1] : null;

          // 4. Verify requested courseType matches assigned course
          if (courseType !== assignedCourseType) {
            return res.status(403).json({
              error: `You do not have access to this course. Your assigned course is CPIS-${assignedCourseType}`,
            });
          }
        } catch (err) {
          console.error('Access control validation error:', err);
          return res.status(500).json({ error: 'Access control validation failed' });
        }
      }
    }
    // Admin role: no restriction, can access both courses

    // Cache key: grading data is the same for all roles reading same courseType.
    // readOnly is computed per-user and not cached — it's cheap.
    const schemeCk = `grading:scheme:${courseType ?? 'all'}`;
    const cachedScheme = await cacheGet(schemeCk);

    let components, criteria;

    if (cachedScheme) {
      ({ components, criteria } = cachedScheme);
    } else {
      let componentsQuery = supabaseAdmin
        .from('grading_components')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      let criteriaQuery = supabaseAdmin
        .from('grading_rubric_criteria')
        .select('*')
        .eq('is_active', true)
        .order('component_key')
        .order('display_order');

      if (courseType && ['498', '499'].includes(courseType)) {
        componentsQuery = componentsQuery.eq('course_type', courseType);
        criteriaQuery = criteriaQuery.eq('course_type', courseType);
      }

      const [{ data: compData, error: cError }, { data: critData, error: crError }] =
        await Promise.all([componentsQuery, criteriaQuery]);

      if (cError) throw cError;
      if (crError) throw crError;

      const mapComponent = (row) => ({
        id: row.id,
        courseType: row.course_type,
        componentKey: row.component_key,
        componentName: row.component_name,
        totalMarks: Number(row.total_marks),
        evaluatorRole: row.evaluator_role,
        displayOrder: row.display_order,
        isActive: row.is_active,
      });

      const mapCriterion = (row) => ({
        id: row.id,
        courseType: row.course_type,
        componentKey: row.component_key,
        criterionKey: row.criterion_key,
        criterionName: row.criterion_name,
        maxRawScore: Number(row.max_raw_score),
        description1: row.description_1 ?? null,
        description2: row.description_2 ?? null,
        description3: row.description_3 ?? null,
        description4: row.description_4 ?? null,
        description5: row.description_5 ?? null,
        displayOrder: row.display_order,
        isActive: row.is_active,
      });

      components = (compData || []).map(mapComponent);
      criteria   = (critData || []).map(mapCriterion);

      // Grading scheme changes very rarely — cache for LONG_TTL (5 min)
      await cacheSet(schemeCk, { components, criteria }, TTL.LONG);
    }

    /**
     * readOnly flag — consumers use this to conditionally render edit controls.
     * Only coordinator and admin may modify the scheme.
     */
    const readOnly = !['coordinator', 'admin'].includes(req.user.activeRole);

    res.json({ components, criteria, readOnly });
  } catch (error) {
    console.error('Error fetching grading scheme:', error);
    res.status(500).json({ error: 'Failed to fetch grading scheme' });
  }
}

module.exports = { getGradingScheme };
