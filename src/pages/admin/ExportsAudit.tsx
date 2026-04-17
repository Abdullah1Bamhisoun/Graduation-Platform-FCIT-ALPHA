import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAuditLog } from '../../services/audit';
import { getAllCourses, getCourseById, getCourseTypeFromUUID } from '../../services/courses';
import { getCoordinatorGroupsWithGrades } from '../../services/groups';
import {
  getGradingComponents,
  getAllRubricCriteria,
  getStudentOutcomes,
} from '../../services/grading-rubric';
import { supabase } from '../../lib/supabase';
import type { CoordinatorGroupWithGrades } from '../../services/groups';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { Download, FileText, BarChart3, Activity, X, ClipboardList, Calendar, Users, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditLogEntry, Course } from '../../types';

// ── Excel helpers ─────────────────────────────────────────────────────────────

/** Apply auto-fit column widths and row heights to a sheet in-place. */
function autoFitSheet(ws: XLSX.WorkSheet, allRows: (string | number)[][]) {
  if (allRows.length === 0) return;
  ws['!cols'] = allRows[0].map((_, ci) => ({
    wch: Math.max(...allRows.map(row => String(row[ci] ?? '').length)) + 2,
  }));
  ws['!rows'] = [{ hpt: 22 }, ...allRows.slice(1).map(() => ({ hpt: 18 }))];
}

function downloadXlsx(wb: XLSX.WorkBook, filename: string) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function toCsv(rows: string[][]): string {
  return rows
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

function triggerDownload(content: string, filename: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\uFEFF' + content, ''], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface RecentExport {
  id: string;
  date: string;
  type: 'grades' | 'submissions' | 'activity';
  courseName: string;
  format: string;
}

const RECENT_EXPORTS_KEY = 'recentExports';

function loadRecentExports(): RecentExport[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_EXPORTS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecentExport(entry: RecentExport) {
  const existing = loadRecentExports();
  const updated = [entry, ...existing].slice(0, 20);
  localStorage.setItem(RECENT_EXPORTS_KEY, JSON.stringify(updated));
}

export function AdminExportsAudit() {
  const { user } = useAuth();
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'grades' | 'submissions' | 'activity' | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [filterAction, setFilterAction] = useState('All Actions');
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('Excel (.xlsx)');
  const [recentExports, setRecentExports] = useState<RecentExport[]>(loadRecentExports);

  const isCoordinator = user?.activeRole === 'coordinator';

  useEffect(() => {
    getAuditLog().then(setAuditLog);

    if (isCoordinator && user?.coordinatorCourseId) {
      getCourseById(user.coordinatorCourseId).then((course) => {
        if (course) {
          setCourses([course]);
          setSelectedCourse(course.id);
        }
      });
    } else {
      getAllCourses().then((all) => {
        setCourses(all);
        setSelectedCourse('');
      });
    }
  }, [isCoordinator, user?.coordinatorCourseId]);

  if (!user) return null;

  // Derived audit stats
  const today = new Date().toDateString();
  const todayEntries = auditLog.filter(e => new Date(e.timestamp).toDateString() === today).length;
  const uniqueActors = new Set(auditLog.map(e => e.actor)).size;

  // Coordinators see only audit entries where they are the actor
  const scopedLog = isCoordinator
    ? auditLog.filter(entry => entry.actor.startsWith(user.name))
    : auditLog;

  const filteredLog = scopedLog.filter(entry =>
    filterAction === 'All Actions' || entry.action === filterAction
  );

  const handleExport = async () => {
    const type = exportType;
    const courseId = selectedCourse;
    const from = dateRange.from ? new Date(dateRange.from) : null;
    const to = dateRange.to ? new Date(dateRange.to + 'T23:59:59') : null;
    const dateStr = new Date().toISOString().split('T')[0];
    const selectedCourseObj = courses.find(c => c.id === courseId);
    const courseSlug = selectedCourseObj ? selectedCourseObj.code : 'All-Courses';

    setShowExportModal(false);
    setExportType(null);
    toast.loading('Preparing export…', { id: 'export' });

    try {
      // ── Grades ────────────────────────────────────────────────────────────
      if (type === 'grades') {
        // Determine which courseType(s) to fetch
        let courseTypesToFetch: ('498' | '499')[] = [];
        if (courseId) {
          const ct = await getCourseTypeFromUUID(courseId);
          if (ct) courseTypesToFetch = [ct];
        } else {
          courseTypesToFetch = ['498', '499'];
        }

        const allGroups: CoordinatorGroupWithGrades[] = [];
        const componentMetaMap = new Map<string, { name: string; maxScore: number; key: string }>();

        // Fetch components, groups, rubric criteria, and SOs for each courseType
        type CriteriaAndSOs = {
          criteria: Awaited<ReturnType<typeof getAllRubricCriteria>>;
          outcomes498: Awaited<ReturnType<typeof getStudentOutcomes>>;
          outcomes499: Awaited<ReturnType<typeof getStudentOutcomes>>;
        };
        const criteriaAndSOsByCT = new Map<'498' | '499', CriteriaAndSOs>();

        await Promise.all(courseTypesToFetch.map(async (ct) => {
          const [components, groups, criteria, so498, so499] = await Promise.all([
            getGradingComponents(ct),
            getCoordinatorGroupsWithGrades(ct, user.activeRole),
            getAllRubricCriteria(ct),
            getStudentOutcomes('498'),
            getStudentOutcomes('499'),
          ]);
          for (const c of components) {
            if (!componentMetaMap.has(c.componentKey)) {
              componentMetaMap.set(c.componentKey, { key: c.componentKey, name: c.componentName, maxScore: c.totalMarks });
            }
          }
          allGroups.push(...groups);
          criteriaAndSOsByCT.set(ct, { criteria, outcomes498: so498, outcomes499: so499 });
        }));

        const componentMeta = Array.from(componentMetaMap.values());
        const totalMax = componentMeta.reduce((s, c) => s + c.maxScore, 0);
        const allGroupIds = allGroups.map(g => g.id);

        // Per-student peer scores
        const peerComp = componentMeta.find(c => c.key === 'peer_review');
        const peerScoreByStudent = new Map<string, number>();
        if (peerComp && allGroupIds.length > 0) {
          const { data: peerRows } = await supabase
            .from('peer_evaluations')
            .select('student_id, score')
            .in('group_id', allGroupIds);
          const rawByStudent = new Map<string, number[]>();
          for (const pe of peerRows ?? []) {
            if (!rawByStudent.has(pe.student_id)) rawByStudent.set(pe.student_id, []);
            rawByStudent.get(pe.student_id)!.push(Number(pe.score));
          }
          for (const [sid, scores] of rawByStudent) {
            peerScoreByStudent.set(sid, scores.reduce((s, v) => s + v, 0) / scores.length);
          }
        }

        // Bulk-fetch all coordinator_evaluations for all groups
        const coordEvalByGroup = new Map<string, Map<string, number>>(); // groupId → criterionKey → rawScore
        if (allGroupIds.length > 0) {
          const { data: evalRows } = await supabase
            .from('coordinator_evaluations')
            .select('group_id, criterion_key, raw_score')
            .in('group_id', allGroupIds);
          for (const row of evalRows ?? []) {
            if (!coordEvalByGroup.has(row.group_id)) coordEvalByGroup.set(row.group_id, new Map());
            coordEvalByGroup.get(row.group_id)!.set(row.criterion_key, Number(row.raw_score));
          }
        }

        // ── Sheet 1: Grades Summary (per student) ─────────────────────────
        const summaryHeaders: string[] = [
          'Course', 'Group Code', 'Project Name', 'Supervisor',
          'Student Name', 'Student ID',
          ...componentMeta.map(c => `${c.name} (/${c.maxScore})`),
          `Total Score (/${totalMax})`,
        ];
        const summaryRows: (string | number)[][] = [];
        for (const g of allGroups) {
          const scoreByKey = new Map(g.gradeComponents.map(c => [c.componentKey, c.score]));
          for (const student of g.students) {
            const scores = componentMeta.map(({ key }) => {
              if (key === 'peer_review') return peerScoreByStudent.get(student.id) ?? 0;
              const raw = scoreByKey.get(key);
              return raw != null ? Number(raw) : 0;
            });
            summaryRows.push([
              g.courseCode, g.groupCode ?? '', g.name, g.supervisorName ?? '',
              student.name, student.studentId ?? '',
              ...scores,
              scores.reduce((s, v) => s + v, 0),
            ]);
          }
        }

        // ── Sheet 2: Grade Details — merged SO headers, criteria sub-headers, per student ──
        // Row 0: Course | Group Code | ... | Student ID | SO1 (merged) | SO2 (merged) | ... | Total Score
        // Row 1: (blank fixed cols)           | Crit1 | Crit2 | ...    | Crit A | ... | (blank)
        // Data:  per student

        // Build SO groups for this sheet using all criteria across all course types
        const allCriteria = courseTypesToFetch.flatMap(ct => criteriaAndSOsByCT.get(ct)?.criteria ?? []);
        const allOutcomes = courseTypesToFetch.flatMap(ct => {
          const d = criteriaAndSOsByCT.get(ct)!;
          return ct === '498' ? d.outcomes498 : d.outcomes499;
        });
        // Deduplicate outcomes by id
        const seenSOIds = new Set<string>();
        const uniqueOutcomes = allOutcomes.filter(so => { if (seenSOIds.has(so.id)) return false; seenSOIds.add(so.id); return true; });

        const soGroups = uniqueOutcomes
          .map(so => ({ so, criteria: allCriteria.filter(c => c.studentOutcomes.some(s => s.id === so.id)) }))
          .filter(g => g.criteria.length > 0);
        const unlinkedCriteria = allCriteria.filter(c => c.studentOutcomes.length === 0);

        const fixedCols = ['Course', 'Group Code', 'Project Name', 'Supervisor', 'Student Name', 'Student ID'];
        const numFixed = fixedCols.length;

        // Build row0 (SO merged header row) and row1 (criterion name row)
        const detailRow0: (string | number)[] = [...fixedCols];
        const detailRow1: (string | number)[] = Array(numFixed).fill('');
        const detailMerges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

        // Merge fixed column headers vertically across rows 0 and 1
        for (let i = 0; i < numFixed; i++) {
          detailMerges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } });
        }

        let colCursor = numFixed;

        for (const group of soGroups) {
          detailRow0.push(`${group.so.code} — ${group.so.title}`);
          for (let i = 1; i < group.criteria.length; i++) detailRow0.push('');
          // Merge SO header horizontally across its criteria columns
          detailMerges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + group.criteria.length - 1 } });
          for (const c of group.criteria) {
            detailRow1.push(`${c.criterionName} (max ${c.maxRawScore})`);
          }
          colCursor += group.criteria.length;
        }

        if (unlinkedCriteria.length > 0) {
          detailRow0.push('Other Criteria');
          for (let i = 1; i < unlinkedCriteria.length; i++) detailRow0.push('');
          detailMerges.push({ s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + unlinkedCriteria.length - 1 } });
          for (const c of unlinkedCriteria) {
            detailRow1.push(`${c.criterionName} (max ${c.maxRawScore})`);
          }
          colCursor += unlinkedCriteria.length;
        }

        // Total Score column — merge vertically
        detailRow0.push('Total Score');
        detailRow1.push('');
        detailMerges.push({ s: { r: 0, c: colCursor }, e: { r: 1, c: colCursor } });

        // Data rows — one per student
        const detailDataRows: (string | number)[][] = [];
        for (const g of allGroups) {
          const evalMap = coordEvalByGroup.get(g.id) ?? new Map<string, number>();
          for (const student of g.students) {
            const row: (string | number)[] = [
              g.courseCode, g.groupCode ?? '', g.name, g.supervisorName ?? '',
              student.name, student.studentId ?? '',
            ];
            for (const group of soGroups) {
              for (const c of group.criteria) {
                row.push(evalMap.has(c.criterionKey) ? evalMap.get(c.criterionKey)! : '');
              }
            }
            for (const c of unlinkedCriteria) {
              row.push(evalMap.has(c.criterionKey) ? evalMap.get(c.criterionKey)! : '');
            }
            row.push(g.coordinatorEvaluation?.normalizedScore != null
              ? Number(g.coordinatorEvaluation.normalizedScore.toFixed(1))
              : '');
            detailDataRows.push(row);
          }
        }

        // ── Sheet 3: Student Outcomes & SO Scores ────────────────────────
        // Section A: SO definitions
        // Section B: Criteria × SO mapping matrix
        // Section C: Per-group score per SO (sum of raw scores for criteria tagged with that SO)
        const soSheetRows: (string | number)[][] = [];

        for (const ct of courseTypesToFetch) {
          const { criteria, outcomes498, outcomes499 } = criteriaAndSOsByCT.get(ct)!;
          const outcomes = ct === '498' ? outcomes498 : outcomes499;
          const ctGroups = allGroups.filter(g => g.courseType === ct);
          if (outcomes.length === 0 && criteria.length === 0) continue;

          // ── A: SO Definitions ──
          soSheetRows.push([`CPIS-${ct} — Student Outcome Definitions`]);
          soSheetRows.push(['Code', 'Title', 'Description']);
          for (const so of outcomes) {
            soSheetRows.push([so.code, so.title, so.description ?? '']);
          }
          soSheetRows.push([]);

          // ── B: Criteria × SO Mapping ──
          if (outcomes.length > 0 && criteria.length > 0) {
            soSheetRows.push([`CPIS-${ct} — Criteria × SO Mapping`]);
            soSheetRows.push([
              'Criterion', 'Component', 'Max Score',
              ...outcomes.map(s => s.code),
            ]);
            for (const c of criteria) {
              soSheetRows.push([
                c.criterionName,
                c.componentKey.replace(/_/g, ' '),
                c.maxRawScore,
                ...outcomes.map(so => c.studentOutcomes.some(s => s.id === so.id) ? '✓' : ''),
              ]);
            }
            soSheetRows.push([]);
          }

          // ── C: SO score pivot — SOs as row groups, groups as columns ──
          if (outcomes.length > 0 && ctGroups.length > 0) {
            soSheetRows.push([`CPIS-${ct} — Group Scores by Student Outcome`]);

            // Column header row: blank label col + one col per group
            soSheetRows.push([
              '',
              ...ctGroups.map(g => g.groupCode ?? g.name),
            ]);

            for (const so of outcomes) {
              const linkedCriteria = criteria.filter(c =>
                c.studentOutcomes.some(s => s.id === so.id)
              );

              // SO header row
              soSheetRows.push([`${so.code} — ${so.title}`]);

              // One sub-row per criterion linked to this SO
              for (const c of linkedCriteria) {
                soSheetRows.push([
                  `  ${c.criterionName} (max ${c.maxRawScore})`,
                  ...ctGroups.map(g => {
                    const evalMap = coordEvalByGroup.get(g.id) ?? new Map<string, number>();
                    return evalMap.has(c.criterionKey) ? evalMap.get(c.criterionKey)! : '';
                  }),
                ]);
              }

              // SO total row
              const soMax = linkedCriteria.reduce((s, c) => s + c.maxRawScore, 0);
              soSheetRows.push([
                `  ${so.code} Total (max ${soMax})`,
                ...ctGroups.map(g => {
                  const evalMap = coordEvalByGroup.get(g.id) ?? new Map<string, number>();
                  return linkedCriteria.reduce((sum, c) => sum + (evalMap.get(c.criterionKey) ?? 0), 0);
                }),
              ]);

              soSheetRows.push([]); // blank row between SOs
            }

            // Grand total normalized score row
            const normMax = ctGroups[0]?.coordinatorEvaluation?.maxScore ?? '';
            soSheetRows.push([
              `Total Normalized Score (max ${normMax})`,
              ...ctGroups.map(g =>
                g.coordinatorEvaluation?.normalizedScore != null
                  ? Number(g.coordinatorEvaluation.normalizedScore.toFixed(1))
                  : ''
              ),
            ]);

            soSheetRows.push([]);
          }
        }

        if (selectedFormat === 'Excel (.xlsx)') {
          const wb = XLSX.utils.book_new();

          // Sheet 1: Grades Summary
          const wsSummary = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
          autoFitSheet(wsSummary, [summaryHeaders, ...summaryRows]);
          XLSX.utils.book_append_sheet(wb, wsSummary, 'Grades Summary');

          // Sheet 2: Grade Details (always included)
          const wsDetail = XLSX.utils.aoa_to_sheet(
            detailDataRows.length > 0
              ? [detailRow0, detailRow1, ...detailDataRows]
              : [detailRow0, detailRow1, ['No evaluation data yet']]
          );
          wsDetail['!merges'] = detailMerges;
          autoFitSheet(wsDetail, [detailRow0, detailRow1]);
          XLSX.utils.book_append_sheet(wb, wsDetail, 'Grade Details');

          // Sheet 3: Student Outcomes (always included)
          const soData = soSheetRows.length > 0
            ? soSheetRows
            : [['No student outcomes defined yet — add them in the Grade Scheme Editor.']];
          const wsSO = XLSX.utils.aoa_to_sheet(soData);
          autoFitSheet(wsSO, soData);
          XLSX.utils.book_append_sheet(wb, wsSO, 'Student Outcomes');

          downloadXlsx(wb, `grades-report-${courseSlug}-${dateStr}.xlsx`);
        } else {
          // CSV fallback — only Grades Summary
          triggerDownload(
            toCsv([summaryHeaders.map(String), ...summaryRows.map(r => r.map(String))]),
            `grades-report-${courseSlug}-${dateStr}.csv`
          );
        }
      }

      // ── Submissions ───────────────────────────────────────────────────────
      if (type === 'submissions') {
        const { data: subs, error } = await supabase
          .from('submissions')
          .select(`
            status, current_version, updated_at,
            milestone:milestones!milestone_id(name, course:courses!course_id(id, code)),
            student:profiles!student_id(name, student_id),
            group:groups!group_id(group_code, project_name)
          `)
          .order('updated_at', { ascending: false });

        if (error) throw error;

        const filtered = (subs ?? []).filter((s: any) => {
          const courseMatch = !courseId || s.milestone?.course?.id === courseId;
          const t = s.updated_at ? new Date(s.updated_at) : null;
          const dateMatch = (!from || (t && t >= from)) && (!to || (t && t <= to));
          return courseMatch && dateMatch;
        });

        const subHeaders = [
          'Course', 'Group Code', 'Project Name', 'Student Name', 'Student ID',
          'Milestone', 'Status', 'Version', 'Submitted At',
        ];
        const subRows: string[][] = filtered.map((s: any) => ([
          s.milestone?.course?.code ?? '',
          s.group?.group_code ?? '',
          s.group?.project_name ?? '',
          s.student?.name ?? '',
          s.student?.student_id ?? '',
          s.milestone?.name ?? '',
          s.status ?? '',
          String(s.current_version ?? ''),
          s.updated_at ? new Date(s.updated_at).toLocaleString() : '',
        ]));

        if (selectedFormat === 'Excel (.xlsx)') {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet([subHeaders, ...subRows]);
          autoFitSheet(ws, [subHeaders, ...subRows]);
          XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
          downloadXlsx(wb, `submissions-report-${courseSlug}-${dateStr}.xlsx`);
        } else {
          triggerDownload(
            toCsv([subHeaders, ...subRows]),
            `submissions-report-${courseSlug}-${dateStr}.csv`
          );
        }
      }

      // ── Activity ──────────────────────────────────────────────────────────
      if (type === 'activity') {
        // Pull submissions + weekly_reports for submission-based activity rows
        const [{ data: subs }, { data: weekly }] = await Promise.all([
          supabase
            .from('submissions')
            .select(`
              status, updated_at,
              milestone:milestones!milestone_id(name, course:courses!course_id(id, code)),
              student:profiles!student_id(name),
              group:groups!group_id(group_code)
            `)
            .order('updated_at', { ascending: false }),
          supabase
            .from('weekly_reports')
            .select(`
              week_number, student_mark, supervisor_mark, updated_at,
              group:groups!group_id(group_code, course:courses!course_id(id, code))
            `)
            .order('updated_at', { ascending: false }),
        ]);

        const actHeaders = ['Date & Time', 'Course', 'Group', 'Actor', 'Action', 'Details'];
        const actRows: string[][] = [];

        // 1. Submission events
        for (const s of subs ?? []) {
          const courseMatch = !courseId || (s.milestone as any)?.course?.id === courseId;
          const t = s.updated_at ? new Date(s.updated_at) : null;
          const dateMatch = (!from || (t && t >= from)) && (!to || (t && t <= to));
          if (!courseMatch || !dateMatch) continue;

          const action =
            s.status === 'submitted'          ? 'Submitted'
            : s.status === 'under-review'     ? 'Under Review'
            : s.status === 'approved'         ? 'Approved'
            : s.status === 'changes-requested'? 'Changes Requested'
            : s.status ?? 'Updated';

          actRows.push([
            t ? t.toLocaleString() : '',
            (s.milestone as any)?.course?.code ?? '',
            (s.group as any)?.group_code ?? '',
            (s.student as any)?.name ?? '',
            action,
            (s.milestone as any)?.name ?? '',
          ]);
        }

        // 2. Weekly report events
        for (const w of weekly ?? []) {
          const courseMatch = !courseId || (w.group as any)?.course?.id === courseId;
          const t = w.updated_at ? new Date(w.updated_at) : null;
          const dateMatch = (!from || (t && t >= from)) && (!to || (t && t <= to));
          if (!courseMatch || !dateMatch) continue;

          actRows.push([
            t ? t.toLocaleString() : '',
            (w.group as any)?.course?.code ?? '',
            (w.group as any)?.group_code ?? '',
            '',
            'Weekly Report',
            `Week ${w.week_number} — Student: ${w.student_mark ?? '-'}, Supervisor: ${w.supervisor_mark ?? '-'}`,
          ]);
        }

        // 3. All other audit log entries already loaded on this page
        //    (grading events, evaluations, exports, etc. — everything outside submissions)
        for (const entry of auditLog) {
          const t = new Date(entry.timestamp);
          const dateMatch = (!from || t >= from) && (!to || t <= to);
          if (!dateMatch) continue;

          actRows.push([
            t.toLocaleString(),
            '',   // audit_log has no course field
            '',   // audit_log has no group field
            entry.actor,
            entry.action,
            `${entry.entity}${entry.context ? ' — ' + entry.context : ''}`,
          ]);
        }

        // Sort all rows by date descending
        actRows.sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

        if (selectedFormat === 'Excel (.xlsx)') {
          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.aoa_to_sheet([actHeaders, ...actRows]);
          autoFitSheet(ws, [actHeaders, ...actRows]);
          XLSX.utils.book_append_sheet(wb, ws, 'Activity Log');
          downloadXlsx(wb, `activity-log-${courseSlug}-${dateStr}.xlsx`);
        } else {
          triggerDownload(
            toCsv([actHeaders, ...actRows]),
            `activity-log-${courseSlug}-${dateStr}.csv`
          );
        }
      }

      // Record the export in Recent Exports
      const courseName = courseId
        ? (courses.find(c => c.id === courseId)?.code ?? 'Unknown Course')
        : 'All Courses';
      const newEntry: RecentExport = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        type: type!,
        courseName,
        format: selectedFormat,
      };
      saveRecentExport(newEntry);
      setRecentExports(loadRecentExports());

      toast.success('Export downloaded successfully.', { id: 'export' });
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Export failed. Please try again.', { id: 'export' });
    }
  };

  const openExportModal = (type: 'grades' | 'submissions' | 'activity') => {
    setExportType(type);
    setShowExportModal(true);
  };

  return (
    <Layout user={user} pageTitle="Exports & Audit">
      <Tabs defaultValue="exports" className="w-full">
        <TabsList className="grid w-fit grid-cols-2 mb-6 h-11 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)] p-1">
          <TabsTrigger
            value="exports"
            className="rounded-md font-semibold data-[state=active]:bg-[var(--color-surface-white)] data-[state=active]:border data-[state=active]:border-[var(--color-border)] data-[state=active]:shadow-sm"
          >
            Export Center
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-md font-semibold data-[state=active]:bg-[var(--color-surface-white)] data-[state=active]:border data-[state=active]:border-[var(--color-border)] data-[state=active]:shadow-sm"
          >
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ── Export Center ──────────────────────────────────────────── */}
        <TabsContent value="exports">
          {/* Export type cards */}
          <DashboardCard title="Export Data" icon={Download} className="mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Grades */}
              <div className="rounded-xl border border-[var(--color-border)] p-5">
                <div className="w-12 h-12 rounded-lg bg-white border border-green-500 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-[var(--color-text-900)] mb-2">Grades Report</h3>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Export student grades, rubric scores, and evaluation summaries
                </p>
                <Button variant="outline" className="w-full justify-start" onClick={() => openExportModal('grades')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Grades
                </Button>
              </div>

              {/* Submissions */}
              <div className="rounded-xl border border-[var(--color-border)] p-5">
                <div className="w-12 h-12 rounded-lg bg-white border border-blue-500 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-[var(--color-text-900)] mb-2">Submissions Report</h3>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Export submission history, versions, and status information
                </p>
                <Button variant="outline" className="w-full justify-start" onClick={() => openExportModal('submissions')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Submissions
                </Button>
              </div>

              {/* Activity */}
              <div className="rounded-xl border border-[var(--color-border)] p-5">
                <div className="w-12 h-12 rounded-lg bg-white border border-purple-500 flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-[var(--color-text-900)] mb-2">Activity Log</h3>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Export system activity and user actions for auditing
                </p>
                <Button variant="outline" className="w-full justify-start" onClick={() => openExportModal('activity')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Activity
                </Button>
              </div>
            </div>
          </DashboardCard>

          {/* Recent Exports */}
          <DashboardCard title="Recent Exports" icon={ClipboardList}>
            {recentExports.length === 0 ? (
              <div className="py-10 text-center text-[var(--color-text-600)]">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No recent exports</p>
                <p className="text-sm mt-1">Your exported files will appear here</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                {/* Desktop header — hidden on mobile */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-xs font-medium uppercase tracking-wide text-[var(--color-text-600)]">
                  <div className="col-span-4">Date & Time</div>
                  <div className="col-span-3">Export Type</div>
                  <div className="col-span-3">Course</div>
                  <div className="col-span-2">Format</div>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {recentExports.map((entry) => {
                    const typeLabel =
                      entry.type === 'grades' ? 'Grades Report'
                      : entry.type === 'submissions' ? 'Submissions Report'
                      : 'Activity Log';
                    const typeColor =
                      entry.type === 'grades' ? 'bg-green-50 text-green-700 border-green-200'
                      : entry.type === 'submissions' ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-purple-50 text-purple-700 border-purple-200';
                    return (
                      <div key={entry.id}>
                        {/* Mobile card */}
                        <div className="sm:hidden px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2.5 py-0.5 text-xs rounded-full border ${typeColor}`}>
                              {typeLabel}
                            </span>
                            <span className="text-xs text-[var(--color-text-600)]">{entry.format}</span>
                          </div>
                          <p className="text-sm text-[var(--color-text-900)]">{entry.courseName}</p>
                          <p className="text-xs text-[var(--color-text-600)]">{new Date(entry.date).toLocaleString()}</p>
                        </div>
                        {/* Desktop row */}
                        <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[var(--color-surface-alt)] transition-colors items-center">
                          <div className="col-span-4 text-sm text-[var(--color-text-900)]">
                            {new Date(entry.date).toLocaleString()}
                          </div>
                          <div className="col-span-3">
                            <span className={`px-2.5 py-1 text-xs rounded-full border ${typeColor}`}>
                              {typeLabel}
                            </span>
                          </div>
                          <div className="col-span-3 text-sm text-[var(--color-text-900)]">
                            {entry.courseName}
                          </div>
                          <div className="col-span-2 text-sm text-[var(--color-text-600)]">
                            {entry.format}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </DashboardCard>
        </TabsContent>

        {/* ── Audit Log ──────────────────────────────────────────────── */}
        <TabsContent value="audit">
          {/* Metric row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <MetricCard label="Total Entries" value={auditLog.length} icon={ClipboardList} color="primary" />
            <MetricCard label="Today's Activity" value={todayEntries} icon={Calendar} color="success" />
            <MetricCard label="Unique Actors" value={uniqueActors} icon={Users} color="info" />
          </div>

          {/* Filters + Table */}
          <DashboardCard
            title="Activity Log"
            icon={Activity}
            actions={
              <div className="flex flex-wrap gap-2 items-center justify-end">
                <select
                  className="px-2 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]"
                  value={filterAction}
                  onChange={e => setFilterAction(e.target.value)}
                >
                  <option>All Actions</option>
                  <option>Submitted</option>
                  <option>Reviewed</option>
                  <option>Published</option>
                  <option>Updated</option>
                </select>
                <div className="hidden sm:block"><DatePicker value="" onChange={() => {}} placeholder="From date" /></div>
                <div className="hidden sm:block"><DatePicker value="" onChange={() => {}} placeholder="To date" /></div>
              </div>
            }
          >
            {filteredLog.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-600)]">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No activity recorded</p>
                <p className="text-sm mt-1">System events and user actions will appear here</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] overflow-x-auto">
                <div className="min-w-[620px]">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-xs font-medium uppercase tracking-wide text-[var(--color-text-600)]">
                  <div className="col-span-3">Date & Time</div>
                  <div className="col-span-2">Actor</div>
                  <div className="col-span-2">Action</div>
                  <div className="col-span-3">Entity</div>
                  <div className="col-span-2">Context</div>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {filteredLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[var(--color-surface-alt)] transition-colors"
                    >
                      <div className="col-span-3 flex items-center">
                        <p className="text-sm text-[var(--color-text-900)]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <p className="text-sm text-[var(--color-text-900)]">{entry.actor.split('(')[0].trim()}</p>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                          {entry.action}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center">
                        <p className="text-sm text-[var(--color-text-900)]">{entry.entity}</p>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <p className="text-sm text-[var(--color-text-600)] truncate">{entry.context}</p>
                      </div>
                    </div>
                  ))}
                </div>
                </div>{/* end min-w-[620px] */}
              </div>
            )}
          </DashboardCard>
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      {showExportModal && exportType && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowExportModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-[var(--color-text-900)]">
                  Export {exportType.charAt(0).toUpperCase() + exportType.slice(1)} Report
                </h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From Date</Label>
                    <div className="mt-2">
                      <DatePicker
                        value={dateRange.from}
                        onChange={(date) => setDateRange({ ...dateRange, from: date })}
                        placeholder="Select start date"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <div className="mt-2">
                      <DatePicker
                        value={dateRange.to}
                        onChange={(date) => setDateRange({ ...dateRange, to: date })}
                        placeholder="Select end date"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Course</Label>
                  {isCoordinator ? (
                    <div className="w-full mt-2 px-4 py-2 rounded-lg border border-(--color-border) bg-(--color-surface-alt) flex items-center gap-2 text-sm text-(--color-text-900)">
                      <Lock className="w-4 h-4 text-(--color-text-600) shrink-0" />
                      <span>{courses[0]?.code ?? '—'} — {courses[0]?.name ?? 'Your course'}</span>
                    </div>
                  ) : (
                    <select
                      className="w-full mt-2 px-4 py-2 rounded-lg border border-(--color-border) bg-(--color-surface-white)"
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                    >
                      <option value="">All Courses</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <Label>Format</Label>
                  <select
                    className="w-full mt-2 px-4 py-2 rounded-lg border border-(--color-border) bg-(--color-surface-white)"
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                  >
                    <option>Excel (.xlsx)</option>
                    <option>CSV (.csv)</option>
                    <option>PDF (.pdf)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowExportModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
