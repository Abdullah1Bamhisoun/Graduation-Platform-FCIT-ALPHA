import { supabase } from '../lib/supabase';

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

      return {
        totalStudents,
        overdueSubmissions: overdueCount,
        upcomingDeadlines: upcomingResult.count ?? 0,
        completedProjects,
        completionRate: totalStudents > 0 ? Math.round((completedProjects / totalStudents) * 100) : 0,
      };
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

    return {
      totalStudents,
      overdueSubmissions: overdueCount,
      upcomingDeadlines: upcomingResult.count ?? 0,
      completedProjects,
      completionRate: totalStudents > 0 ? Math.round((completedProjects / totalStudents) * 100) : 0,
    };
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return { totalStudents: 0, overdueSubmissions: 0, upcomingDeadlines: 0, completedProjects: 0, completionRate: 0 };
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export async function getSubmissionVolumeLastWeek(courseId?: string): Promise<SubmissionVolumeDay[]> {
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

    return days.map(({ day, count }) => ({ day, count }));
  } catch (error) {
    console.error('Error fetching submission volume:', error);
    return [];
  }
}

export async function getEvaluationProgressByCourse(courseId?: string): Promise<EvaluationProgress> {
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

    return { courses: courseResults, overallEvaluated, overallTotal, overallPercent };
  } catch (error) {
    console.error('Error fetching evaluation progress:', error);
    return { courses: [], overallEvaluated: 0, overallTotal: 0, overallPercent: 0 };
  }
}

export async function getRecentActivity(limit = 5): Promise<ActivityEntry[]> {
  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('id, action, entity, context, timestamp')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const colors = ['blue', 'green', 'purple', 'amber', 'gray'];
    return (data || []).map((entry: any, index: number) => ({
      id: entry.id,
      message: `${entry.action}${entry.entity ? ' ' + entry.entity : ''}${entry.context ? ' — ' + entry.context : ''}`,
      time: timeAgo(entry.timestamp),
      color: colors[index % colors.length],
    }));
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    return [];
  }
}

export async function getUpcomingEvents(limit = 3, courseId?: string): Promise<UpcomingEvent[]> {
  try {
    const now = new Date().toISOString();

    let query = supabase
      .from('milestones')
      .select('id, name, due_date, course:courses!course_id(code)')
      .eq('visible', true)
      .gt('due_date', now)
      .order('due_date')
      .limit(limit);

    if (courseId) {
      query = (query as any).eq('course_id', courseId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const colors: ('blue' | 'purple' | 'green' | 'amber')[] = ['blue', 'purple', 'green', 'amber'];
    return (data || []).map((m: any, index: number) => ({
      title: m.name,
      date: new Date(m.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      detail: m.course?.code?.replace('_', '-') ?? '',
      color: colors[index % colors.length],
    }));
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }
}
