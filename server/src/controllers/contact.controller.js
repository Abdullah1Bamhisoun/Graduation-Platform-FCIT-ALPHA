const { supabaseAdmin } = require('../config/supabase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Fetch all coordinator contacts by joining:
 *   courses → user_roles (coordinator role) → profiles → contact_coordinator_info
 *
 * Only courses that have an active coordinator assignment are returned.
 */
async function buildCoordinatorContacts() {
  // 1. All courses
  const { data: courses, error: coursesErr } = await supabaseAdmin
    .from('courses')
    .select('id, code, name')
    .order('code');
  if (coursesErr) throw coursesErr;

  // 2. All coordinator role assignments (user_roles where role = 'coordinator')
  const { data: coordRoles, error: rolesErr } = await supabaseAdmin
    .from('user_roles')
    .select('user_id, coordinator_course_id, roles!inner(name)')
    .eq('roles.name', 'coordinator')
    .not('coordinator_course_id', 'is', null);
  if (rolesErr) throw rolesErr;

  // 3. Profiles for all coordinator users
  const coordUserIds = [...new Set((coordRoles || []).map((r) => r.user_id))];
  let profileMap = {};
  if (coordUserIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email')
      .in('id', coordUserIds);
    for (const p of profiles || []) profileMap[p.id] = p;
  }

  // 4. Optional extra info rows
  const courseIds = (courses || []).map((c) => c.id);
  let extraMap = {};
  if (courseIds.length > 0) {
    const { data: extras } = await supabaseAdmin
      .from('contact_coordinator_info')
      .select('id, course_id, phone, custom_name')
      .in('course_id', courseIds);
    for (const e of extras || []) extraMap[e.course_id] = e;
  }

  // 5. Build a map: courseId → coordinator user_roles entry
  const coordByCourse = {};
  for (const cr of coordRoles || []) {
    coordByCourse[cr.coordinator_course_id] = cr;
  }

  // 6. Merge — only courses with an assigned coordinator
  const result = (courses || [])
    .map((course) => {
      const cr = coordByCourse[course.id];
      if (!cr) return null;
      const profile = profileMap[cr.user_id] ?? null;
      const extra   = extraMap[course.id]   ?? null;
      return {
        courseId:         course.id,
        courseCode:       course.code,
        courseName:       course.name,
        coordinatorId:    cr.user_id,
        coordinatorEmail: profile?.email   ?? null,
        coordinatorName:  profile?.name    ?? null,
        phone:            extra?.phone     ?? null,
        customName:       extra?.custom_name ?? null,
      };
    })
    .filter(Boolean);

  return result;
}

// ─── GET /api/contact/coordinators ───────────────────────────────────────────
async function listCoordinatorContacts(req, res) {
  try {
    const contacts = await buildCoordinatorContacts();
    res.set('Cache-Control', 'private, max-age=30');
    res.json(contacts);
  } catch (error) {
    console.error('Error listing coordinator contacts:', error);
    res.status(500).json({ error: 'Failed to fetch coordinator contacts' });
  }
}

// ─── PUT /api/contact/coordinators/:courseId ──────────────────────────────────
// Coordinator: only their assigned course. Admin: any course.
async function upsertCoordinatorContact(req, res) {
  try {
    const { courseId } = req.params;
    const { phone, customName } = req.body;

    // Coordinators may only update their own course
    if (req.user.activeRole === 'coordinator') {
      if (req.user.coordinatorCourseId !== courseId) {
        return res.status(403).json({ error: 'You may only edit your own course contact info' });
      }
    }

    const { error } = await supabaseAdmin
      .from('contact_coordinator_info')
      .upsert(
        {
          course_id:   courseId,
          phone:       phone       ?? null,
          custom_name: customName  ?? null,
        },
        { onConflict: 'course_id' }
      );

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error upserting coordinator contact:', error);
    res.status(500).json({ error: 'Failed to save coordinator contact info' });
  }
}

// ─── DELETE /api/contact/coordinators/:courseId ───────────────────────────────
// Admin only — removes the extra-info row (phone/customName) for a course.
async function deleteCoordinatorContact(req, res) {
  try {
    const { courseId } = req.params;

    const { error } = await supabaseAdmin
      .from('contact_coordinator_info')
      .delete()
      .eq('course_id', courseId);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting coordinator contact:', error);
    res.status(500).json({ error: 'Failed to remove coordinator contact info' });
  }
}

// ─── GET /api/contact/support ─────────────────────────────────────────────────
async function getSupportInfo(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_support_info')
      .select('id, support_email, phone, description, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    res.set('Cache-Control', 'private, max-age=60');
    res.json(
      data
        ? {
            id:           data.id,
            supportEmail: data.support_email,
            phone:        data.phone        ?? null,
            description:  data.description  ?? null,
          }
        : null
    );
  } catch (error) {
    console.error('Error fetching support info:', error);
    res.status(500).json({ error: 'Failed to fetch support info' });
  }
}

// ─── PUT /api/contact/support ─────────────────────────────────────────────────
// Admin only — upsert the support info row (singleton pattern).
async function upsertSupportInfo(req, res) {
  try {
    const { supportEmail, phone, description } = req.body;

    if (!supportEmail || typeof supportEmail !== 'string' || !supportEmail.trim()) {
      return res.status(400).json({ error: 'supportEmail is required' });
    }

    // Fetch existing row (if any) so we can reuse its id for upsert
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from('contact_support_info')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectErr) throw selectErr;

    const payload = {
      support_email: supportEmail.trim(),
      phone:         phone       ?? null,
      description:   description ?? null,
    };

    if (existing?.id) {
      const { error } = await supabaseAdmin
        .from('contact_support_info')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin
        .from('contact_support_info')
        .insert(payload);
      if (error) throw error;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error upserting support info:', error);
    // 42P01 = PostgreSQL "relation does not exist" — migration not yet applied
    if (error?.code === '42P01') {
      return res.status(503).json({ error: 'Database table not found. Please run migration 013 in the Supabase SQL Editor.' });
    }
    // Pass through Supabase error messages for other DB issues
    if (error?.message) {
      return res.status(500).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to save support info' });
  }
}

module.exports = {
  listCoordinatorContacts,
  upsertCoordinatorContact,
  deleteCoordinatorContact,
  getSupportInfo,
  upsertSupportInfo,
};
