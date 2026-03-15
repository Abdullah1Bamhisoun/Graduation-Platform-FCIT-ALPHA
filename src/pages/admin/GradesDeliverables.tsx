import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import {
  Save,
  CheckCircle,
  Clock,
  FileText,
  Download,
  ChevronRight,
  Award,
  Users,
  BookOpen,
  BarChart,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getAllGroups } from '../../services/groups';
import { getGroupGrade, updateDeliverableGrade } from '../../services/grades';
import { getGradingSchemas } from '../../services/grading-schemas';
import { getAuditLog } from '../../services/audit';
import { supabase } from '../../lib/supabase';
import {
  getRubricCriteria,
  getCoordinatorDeliverableScores,
  saveAllCoordinatorDeliverables,
  type RubricCriterion,
} from '../../services/grading-rubric';
import type { GroupData } from '../../services/groups';
import type { GradingSchema, GroupGrade, AuditLogEntry } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function courseTypeFromCode(code: string): '498' | '499' {
  return code.includes('499') ? '499' : '498';
}

/** Human-readable labels for CPIS-498 deliverable keys (official policy) */
const DELIVERABLE_LABELS_498: Record<string, string> = {
  // New underscore keys (coordinator_deliverables table)
  chapter1:             'Chapter 1 — Project Outlines',
  chapter2:             'Chapter 2 — Literature Review',
  chapter3:             'Chapter 3 — Analysis',
  chapter4:             'Chapter 4 — System Design',
  final_report:         'Final Report',
  revised_final_report: 'Revised Final Report',
  presentation:         'Presentation',
  // Legacy camelCase keys (group_deliverable_grades table)
  finalReport:          'Final Report',
  revisedFinalReport:   'Revised Final Report',
};

/** Human-readable labels for CPIS-499 coordinator deliverable keys */
const DELIVERABLE_LABELS_499: Record<string, string> = {
  demo1:                  'Demo 1',
  demo2:                  'Demo 2',
  poster_day:             'Poster Day',
  chapter_implementation: 'Chapter Implementation',
  chapter_testing:        'Chapter Testing',
};

const SEMESTER = 'DEFAULT';

// ─── Component ───────────────────────────────────────────────────────────────

export function AdminGradesDeliverables() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [groups, setGroups]               = useState<GroupData[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [activeTab, setActiveTab]         = useState('overview');

  // Loaded per selection
  const [schemas, setSchemas]           = useState<GradingSchema[]>([]);
  const [groupGrade, setGroupGrade]     = useState<GroupGrade | null>(null);
  const [committeeAvg, setCommitteeAvg] = useState<number | undefined>(undefined);
  const [peerAvg, setPeerAvg]           = useState<number | undefined>(undefined);
  const [auditHistory, setAuditHistory] = useState<AuditLogEntry[]>([]);

  // Edit state for CPIS-498 deliverables
  const [editingDeliverables, setEditingDeliverables] = useState(false);
  const [deliverableDraft, setDeliverableDraft]       = useState<Record<string, number>>({});

  // Edit state for CPIS-499 coordinator deliverables (criteria-driven)
  const [editingCoord, setEditingCoord]       = useState(false);
  const [coordDraft, setCoordDraft]           = useState<Record<string, number>>({});
  const [coordCriteria, setCoordCriteria]     = useState<RubricCriterion[]>([]);
  const [savingCoord, setSavingCoord]         = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  const isCoordinator = user?.activeRole === 'coordinator';
  const isAdmin       = user?.activeRole === 'admin';
  const canEdit       = isCoordinator || isAdmin;

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    getAllGroups(user?.activeRole).then(setGroups);
    getAuditLog().then(entries => setAuditHistory(entries.slice(0, 5)));
  }, [user?.activeRole]);

  // ── Load data when group is selected ─────────────────────────────────────
  useEffect(() => {
    if (!selectedGroup) return;
    const group = groups.find(g => g.id === selectedGroup);
    if (!group) return;

    const ct = courseTypeFromCode(group.courseCode);

    // Load in parallel
    Promise.all([
      getGradingSchemas(ct, SEMESTER),
      getGroupGrade(selectedGroup, group.courseCode, SEMESTER),
    ]).then(([sc, gg]) => {
      setSchemas(sc);
      setGroupGrade(gg);

      // Init draft for 498 deliverables
      if (ct === '498' && gg) {
        const draft: Record<string, number> = {};
        for (const [key, d] of Object.entries(gg.deliverables)) {
          draft[key] = d.score ?? 0;
        }
        setDeliverableDraft(draft);
      }
    });

    // Load 499 coordinator deliverables from new rubric table
    if (ct === '499') {
      (async () => {
        const dbCode = group.courseCode.replace('CPIS-', '').trim();
        const { data: courseRow } = await supabase
          .from('courses')
          .select('id')
          .ilike('code', `%${dbCode}%`)
          .limit(1)
          .maybeSingle();
        if (!courseRow) return;
        setSelectedCourseId(courseRow.id);

        const crit = await getRubricCriteria('499', 'coordinator_deliverables');
        setCoordCriteria(crit);

        const scores = await getCoordinatorDeliverableScores(selectedGroup, courseRow.id);
        const draft: Record<string, number> = {};
        for (const c of crit) draft[c.criterionKey] = 0;
        for (const s of scores) draft[s.deliverableKey] = s.score;
        setCoordDraft(draft);
      })();
    }

    // Fetch committee average for this group
    fetchCommitteeAvg(selectedGroup, group.courseCode);
    // Fetch peer average for CPIS-498 groups
    if (ct === '498') fetchPeerAvg(selectedGroup, group.courseCode);
  }, [selectedGroup, groups]);

  async function fetchCommitteeAvg(groupId: string, courseCode: string) {
    const dbCode = courseCode.replace('CPIS-', '').trim();
    const { data: courseRow } = await supabase
      .from('courses')
      .select('id')
      .ilike('code', `%${dbCode}%`)
      .limit(1)
      .maybeSingle();
    if (!courseRow) return;

    const { data: evals } = await supabase
      .from('committee_evaluations')
      .select('score')
      .eq('group_id', groupId)
      .eq('course_id', courseRow.id);

    if (evals && evals.length > 0) {
      const avg = evals.reduce((s: number, e: any) => s + Number(e.score), 0) / evals.length;
      setCommitteeAvg(avg);
    } else {
      setCommitteeAvg(undefined);
    }
  }

  async function fetchPeerAvg(groupId: string, courseCode: string) {
    const dbCode = courseCode.replace('CPIS-', '').trim();
    const { data: courseRow } = await supabase
      .from('courses')
      .select('id')
      .ilike('code', `%${dbCode}%`)
      .limit(1)
      .maybeSingle();
    if (!courseRow) return;

    const { data: evals } = await supabase
      .from('peer_evaluations')
      .select('score')
      .eq('group_id', groupId)
      .eq('course_id', courseRow.id);

    if (evals && evals.length > 0) {
      const avg = evals.reduce((s: number, e: any) => s + Number(e.score), 0) / evals.length;
      setPeerAvg(avg);
    } else {
      setPeerAvg(undefined);
    }
  }

  if (!user) return null;

  const currentGroup = groups.find(g => g.id === selectedGroup);
  const ct = currentGroup ? courseTypeFromCode(currentGroup.courseCode) : null;

  // ── Computed grade values ─────────────────────────────────────────────────

  /** Supervisor assessment average across students */
  const supervisorAvg = (() => {
    if (!groupGrade) return undefined;
    const vals = Object.values(groupGrade.supervisorAssessment)
      .map(a => a.score)
      .filter((s): s is number => s !== undefined);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
  })();

  /** Schema weight lookup */
  const schemaWeight = (role: string): number => {
    const s = schemas.find(sc => sc.role === role);
    return s?.weight ?? 0;
  };

  const schemaLabel = (role: string): string => {
    const s = schemas.find(sc => sc.role === role);
    return s?.componentName ?? role;
  };

  /** Grand total from all components */
  const coord499Total = Object.values(coordDraft).reduce((s, v) => s + v, 0);
  const grandTotal = (() => {
    const supW    = supervisorAvg     ?? 0;
    const commW   = committeeAvg      ?? 0;
    const weekW   = groupGrade?.weeklyProgress.score ?? 0;
    const delivW  = ct === '498'
      ? (groupGrade?.deliverablesTotal ?? 0)
      : coord499Total;
    const peerW   = ct === '498' ? (peerAvg ?? 0) : 0;
    return supW + commW + weekW + delivW + peerW;
  })();

  // ── Save CPIS-498 deliverables ────────────────────────────────────────────
  const saveDeliverables498 = async () => {
    if (!currentGroup || !user || !groupGrade) return;
    try {
      for (const [key, score] of Object.entries(deliverableDraft)) {
        const maxScore = groupGrade.deliverables[key]?.maxScore ?? 0;
        await updateDeliverableGrade(
          selectedGroup,
          currentGroup.courseCode,
          key,
          score,
          maxScore,
          'graded',
          user.id,
        );
      }
      // Reload
      const gg = await getGroupGrade(selectedGroup, currentGroup.courseCode, SEMESTER);
      setGroupGrade(gg);
      setEditingDeliverables(false);
      toast.success('Course Deliverables saved successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save deliverables.');
    }
  };

  // ── Save CPIS-499 coordinator scores ─────────────────────────────────────
  const saveCoord499 = async () => {
    if (!currentGroup || !user || !selectedCourseId) return;
    const total    = Object.values(coordDraft).reduce((s, v) => s + v, 0);
    const maxTotal = coordCriteria.reduce((s, c) => s + c.maxRawScore, 0);
    if (total > maxTotal) {
      toast.error(`Total (${total}) exceeds maximum (${maxTotal}).`);
      return;
    }
    setSavingCoord(true);
    try {
      await saveAllCoordinatorDeliverables({
        groupId:    selectedGroup,
        courseId:   selectedCourseId,
        courseType: '499',
        scores:     coordDraft,
        gradedBy:   user.id,
      });
      setEditingCoord(false);
      toast.success('Course Deliverables saved.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save.');
    } finally {
      setSavingCoord(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleExport = (format: 'pdf' | 'csv') => {
    toast.success(`Exporting grades as ${format.toUpperCase()}…`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-50 text-green-600 border border-green-200">Graded</span>;
      case 'submitted':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">Needs Grading</span>;
      default:
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-50 text-gray-600 border border-gray-200">Not Submitted</span>;
    }
  };

  // ── Schema-driven summary cards ───────────────────────────────────────────
  const summaryCards = schemas.map(sc => {
    let value: number | undefined;
    let maxValue = sc.weight;
    let label = sc.componentName;
    let icon = <BookOpen className="w-4 h-4" />;
    let colorClass = 'bg-gray-50 border-gray-200 text-gray-900';

    switch (sc.role) {
      case 'supervisor':
        value = supervisorAvg;
        icon = <BookOpen className="w-4 h-4" />;
        colorClass = 'bg-green-50 border-green-200 text-green-900';
        break;
      case 'auto':
        value = groupGrade?.weeklyProgress.score;
        maxValue = groupGrade?.weeklyProgress.maxScore ?? sc.weight;
        icon = <BarChart className="w-4 h-4" />;
        colorClass = 'bg-indigo-50 border-indigo-200 text-indigo-900';
        break;
      case 'committee':
        value = committeeAvg;
        icon = <Award className="w-4 h-4" />;
        colorClass = 'bg-orange-50 border-orange-200 text-orange-900';
        break;
      case 'coordinator':
        value = ct === '498'
          ? groupGrade?.deliverablesTotal
          : coord499Total;
        icon = <FileText className="w-4 h-4" />;
        colorClass = 'bg-blue-50 border-blue-200 text-blue-900';
        break;
      case 'student':
        value = peerAvg;
        icon = <Users className="w-4 h-4" />;
        colorClass = 'bg-purple-50 border-purple-200 text-purple-900';
        break;
    }

    return { sc, value, maxValue, label, icon, colorClass };
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout user={user} pageTitle="Grading Summary">
      {isLocked && <LockedBanner />}

      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          View and manage all grade components (Total: 100 marks)
        </p>

        {isCoordinator && (
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
            <BookOpen className="w-4 h-4" />
            Showing groups from your assigned course only
          </div>
        )}

        {/* Group Selection */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
          <div className="max-w-md">
            <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">
              Select Group
            </Label>
            <Select value={selectedGroup} onValueChange={v => {
              setSelectedGroup(v);
              setActiveTab('overview');
              setEditingDeliverables(false);
              setEditingCoord(false);
              setGroupGrade(null);
              setCommitteeAvg(undefined);
              setPeerAvg(undefined);
              setCoordCriteria([]);
              setCoordDraft({});
              setSelectedCourseId('');
            }}>
              <SelectTrigger id="group-select">
                <SelectValue placeholder="Choose a group…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.groupCode} — {group.projectName} ({group.courseCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {selectedGroup && currentGroup ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main Content */}
          <div className="flex-1 lg:max-w-[800px]">
            {/* Header */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
              <div>
                <h1 className="text-[var(--color-text-900)] mb-1">
                  {currentGroup.groupCode} — {currentGroup.courseCode}
                </h1>
                <p className="text-[var(--color-text-600)]">{currentGroup.projectName}</p>
                {currentGroup.members.length > 0 && (
                  <p className="text-[var(--color-text-600)] text-sm mt-1">
                    Students: {currentGroup.members.map(m => m.name).join(', ')}
                  </p>
                )}
              </div>

              {/* Schema-driven summary grid */}
              {schemas.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-[var(--color-border)]">
                  {summaryCards.map(({ sc, value, maxValue, label, icon, colorClass }) => (
                    <div key={sc.id} className={`rounded-lg border p-3 ${colorClass}`}>
                      <div className="flex items-center gap-2 mb-1 text-sm">
                        {icon}
                        <span className="truncate">{label}</span>
                      </div>
                      <p className="text-xl font-semibold tabular-nums">
                        {value !== undefined ? value.toFixed(1) : '—'}/{maxValue}
                      </p>
                      <p className="text-xs opacity-75 capitalize">{sc.role}</p>
                    </div>
                  ))}

                  {/* Grand Total */}
                  <div className="rounded-lg border-2 p-3 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-300 col-span-1">
                    <div className="flex items-center gap-2 mb-1 text-sm text-blue-900">
                      <CheckCircle className="w-4 h-4" />
                      <span>Grand Total</span>
                    </div>
                    <p className="text-xl font-semibold text-blue-900 tabular-nums">{grandTotal.toFixed(1)}/100</p>
                    <p className="text-xs text-blue-700">{grandTotal.toFixed(1)}%</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="deliverables">
                  Course Deliverables ({schemaWeight('coordinator')})
                </TabsTrigger>
                <TabsTrigger value="supervisor">
                  Supervisor ({schemaWeight('supervisor')})
                </TabsTrigger>
                <TabsTrigger value="history">History & Audit</TabsTrigger>
              </TabsList>

              {/* ── Tab: Overview ─────────────────────────────────── */}
              <TabsContent value="overview">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 space-y-4">
                  <h3 className="text-[var(--color-text-900)]">Complete Grade Breakdown — {currentGroup.courseCode}</h3>

                  {schemas.map(sc => {
                    let displayValue: string = '—';
                    let maxVal = sc.weight;

                    if (sc.role === 'supervisor') {
                      displayValue = supervisorAvg !== undefined ? supervisorAvg.toFixed(1) : '—';
                    } else if (sc.role === 'auto') {
                      const v = groupGrade?.weeklyProgress.score;
                      maxVal = groupGrade?.weeklyProgress.maxScore ?? sc.weight;
                      displayValue = v !== undefined ? String(v) : '—';
                    } else if (sc.role === 'committee') {
                      displayValue = committeeAvg !== undefined ? committeeAvg.toFixed(1) : '—';
                    } else if (sc.role === 'coordinator') {
                      const v = ct === '498'
                        ? groupGrade?.deliverablesTotal
                        : coord499Total;
                      displayValue = ct === '498'
                        ? (v !== undefined ? String(v) : '—')
                        : (Object.keys(coordDraft).length > 0 ? coord499Total.toFixed(1) : '—');
                    } else if (sc.role === 'student') {
                      displayValue = peerAvg !== undefined ? peerAvg.toFixed(1) : '—';
                    }

                    return (
                      <div key={sc.id} className="p-4 border border-[var(--color-border)] rounded-lg flex items-center justify-between">
                        <div>
                          <h4 className="text-[var(--color-text-900)] font-medium">{sc.componentName}</h4>
                          <p className="text-xs text-[var(--color-text-600)] capitalize">Graded by: {sc.role}</p>
                        </div>
                        <span className="text-[var(--color-text-900)] font-semibold tabular-nums">
                          {displayValue} / {maxVal}
                        </span>
                      </div>
                    );
                  })}

                  {/* Pass/Fail for CPIS-498 */}
                  {ct === '498' && (
                    <div className={`p-4 rounded-lg border-2 text-center ${grandTotal >= 60 ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'}`}>
                      <p className={`text-lg font-bold ${grandTotal >= 60 ? 'text-green-700' : 'text-red-700'}`}>
                        {grandTotal > 0 ? (grandTotal >= 60 ? '✓ PASS' : '✗ FAIL') : 'Grades pending'}
                      </p>
                      <p className="text-sm text-[var(--color-text-600)] mt-1">
                        {grandTotal.toFixed(1)} / 100 — Passing threshold: 60
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Course Deliverables ───────────────────────── */}
              <TabsContent value="deliverables">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div>
                      <h3 className="text-[var(--color-text-900)]">
                        Course Deliverables — {schemaLabel('coordinator')}
                      </h3>
                      <p className="text-[var(--color-text-600)] text-sm mt-1">
                        Total: {schemaWeight('coordinator')} marks · Graded by Course Coordinator
                      </p>
                    </div>

                    {canEdit && !isLocked && (
                      ct === '498' ? (
                        !editingDeliverables ? (
                          <Button
                            onClick={() => setEditingDeliverables(true)}
                            className="bg-[#10B981] text-black hover:bg-[#0ea572]"
                          >
                            Edit Deliverables
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditingDeliverables(false)}>Cancel</Button>
                            <Button onClick={saveDeliverables498} className="bg-[#10B981] text-black hover:bg-[#0ea572]">
                              <Save className="w-4 h-4 mr-2" />Save
                            </Button>
                          </div>
                        )
                      ) : (
                        !editingCoord ? (
                          <Button
                            onClick={() => setEditingCoord(true)}
                            className="bg-[#10B981] text-black hover:bg-[#0ea572]"
                          >
                            Edit Deliverables
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditingCoord(false)}>Cancel</Button>
                            <Button
                              onClick={saveCoord499}
                              disabled={savingCoord}
                              className="bg-[#10B981] text-black hover:bg-[#0ea572]"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {savingCoord ? 'Saving…' : 'Save'}
                            </Button>
                          </div>
                        )
                      )
                    )}
                  </div>

                  {/* CPIS-498: Chapter-based deliverables */}
                  {ct === '498' && groupGrade && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-[var(--color-surface-alt)]">
                          <tr>
                            <th className="p-4 text-left text-[var(--color-text-900)]">Deliverable</th>
                            <th className="p-4 text-center text-[var(--color-text-900)]">Status</th>
                            <th className="p-4 text-center text-[var(--color-text-900)]">Max</th>
                            <th className="p-4 text-center text-[var(--color-text-900)]">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)]">
                          {Object.entries(groupGrade.deliverables).map(([key, d]) => (
                            <tr key={key} className="hover:bg-[var(--color-surface-alt)]">
                              <td className="p-4 text-[var(--color-text-900)]">
                                {DELIVERABLE_LABELS_498[key] ?? key}
                              </td>
                              <td className="p-4 text-center">{getStatusBadge(d.status)}</td>
                              <td className="p-4 text-center text-[var(--color-text-600)]">{d.maxScore}</td>
                              <td className="p-4 text-center">
                                {editingDeliverables ? (
                                  <Input
                                    type="number"
                                    min={0}
                                    max={d.maxScore}
                                    step={0.5}
                                    value={deliverableDraft[key] ?? 0}
                                    onChange={e => setDeliverableDraft(prev => ({
                                      ...prev,
                                      [key]: Math.min(d.maxScore, Math.max(0, parseFloat(e.target.value) || 0)),
                                    }))}
                                    className="w-20 mx-auto text-center"
                                  />
                                ) : (
                                  <span className="text-[var(--color-text-900)] tabular-nums">
                                    {d.score !== undefined ? d.score : '—'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[var(--color-primary-100)]">
                            <td className="p-4 font-semibold" colSpan={2}>Total</td>
                            <td className="p-4 text-center font-semibold">{schemaWeight('coordinator')}</td>
                            <td className="p-4 text-center font-semibold tabular-nums">
                              {editingDeliverables
                                ? Object.values(deliverableDraft).reduce((a, b) => a + b, 0).toFixed(1)
                                : (groupGrade.deliverablesTotal ?? '—')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* CPIS-499: Criteria-driven coordinator deliverables */}
                  {ct === '499' && (
                    <>
                      {coordCriteria.length > 0 && (
                        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 flex items-start gap-2 text-sm text-indigo-800">
                          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>
                            {coordCriteria.length} deliverables · max{' '}
                            <strong>{coordCriteria.reduce((s, c) => s + c.maxRawScore, 0)} marks</strong>.
                            Only the Course Coordinator may enter these scores.
                          </span>
                        </div>
                      )}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-[var(--color-surface-alt)]">
                            <tr>
                              <th className="p-4 text-left text-[var(--color-text-900)]">Deliverable</th>
                              <th className="p-4 text-center text-[var(--color-text-900)]">Max</th>
                              <th className="p-4 text-center text-[var(--color-text-900)]">Score</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--color-border)]">
                            {coordCriteria.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="p-6 text-center text-[var(--color-text-600)] text-sm">
                                  Loading deliverables…
                                </td>
                              </tr>
                            ) : (
                              coordCriteria.map(c => (
                                <tr key={c.criterionKey} className="hover:bg-[var(--color-surface-alt)]">
                                  <td className="p-4 text-[var(--color-text-900)]">
                                    {DELIVERABLE_LABELS_499[c.criterionKey] ?? c.criterionName}
                                  </td>
                                  <td className="p-4 text-center text-[var(--color-text-600)]">{c.maxRawScore}</td>
                                  <td className="p-4 text-center">
                                    {editingCoord ? (
                                      <Input
                                        type="number"
                                        min={0}
                                        max={c.maxRawScore}
                                        step={0.5}
                                        value={coordDraft[c.criterionKey] ?? 0}
                                        onChange={e => setCoordDraft(prev => ({
                                          ...prev,
                                          [c.criterionKey]: Math.min(
                                            c.maxRawScore,
                                            Math.max(0, parseFloat(e.target.value) || 0),
                                          ),
                                        }))}
                                        className="w-20 mx-auto text-center"
                                      />
                                    ) : (
                                      <span className="tabular-nums text-[var(--color-text-900)]">
                                        {coordDraft[c.criterionKey] !== undefined
                                          ? coordDraft[c.criterionKey]
                                          : '—'}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                            <tr className="bg-[var(--color-primary-100)]">
                              <td className="p-4 font-semibold">Total</td>
                              <td className="p-4 text-center font-semibold">
                                {coordCriteria.reduce((s, c) => s + c.maxRawScore, 0)}
                              </td>
                              <td className="p-4 text-center font-semibold tabular-nums">
                                {coord499Total.toFixed(1)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: Supervisor Details ────────────────────────── */}
              <TabsContent value="supervisor">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                  <h3 className="text-[var(--color-text-900)] mb-2">
                    {schemaLabel('supervisor')} — Read-Only
                  </h3>
                  <p className="text-[var(--color-text-600)] text-sm mb-4">
                    Entered by the supervisor. Max: {schemaWeight('supervisor')} marks per student.
                  </p>

                  {groupGrade && Object.keys(groupGrade.supervisorAssessment).length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-surface-alt)]">
                        <tr>
                          <th className="p-4 text-left text-[var(--color-text-900)]">Student</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Score</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Max</th>
                          <th className="p-4 text-left text-[var(--color-text-900)]">Comment</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {groupGrade.students.map(student => {
                          const a = groupGrade.supervisorAssessment[student.id];
                          return (
                            <tr key={student.id} className="hover:bg-[var(--color-surface-alt)]">
                              <td className="p-4 text-[var(--color-text-900)]">{student.name}</td>
                              <td className="p-4 text-center font-semibold tabular-nums text-green-700">
                                {a?.score !== undefined ? a.score : '—'}
                              </td>
                              <td className="p-4 text-center text-[var(--color-text-600)]">
                                {a?.maxScore ?? schemaWeight('supervisor')}
                              </td>
                              <td className="p-4 text-[var(--color-text-600)]">
                                {a?.comment ?? <span className="text-xs italic">No comment</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-[var(--color-text-600)] text-sm">No supervisor assessments entered yet.</p>
                  )}
                </div>
              </TabsContent>

              {/* ── Tab: History & Audit ───────────────────────────── */}
              <TabsContent value="history">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                  <h3 className="text-[var(--color-text-900)] mb-4">Grading History & Audit Trail</h3>
                  <div className="space-y-4">
                    {auditHistory.map(entry => (
                      <div key={entry.id} className="flex gap-4 pb-4 border-b border-[var(--color-border)] last:border-0">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center">
                          <Clock className="w-5 h-5 text-[var(--color-primary-600)]" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[var(--color-text-900)]">{entry.action}</span>
                            <span className="text-[var(--color-text-600)]">·</span>
                            <span className="text-[var(--color-text-600)]">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-[var(--color-text-600)] mb-1">
                            {entry.entity}{entry.context ? ` — ${entry.context}` : ''}
                          </p>
                          <p className="text-[var(--color-text-600)]">by {entry.actor}</p>
                        </div>
                        <button className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] flex items-center gap-1">
                          View <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    {auditHistory.length === 0 && (
                      <p className="text-[var(--color-text-600)] text-sm">No audit records found.</p>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Sidebar */}
          <div className="w-full lg:w-[300px] flex-shrink-0">
            <div className="sticky top-6 space-y-6">
              {/* Grade Summary Card */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[var(--color-text-900)]">Grade Summary</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('pdf')}>
                        <FileText className="w-4 h-4 mr-2" />Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        <FileText className="w-4 h-4 mr-2" />Export as CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Grand Total */}
                <div className="text-center mb-6 p-5 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <p className="text-[var(--color-text-600)] mb-1 text-sm">Grand Total</p>
                  <p className={`text-5xl font-bold tabular-nums mb-1 ${grandTotal >= 60 ? 'text-green-700' : grandTotal > 0 ? 'text-red-600' : 'text-[var(--color-text-900)]'}`}>
                    {grandTotal.toFixed(1)}
                  </p>
                  <p className="text-[var(--color-text-600)] text-sm">out of 100</p>
                  {ct === '498' && grandTotal > 0 && (
                    <p className={`text-sm font-semibold mt-2 ${grandTotal >= 60 ? 'text-green-700' : 'text-red-600'}`}>
                      {grandTotal >= 60 ? '✓ PASS' : '✗ FAIL'}
                    </p>
                  )}
                </div>

                {/* Per-component progress bars */}
                <div className="space-y-3">
                  {summaryCards.map(({ sc, value, maxValue, label }) => {
                    const pct = maxValue > 0 && value !== undefined ? Math.min((value / maxValue) * 100, 100) : 0;
                    return (
                      <div key={sc.id}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[var(--color-text-900)] text-sm truncate">{label}</span>
                          <span className="text-[var(--color-text-600)] text-sm tabular-nums ml-2 flex-shrink-0">
                            {value !== undefined ? value.toFixed(1) : '—'} / {maxValue}
                          </span>
                        </div>
                        <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h4 className="text-[var(--color-text-900)] mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate(isCoordinator ? '/coordinator/committee-scores' : '/admin/committee')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] transition-colors text-sm"
                  >
                    View Committee Evaluation
                  </button>
                  <button
                    onClick={() => navigate(isCoordinator ? '/coordinator/weekly-reports' : '/admin/weekly-reports')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] transition-colors text-sm"
                  >
                    View Weekly Reports
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
          <p className="text-[var(--color-text-600)]">
            Select a group to view the complete grading summary
          </p>
        </div>
      )}
    </Layout>
  );
}
