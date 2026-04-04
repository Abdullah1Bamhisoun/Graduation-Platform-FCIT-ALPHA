import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoordinatorContact {
  courseId: string;
  courseCode: string;
  courseName: string;
  coordinatorId: string | null;
  coordinatorEmail: string | null;
  coordinatorName: string | null;
  phone: string | null;
  customName: string | null;
}

export interface SupportInfo {
  id: string | null;
  supportEmail: string;
  phone: string | null;
  description: string | null;
}

// ─── Coordinator Contacts ─────────────────────────────────────────────────────

export async function getCoordinatorContacts(): Promise<CoordinatorContact[]> {
  try {
    // 1. All courses
    const { data: courses, error: coursesErr } = await supabase
      .from('courses')
      .select('id, code, name')
      .order('code');
    if (coursesErr) throw coursesErr;

    // 2. All coordinator role assignments
    const { data: coordRoles, error: rolesErr } = await supabase
      .from('user_roles')
      .select('user_id, coordinator_course_id, roles!inner(name)')
      .eq('roles.name', 'coordinator')
      .not('coordinator_course_id', 'is', null);
    if (rolesErr) throw rolesErr;

    // 3. Profiles for coordinator users
    const coordUserIds = [...new Set((coordRoles || []).map((r: any) => r.user_id))];
    const profileMap: Record<string, any> = {};
    if (coordUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', coordUserIds);
      for (const p of profiles || []) profileMap[(p as any).id] = p;
    }

    // 4. Optional extra info rows
    const courseIds = (courses || []).map((c: any) => c.id);
    const extraMap: Record<string, any> = {};
    if (courseIds.length > 0) {
      const { data: extras } = await supabase
        .from('contact_coordinator_info')
        .select('id, course_id, phone, custom_name')
        .in('course_id', courseIds);
      for (const e of extras || []) extraMap[(e as any).course_id] = e;
    }

    // 5. Map courseId → coordinator role entry
    const coordByCourse: Record<string, any> = {};
    for (const cr of coordRoles || []) {
      coordByCourse[(cr as any).coordinator_course_id] = cr;
    }

    // 6. Merge — only courses with an assigned coordinator
    return (courses || [])
      .map((course: any) => {
        const cr = coordByCourse[course.id];
        if (!cr) return null;
        const profile = profileMap[cr.user_id] ?? null;
        const extra   = extraMap[course.id]    ?? null;
        return {
          courseId:         course.id,
          courseCode:       course.code,
          courseName:       course.name,
          coordinatorId:    cr.user_id,
          coordinatorEmail: profile?.email      ?? null,
          coordinatorName:  profile?.name       ?? null,
          phone:            extra?.phone        ?? null,
          customName:       extra?.custom_name  ?? null,
        } as CoordinatorContact;
      })
      .filter(Boolean) as CoordinatorContact[];
  } catch (error) {
    console.error('Error fetching coordinator contacts:', error);
    return [];
  }
}

export async function upsertCoordinatorContact(
  courseId: string,
  data: { phone?: string | null; customName?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from('contact_coordinator_info')
    .upsert(
      {
        course_id:   courseId,
        phone:       data.phone       ?? null,
        custom_name: data.customName  ?? null,
      },
      { onConflict: 'course_id' }
    );
  if (error) throw error;
}

export async function deleteCoordinatorContact(courseId: string): Promise<void> {
  const { error } = await supabase
    .from('contact_coordinator_info')
    .delete()
    .eq('course_id', courseId);
  if (error) throw error;
}

// ─── Support Info ─────────────────────────────────────────────────────────────

export async function getSupportInfo(): Promise<SupportInfo | null> {
  try {
    const { data, error } = await supabase
      .from('contact_support_info')
      .select('id, support_email, phone, description, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id:           (data as any).id,
      supportEmail: (data as any).support_email,
      phone:        (data as any).phone       ?? null,
      description:  (data as any).description ?? null,
    };
  } catch (error) {
    console.error('Error fetching support info:', error);
    return null;
  }
}

export async function upsertSupportInfo(data: {
  supportEmail: string;
  phone?: string | null;
  description?: string | null;
}): Promise<void> {
  if (!data.supportEmail?.trim()) throw new Error('supportEmail is required');

  // Fetch existing row to decide update vs insert (singleton pattern)
  const { data: existing } = await supabase
    .from('contact_support_info')
    .select('id')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    support_email: data.supportEmail.trim(),
    phone:         data.phone        ?? null,
    description:   data.description  ?? null,
  };

  if ((existing as any)?.id) {
    const { error } = await supabase
      .from('contact_support_info')
      .update(payload)
      .eq('id', (existing as any).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('contact_support_info')
      .insert(payload);
    if (error) throw error;
  }
}
