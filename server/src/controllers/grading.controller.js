const { supabaseAdmin } = require('../config/supabase');

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

    const [{ data: components, error: cError }, { data: criteria, error: crError }] =
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

    /**
     * readOnly flag — consumers use this to conditionally render edit controls.
     * Only coordinator and admin may modify the scheme.
     */
    const readOnly = !['coordinator', 'admin'].includes(req.user.activeRole);

    res.json({
      components: (components || []).map(mapComponent),
      criteria: (criteria || []).map(mapCriterion),
      readOnly,
    });
  } catch (error) {
    console.error('Error fetching grading scheme:', error);
    res.status(500).json({ error: 'Failed to fetch grading scheme' });
  }
}

module.exports = { getGradingScheme };
