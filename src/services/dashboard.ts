import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';

export interface AdminStats {
  totalStudents: number;
  overdueSubmissions: number;
  upcomingDeadlines: number;
  completedProjects: number;
  completionRate: number;
}

export interface SubmissionVolumeDay {
  day: string;
  count: number;
}

export interface CourseEvaluationProgress {
  course: string;
  evaluated: number;
  total: number;
  percent: number;
}

export interface EvaluationProgress {
  courses: CourseEvaluationProgress[];
  overallEvaluated: number;
  overallTotal: number;
  overallPercent: number;
}

export interface UpcomingEvent {
  title: string;
  date: string;
  detail: string;
  color: 'blue' | 'purple' | 'green' | 'amber';
}

export interface ActivityEntry {
  id: string;
  message: string;
  time: string;
  color: string;
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

export async function getAdminStats(courseId?: string): Promise<AdminStats> {
  const key = courseId ?? '';
  const cached = _adminStatsCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const now = new Date().toISOString();
    const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    if (courseId) {
      // Coordinator scope: filter everything by course
      const { data: groupRows } = await supabase
        .from('groups')
        .select('id')
        .eq('course_id', courseId);
      const groupIds = (groupRows || []).map((g: any) => g.id);
      const groupFilter = groupIds.length > 0 ? groupIds : ['__none__'];

      const [studentResult, upcomingResult, assessmentResult, overdueResult] = await Promise.all([
        supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupFilter),
        supabase
          .from('milestones')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', courseId)
          .eq('visible', true)
          .gt('due_date', now)
          .lt('due_date', in7Days),
        supabase
          .from('supervisor_assessments')
          .select('student_id', { count: 'exact', head: true })
          .eq('course_id', courseId),
        supabase
          .from('submissions')
          .select('id, milestone:milestones!milestone_id(due_date, course_id)')
          .in('status', ['submitted', 'changes_requested']),
      ]);

      const overdueCount = (overdueResult.data || []).filter(
        (s: any) =>
          s.milestone?.course_id === courseId &&
          s.milestone?.due_date &&
          new Date(s.milestone.due_date) < new Date()
      ).length;

      const totalStudents = studentResult.count ?? 0;
      const completedProjects = assessmentResult.count ?? 0;

      const result: AdminStats = {
        totalStudents,
        overdueSubmissions: overdueCount,
        upcomingDeadlines: upcomingResult.count ?? 0,
        completedProjects,
        completionRate: totalStudents > 0 ? Math.round((completedProjects / totalStudents) * 100) : 0,
      };
      _adminStatsCache.set(key, { data: result, fetchedAt: Date.now() });
      return result;
    }

    // Admin scope: all courses
    const [studentResult, upcomingResult, assessmentResult, overdueResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'student'),
      supabase
        .from('milestones')
        .select('*', { count: 'exact', head: true })
        .eq('visible', true)
        .gt('due_date', now)
        .lt('due_date', in7Days),
      supabase
        .from('supervisor_assessments')
        .select('student_id', { count: 'exact', head: true }),
      supabase
        .from('submissions')
        .select('id, milestone:milestones!milestone_id(due_date)')
        .in('status', ['submitted', 'changes_requested']),
    ]);

    const overdueCount = (overdueResult.data || []).filter(
      (s: any) => s.milestone?.due_date && new Date(s.milestone.due_date) < new Date()
    ).length;

    const totalStudents = studentResult.count ?? 0;
    const completedProjects = assessmentResult.count ?? 0;

    const result: AdminStats = {
      totalStudents,
      overdueSubmissions: overdueCount,
      upcomingDeadlines: upcomingResult.count ?? 0,
      completedProjects,
      completionRate: totalStudents > 0 ? Math.round((completedProjects / totalStudents) * 100) : 0,
    };
    _adminStatsCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return { totalStudents: 0, overdueSubmissions: 0, upcomingDeadlines: 0, completedProjects: 0, completionRate: 0 };
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getSubmissionVolumeLastWeek(courseId?: string): Promise<SubmissionVolumeDay[]> {
  const key = courseId ?? '';
  const cached = _submissionVolumeCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('submissions')
      .select('created_at')
      .gte('created_at', sevenDaysAgo);

    if (courseId) {
      query = (query as any).eq('course_id', courseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const days: { day: string; date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push({
        day: DAY_NAMES[d.getDay()],
        date: d.toISOString().split('T')[0],
        count: 0,
      });
    }

    (data || []).forEach((s: any) => {
      const dateStr = new Date(s.created_at).toISOString().split('T')[0];
      const entry = days.find(d => d.date === dateStr);
      if (entry) entry.count++;
    });

    const result = days.map(({ day, count }) => ({ day, count }));
    _submissionVolumeCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching submission volume:', error);
    return [];
  }
}

export async function getEvaluationProgressByCourse(courseId?: string): Promise<EvaluationProgress> {
  const key = courseId ?? '';
  const cached = _evaluationProgressCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    let courses: { id: string; code: string }[] = [];

    if (courseId) {
      const { data } = await supabase
        .from('courses')
        .select('id, code')
        .eq('id', courseId);
      courses = data || [];
    } else {
      const { data } = await supabase
        .from('courses')
        .select('id, code')
        .in('code', ['CPIS-498', 'CPIS-499']);
      courses = data || [];
    }

    const courseResults: CourseEvaluationProgress[] = [];

    for (const course of courses) {
      const { data: groups } = await supabase
        .from('groups')
        .select('id')
        .eq('course_id', course.id);

      const groupIds = (groups || []).map((g: any) => g.id);

      const [{ count: totalStudents }, { count: evaluatedStudents }] = await Promise.all([
        supabase
          .from('group_members')
          .select('*', { count: 'exact', head: true })
          .in('group_id', groupIds.length > 0 ? groupIds : ['__none__']),
        supabase
          .from('supervisor_assessments')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id),
      ]);

      const total = totalStudents ?? 0;
      const evaluated = evaluatedStudents ?? 0;
      const percent = total > 0 ? Math.round((evaluated / total) * 100) : 0;
      const displayCode = course.code.replace('_', '-');

      courseResults.push({ course: displayCode, evaluated, total, percent });
    }

    const overallTotal = courseResults.reduce((sum, c) => sum + c.total, 0);
    const overallEvaluated = courseResults.reduce((sum, c) => sum + c.evaluated, 0);
    const overallPercent = overallTotal > 0 ? Math.round((overallEvaluated / overallTotal) * 100) : 0;

    const result: EvaluationProgress = { courses: courseResults, overallEvaluated, overallTotal, overallPercent };
    _evaluationProgressCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching evaluation progress:', error);
    return { courses: [], overallEvaluated: 0, overallTotal: 0, overallPercent: 0 };
  }
}

export async function getRecentActivity(limit = 5): Promise<ActivityEntry[]> {
  const key = String(limit);
  const cached = _recentActivityCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, action, entity, context, timestamp')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const colors = ['blue', 'green', 'purple', 'amber', 'gray'];
    const result = (data || []).map((entry: any, index: number) => ({
      id: entry.id,
      message: `${entry.action}${entry.entity ? ' ' + entry.entity : ''}${entry.context ? ' — ' + entry.context : ''}`,
      time: timeAgo(entry.timestamp),
      color: colors[index % colors.length],
    }));
    _recentActivityCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

const calendarTypeColor: Record<string, UpcomingEvent['color']> = {
  deadline: 'amber',
  demo: 'purple',
  presentation: 'blue',
  meeting: 'green',
};

const calendarTypeLabel: Record<string, string> = {
  deadline: 'Deadline',
  demo: 'Demo',
  presentation: 'Presentation',
  meeting: 'Meeting',
};

// ─── KPI Analytics ────────────────────────────────────────────────────────────

export interface KpiData {
  totalActiveProjects: number;
  sparkline: number[];             // 6 weekly submission counts, oldest→newest
  submissionActivityRate: number;  // 0–100 %
  activeGroupsCount: number;
  totalGroupsCount: number;
  reviewCompletionRate: number;    // 0–100 %
  reviewedCount: number;
  totalNonDraftCount: number;
  pendingReviewGroups: number;
  noRecentSubmissionGroups: number;
  overdueGroups: number;
  totalAttentionCount: number;
}

export interface CourseKpi {
  courseId: string;
  courseCode: string;
  courseName: string;
  kpi: KpiData;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const DASHBOARD_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> { data: T; fetchedAt: number }

function _isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.fetchedAt < DASHBOARD_CACHE_TTL;
}

const _adminStatsCache          = new Map<string, CacheEntry<AdminStats>>();
const _submissionVolumeCache    = new Map<string, CacheEntry<SubmissionVolumeDay[]>>();
const _evaluationProgressCache  = new Map<string, CacheEntry<EvaluationProgress>>();
const _recentActivityCache      = new Map<string, CacheEntry<ActivityEntry[]>>();
const _kpiDataCache             = new Map<string, CacheEntry<KpiData>>();
const _allCourseKpisCache       = new Map<string, CacheEntry<CourseKpi[]>>();
const _upcomingEventsCache      = new Map<string, CacheEntry<UpcomingEvent[]>>();

export function clearDashboardCache() {
  _adminStatsCache.clear();
  _submissionVolumeCache.clear();
  _evaluationProgressCache.clear();
  _recentActivityCache.clear();
  _kpiDataCache.clear();
  _allCourseKpisCache.clear();
  _upcomingEventsCache.clear();
}

const KPI_EMPTY: KpiData = {
  totalActiveProjects: 0, sparkline: [0, 0, 0, 0, 0, 0],
  submissionActivityRate: 0, activeGroupsCount: 0, totalGroupsCount: 0,
  reviewCompletionRate: 0, reviewedCount: 0, totalNonDraftCount: 0,
  pendingReviewGroups: 0, noRecentSubmissionGroups: 0, overdueGroups: 0, totalAttentionCount: 0,
};

export async function getKpiData(courseId?: string, since?: string): Promise<KpiData> {
  const key = `${courseId ?? ''}:${since ?? ''}`;
  const cached = _kpiDataCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const now = new Date().toISOString();
    const sixWeeksAgo  = new Date(Date.now() - 42 * 24 * 3_600_000).toISOString();

    // Groups in scope (approved projects only) — include course_id for overdue scoping
    let groupsQ = supabase.from('groups').select('id, course_id').eq('status', 'approved');
    if (courseId) groupsQ = (groupsQ as any).eq('course_id', courseId);
    const { data: groupRows } = await groupsQ;
    const groupIds = (groupRows ?? []).map((g: any) => g.id as string);
    const totalGroups = groupIds.length;
    const safe = groupIds.length > 0 ? groupIds : ['__none__'];

    // Base queries — optionally scoped to a time window via `since`
    const recentBase = supabase.from('submissions').select('group_id').in('group_id', safe);
    const allSubsBase = supabase.from('submissions').select('group_id, status').in('group_id', safe).neq('status', 'draft');

    // Parallel DB queries
    const [recentR, allSubsR, sparkR, overdueMillR] = await Promise.all([
      since ? recentBase.gte('created_at', since) : recentBase,
      since ? allSubsBase.gte('created_at', since) : allSubsBase,
      supabase.from('submissions').select('created_at').in('group_id', safe).gte('created_at', sixWeeksAgo),
      courseId
        ? supabase.from('milestones').select('id, course_id').eq('course_id', courseId).eq('visible', true).lt('due_date', now)
        : supabase.from('milestones').select('id, course_id').eq('visible', true).lt('due_date', now),
    ]);

    // KPI 2 – Submission Activity Rate
    const recentGroupIds = new Set((recentR.data ?? []).map((s: any) => s.group_id as string).filter(Boolean));
    const activeGroupsCount = recentGroupIds.size;
    const submissionActivityRate = totalGroups > 0 ? Math.round((activeGroupsCount / totalGroups) * 100) : 0;

    // KPI 3 – Review Completion Rate
    const allSubs = allSubsR.data ?? [];
    const totalNonDraft = allSubs.length;
    const reviewedCount = allSubs.filter((s: any) =>
      ['approved', 'changes_requested', 'under_review'].includes(s.status)
    ).length;
    const reviewCompletionRate = totalNonDraft > 0 ? Math.round((reviewedCount / totalNonDraft) * 100) : 0;

    // KPI 4a – Pending Review groups
    const pendingGroupIds = new Set(
      allSubs.filter((s: any) => s.status === 'submitted').map((s: any) => s.group_id as string).filter(Boolean)
    );

    // KPI 4b – Overdue groups
    // A group is overdue only if its own course has a past-due milestone it hasn't submitted for.
    // Cross-course milestone IDs must not inflate counts for groups in other courses.
    const overdueMilestoneIds = (overdueMillR.data ?? []).map((m: any) => m.id as string);
    const coursesWithOverdue = new Set((overdueMillR.data ?? []).map((m: any) => m.course_id as string).filter(Boolean));
    let overdueGroups = 0;
    if (overdueMilestoneIds.length > 0 && groupIds.length > 0) {
      // Only consider groups whose course actually has overdue milestones
      const eligibleGroupIds = (groupRows ?? [])
        .filter((g: any) => coursesWithOverdue.has(g.course_id))
        .map((g: any) => g.id as string);
      if (eligibleGroupIds.length > 0) {
        const eligibleSafe = eligibleGroupIds.length > 0 ? eligibleGroupIds : ['__none__'];
        const { data: subForOverdue } = await supabase
          .from('submissions').select('group_id')
          .in('group_id', eligibleSafe).in('milestone_id', overdueMilestoneIds).neq('status', 'draft');
        const submittedGroupIds = new Set((subForOverdue ?? []).map((s: any) => s.group_id as string).filter(Boolean));
        overdueGroups = Math.max(0, eligibleGroupIds.length - submittedGroupIds.size);
      }
    }

    // Sparkline – 6 weekly buckets (index 0 = 6 weeks ago, 5 = current week)
    const weekCounts = Array<number>(6).fill(0);
    const nowMs = Date.now();
    (sparkR.data ?? []).forEach((s: any) => {
      const idx = 5 - Math.min(Math.floor((nowMs - new Date(s.created_at).getTime()) / (7 * 24 * 3_600_000)), 5);
      if (idx >= 0) weekCounts[idx]++;
    });

    const result: KpiData = {
      totalActiveProjects: totalGroups,
      sparkline: weekCounts,
      submissionActivityRate,
      activeGroupsCount,
      totalGroupsCount: totalGroups,
      reviewCompletionRate,
      reviewedCount,
      totalNonDraftCount: totalNonDraft,
      pendingReviewGroups: pendingGroupIds.size,
      noRecentSubmissionGroups: 0,
      overdueGroups,
      totalAttentionCount: pendingGroupIds.size + overdueGroups,
    };
    _kpiDataCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('Error fetching KPI data:', err);
    return { ...KPI_EMPTY };
  }
}

export async function getAllCourseKpis(since?: string): Promise<CourseKpi[]> {
  const key = since ?? '';
  const cached = _allCourseKpisCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data: courses } = await supabase.from('courses').select('id, code, name').order('code');
    if (!courses?.length) return [];
    const result = await Promise.all(
      (courses as any[]).map(async (c) => ({
        courseId: c.id as string,
        courseCode: (c.code as string).replace('_', '-'),
        courseName: c.name as string,
        kpi: await getKpiData(c.id, since),
      }))
    );
    _allCourseKpisCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    console.error('Error fetching all course KPIs:', err);
    return [];
  }
}

export async function getUpcomingEvents(limit?: number, courseId?: string): Promise<UpcomingEvent[]> {
  const key = `${limit ?? ''}:${courseId ?? ''}`;
  const cached = _upcomingEventsCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const now = new Date();
    const nowIso = now.toISOString();

    // Fetch milestones
    let milestoneQuery = supabase
      .from('milestones')
      .select('id, name, due_date, course:courses!course_id(code)')
      .eq('visible', true)
      .gt('due_date', nowIso)
      .order('due_date');

    if (courseId) {
      milestoneQuery = (milestoneQuery as any).eq('course_id', courseId);
    }

    // Fetch calendar events via API
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token ?? '';
    const calendarPromise = apiFetch('/api/calendar-events', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : []).catch(() => []);

    const [{ data: milestoneData, error }, calendarData] = await Promise.all([
      milestoneQuery,
      calendarPromise,
    ]);

    if (error) throw error;

    const milestoneEvents: (UpcomingEvent & { _sortDate: Date })[] = (milestoneData || []).map((m: any) => ({
      title: m.name,
      date: new Date(m.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      detail: m.course?.code?.replace('_', '-') ?? 'Milestone',
      color: 'amber' as const,
      _sortDate: new Date(m.due_date),
    }));

    const calendarEvents: (UpcomingEvent & { _sortDate: Date })[] = (calendarData as any[])
      .filter((e: any) => {
        const eventDate = new Date(e.date);
        if (eventDate < now) return false;
        if (courseId && e.courseId && e.courseId !== courseId) return false;
        return true;
      })
      .map((e: any) => ({
        title: e.title,
        date: new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        detail: [calendarTypeLabel[e.type] ?? e.type, e.time, e.location].filter(Boolean).join(' · '),
        color: calendarTypeColor[e.type] ?? 'blue',
        _sortDate: new Date(e.date),
      }));

    const merged = [...milestoneEvents, ...calendarEvents]
      .sort((a, b) => a._sortDate.getTime() - b._sortDate.getTime())
      .map(({ _sortDate: _d, ...event }) => event);

    const result = limit !== undefined ? merged.slice(0, limit) : merged;
    _upcomingEventsCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }
}
