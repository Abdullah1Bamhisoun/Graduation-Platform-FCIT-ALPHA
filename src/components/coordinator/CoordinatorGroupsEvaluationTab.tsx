import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
  Send,
  Save,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Download,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCoordinatorGroupsWithGrades,
  getCoordinatorEvaluation,
  submitCoordinatorEvaluation,
} from '../../services/groups';
import {
  getCoordinatorRubricCriteria,
  getCoordinatorEvalComponent,
  type RubricCriterion,
  type GradingComponent,
} from '../../services/grading-rubric';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/AuthContext';
import type { CoordinatorGroupWithGrades } from '../../services/groups';

interface CoordinatorGroupsEvaluationTabProps {
  courseType: '498' | '499';
  refreshKey?: number;
  onEvaluationSaved?: () => void;
}

interface ExpandedGroups {
  [groupId: string]: boolean;
}

interface EvaluationScores {
  [criterionKey: string]: number;
}

// ─── Criterion Row (same Likert-table style as supervisor/committee eval) ─────

interface CriterionRowProps {
  criterion: RubricCriterion;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function CriterionRow({ criterion, value, onChange, disabled }: CriterionRowProps) {
  const descKey = `description${value}` as keyof RubricCriterion;
  const desc = criterion[descKey];
  const description = typeof desc === 'string' ? desc : undefined;

  const scores = Array.from({ length: criterion.maxRawScore }, (_, i) => i + 1);

  return (
    <tr className="border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors">
      <td className="py-4 px-4">
        <div>
          <div className="font-medium text-[var(--color-text-900)] text-sm">{criterion.criterionName}</div>
          {value > 0 && description && (
            <div className="text-xs text-[var(--color-text-600)] mt-0.5 italic">{description}</div>
          )}
        </div>
      </td>
      {scores.map(score => (
        <td key={score} className="text-center py-4 px-2">
          <label className="flex justify-center cursor-pointer">
            <input
              type="radio"
              name={`coord-criterion-${criterion.criterionKey}`}
              checked={value === score}
              onChange={() => onChange(score)}
              disabled={disabled}
              className="w-6 h-6 cursor-pointer appearance-none rounded-full border-2 border-gray-300 checked:border-blue-600 checked:border-[6px] checked:bg-white hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
            />
          </label>
        </td>
      ))}
      <td className="text-center py-4 px-4 font-semibold tabular-nums text-[var(--color-text-900)] w-16">
        {value > 0 ? value : '—'}/{criterion.maxRawScore}
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CoordinatorGroupsEvaluationTab({ courseType, refreshKey }: CoordinatorGroupsEvaluationTabProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CoordinatorGroupWithGrades[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedGroups>({});

  const [evalComponent, setEvalComponent] = useState<GradingComponent | null>(null);

  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');

  // Evaluation modal state
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupNumber, setSelectedGroupNumber] = useState<number | null>(null);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [evaluationScores, setEvaluationScores] = useState<EvaluationScores>({});
  const [evalComment, setEvalComment] = useState('');
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadGroups();
    getCoordinatorEvalComponent(courseType).then(setEvalComponent);
  }, [courseType, refreshKey]);

  async function loadGroups() {
    setIsLoading(true);
    try {
      const groupsData = await getCoordinatorGroupsWithGrades(courseType, user?.activeRole ?? 'coordinator');
      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading groups:', error);
      toast.error('Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  }

  async function openEvaluationModal(groupId: string, groupNumber: number | null) {
    setSelectedGroupId(groupId);
    setSelectedGroupNumber(groupNumber);
    setEvalComment('');

    try {
      const [criteriaData, existingEvalData] = await Promise.all([
        getCoordinatorRubricCriteria(courseType),
        getCoordinatorEvaluation(groupId, courseType, user?.activeRole ?? 'coordinator'),
      ]);

      setCriteria(criteriaData);

      const scores: EvaluationScores = {};
      for (const c of criteriaData) {
        scores[c.criterionKey] = 0;
      }

      if (existingEvalData.evaluations && existingEvalData.evaluations.length > 0) {
        for (const item of existingEvalData.evaluations) {
          scores[item.criterionKey] = item.rawScore || 0;
        }
      }

      setEvaluationScores(scores);
      setExistingStatus(existingEvalData.submissionStatus ?? null);

      // Load existing comment from coordinator_assessments
      const { data: assessRow } = await supabase
        .from('coordinator_assessments')
        .select('comment')
        .eq('group_id', groupId)
        .eq('course_type', courseType)
        .maybeSingle();
      setEvalComment(assessRow?.comment ?? '');

      setEvaluationModalOpen(true);
    } catch (error) {
      console.error('Error loading evaluation:', error);
      toast.error('Failed to load evaluation criteria');
    }
  }

  async function handleSubmitEvaluation(shouldSubmit: boolean) {
    if (!selectedGroupId || !user) return;

    const unscored = criteria.filter((c) => evaluationScores[c.criterionKey] === 0);
    if (unscored.length > 0) {
      toast.error(`Please score all criteria. Missing: ${unscored.map((c) => c.criterionName).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const evaluations = criteria.map((c) => ({
        criterionId: c.id,
        criterionKey: c.criterionKey,
        rawScore: evaluationScores[c.criterionKey],
      }));

      await submitCoordinatorEvaluation(selectedGroupId, {
        courseType,
        evaluations,
        submissionStatus: shouldSubmit ? 'submitted' : 'draft',
      }, user?.activeRole ?? 'coordinator');

      // Save comment to coordinator_assessments
      if (evalComment.trim()) {
        await supabase
          .from('coordinator_assessments')
          .update({ comment: evalComment.trim() })
          .eq('group_id', selectedGroupId)
          .eq('course_type', courseType);
      }

      toast.success(shouldSubmit ? 'Evaluation submitted!' : 'Evaluation saved as draft.');
      setEvaluationModalOpen(false);
      await loadGroups();
    } catch (error: any) {
      console.error('Error submitting evaluation:', error);
      toast.error(error?.message || 'Failed to submit evaluation');
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const calculateNormalizedScore = (): number => {
    const rawTotal = Object.values(evaluationScores).reduce((a, b) => a + b, 0);
    const maxRaw = criteria.reduce((sum, c) => sum + c.maxRawScore, 0);
    if (maxRaw === 0) return 0;
    const componentWeight = evalComponent?.totalMarks ?? 20;
    return Math.round((rawTotal / maxRaw) * componentWeight * 100) / 100;
  };

  const rawTotal = criteria.reduce(
    (sum, c) => sum + (evaluationScores[c.criterionKey] || 0), 0
  );
  const maxRaw = criteria.reduce((sum, c) => sum + c.maxRawScore, 0);
  const allScored = criteria.length > 0 && criteria.every(c => (evaluationScores[c.criterionKey] || 0) > 0);

  const downloadGradesCSV = () => {
    if (filteredGroups.length === 0) { toast.error('No groups to export'); return; }
    const componentNames = filteredGroups[0]?.gradeComponents.map(c => c.componentName) ?? [];
    const headers = [
      'Group Number', 'Group Name', 'Group Code', 'Course', 'Supervisor', 'Students',
      ...componentNames, 'Total Score', 'Coordinator Evaluation Status',
      'Coordinator Score', 'Coordinator Max Score',
    ];
    const rows = filteredGroups.map(group => {
      const studentNames = group.students.map(s => s.name).join('; ');
      const componentScores = group.gradeComponents.map(c =>
        c.score !== null ? c.score.toFixed(1) : ''
      );
      return [
        group.number ?? '', group.name, group.groupCode ?? '', group.courseCode,
        group.supervisorName ?? '', studentNames, ...componentScores,
        group.totalScore !== null ? group.totalScore : '',
        group.coordinatorEvaluation?.submissionStatus ?? 'not started',
        group.coordinatorEvaluation?.normalizedScore?.toFixed(1) ?? '',
        group.coordinatorEvaluation?.maxScore ?? '',
      ];
    });
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `course-grades-CPIS-${courseType}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  const uniqueSupervisors = Array.from(
    new Map(
      groups
        .filter(g => g.supervisorId && g.supervisorName)
        .map(g => [g.supervisorId!, { id: g.supervisorId!, name: g.supervisorName! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const filteredGroups = selectedSupervisor === 'all'
    ? groups
    : groups.filter(g => g.supervisorId === selectedSupervisor);

  const isReadOnly = existingStatus === 'submitted' || existingStatus === 'locked';

  return (
    <div className="space-y-6">
      {/* Description Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Groups Grades &amp; Evaluation:</strong> Review all groups in your assigned course and submit
          your coordinator evaluations based on the grading rubric.
        </p>
      </div>

      {/* Supervisor Filter + Download CSV */}
      {!isLoading && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {uniqueSupervisors.length > 0 && (
              <>
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4" />
                  Filter by Supervisor:
                </label>
                <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="All Supervisors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Supervisors</SelectItem>
                    {uniqueSupervisors.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          <Button variant="outline" onClick={downloadGradesCSV} disabled={filteredGroups.length === 0} className="gap-2">
            <Download className="w-4 h-4" />Download CSV
          </Button>
        </div>
      )}

      {/* Groups List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No groups found in your assigned course.</div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No groups found for the selected supervisor.</div>
        ) : (
          filteredGroups.map((group) => (
            <Card key={group.id} className="overflow-hidden transition-all hover:shadow-md">
              {/* Group Header */}
              <div
                className="p-4 bg-gray-50 cursor-pointer flex items-center justify-between hover:bg-gray-100"
                onClick={() => toggleGroupExpanded(group.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  {expanded[group.id] ? (
                    <ChevronUp className="w-5 h-5 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-600" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">
                        Group {group.number || '?'} — {group.name}
                      </span>
                      {group.groupCode && (
                        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-100 rounded font-mono">
                          {group.groupCode}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                        {group.courseCode}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {group.students.length} {group.students.length === 1 ? 'student' : 'students'} •{' '}
                      {group.approvalCounts.approved} of {group.approvalCounts.total} chapters approved
                      {group.supervisorName && (
                        <> • <span className="text-gray-500">Supervisor: <strong>{group.supervisorName}</strong></span></>
                      )}
                    </p>
                  </div>
                </div>

                {/* Coordinator Evaluation Status Badge */}
                <div className="flex items-center gap-2">
                  {group.coordinatorEvaluation?.submissionStatus === 'submitted' ? (
                    <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                      <CheckCircle className="w-4 h-4" />Evaluated
                    </div>
                  ) : group.coordinatorEvaluation?.submissionStatus === 'draft' ? (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                      <AlertCircle className="w-4 h-4" />Draft
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      <AlertCircle className="w-4 h-4" />Not Started
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expanded[group.id] && (
                <div className="p-6 border-t border-gray-200 space-y-6">
                  {group.supervisorName && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                      <UserCheck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-500">Supervisor:</span>
                      <span className="font-semibold text-gray-900">{group.supervisorName}</span>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />Students ({group.students.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {group.students.map((student) => (
                        <span key={student.id} className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200">
                          {student.name || 'Unknown'}
                          {student.studentId && <span className="text-xs ml-1 opacity-75">({student.studentId})</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />Grade Components
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-900">Component</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-900">Score</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-900">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {group.gradeComponents.map((component) => (
                            <tr key={component.componentKey} className="hover:bg-gray-50">
                              <td className="px-4 py-2 text-gray-900">{component.componentName}</td>
                              <td className="px-4 py-2 text-right">
                                <span className="font-mono text-gray-900">
                                  {component.score !== null ? component.score.toFixed(1) : '—'} / {component.maxScore}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right text-gray-600">{component.weight} marks</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <h5 className="text-sm font-semibold text-blue-900">
                        {evalComponent?.componentName ?? 'Coordinator Evaluation'}
                      </h5>
                      {group.coordinatorEvaluation?.submissionStatus === 'submitted' ? (
                        <p className="text-xs text-blue-700 mt-1">
                          Score: {group.coordinatorEvaluation.normalizedScore?.toFixed(1) || '—'} /{' '}
                          {group.coordinatorEvaluation.maxScore || '—'}
                        </p>
                      ) : (
                        <p className="text-xs text-blue-700 mt-1">Not yet evaluated</p>
                      )}
                    </div>
                    <Button onClick={() => openEvaluationModal(group.id, group.number)} variant="primary">
                      {group.coordinatorEvaluation?.submissionStatus ? 'Edit Evaluation' : 'Evaluate Group'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ── Evaluation Modal (Likert-table style) ────────────────────────────── */}
      <Dialog open={evaluationModalOpen} onOpenChange={setEvaluationModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {evalComponent?.componentName ?? 'Coordinator Evaluation'} — Group {selectedGroupNumber || '?'}
            </DialogTitle>
            <DialogDescription>
              {evalComponent
                ? `Rate each criterion on a scale of 1–${criteria[0]?.maxRawScore ?? 5}. Scores are normalized to ${evalComponent.totalMarks} marks.`
                : 'Rate each criterion on a scale of 1–5.'}
            </DialogDescription>
          </DialogHeader>

          {/* Status badge */}
          {existingStatus && (
            <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg w-fit ${
              existingStatus === 'submitted'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : existingStatus === 'draft'
                ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                : 'bg-gray-50 text-gray-600 border border-gray-200'
            }`}>
              {existingStatus === 'submitted' ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {existingStatus === 'submitted' ? 'Previously submitted' : 'Draft — not yet submitted'}
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Score each criterion using the radio buttons. All criteria must be scored before submitting.</span>
          </div>

          {/* Criteria table */}
          {criteria.length > 0 ? (
            <div className="border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm text-[var(--color-text-700)]">Criterion</th>
                      {Array.from({ length: criteria[0]?.maxRawScore ?? 5 }, (_, i) => i + 1).map(n => (
                        <th key={n} className="text-center py-3 px-2 text-[var(--color-text-600)] w-12 text-sm">{n}</th>
                      ))}
                      <th className="text-center py-3 px-4 text-sm text-[var(--color-text-700)] w-20">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map(c => (
                      <CriterionRow
                        key={c.criterionKey}
                        criterion={c}
                        value={evaluationScores[c.criterionKey] || 0}
                        onChange={v => setEvaluationScores(prev => ({ ...prev, [c.criterionKey]: v }))}
                        disabled={isReadOnly || isSubmitting}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td colSpan={criteria[0]?.maxRawScore ?? 5} className="py-3 px-4 text-right font-bold text-[var(--color-text-900)]">
                        Raw Total:
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-[var(--color-text-900)] text-lg tabular-nums">
                        {rawTotal}/{maxRaw}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">Loading criteria…</div>
          )}

          {/* Normalized score preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              Normalized Score:{' '}
              <span className="font-bold text-gray-900">{calculateNormalizedScore().toFixed(2)}</span>
              {' '}/ {evalComponent?.totalMarks ?? 20}
              {evalComponent && (
                <span className="ml-2 text-xs text-gray-400">({evalComponent.componentName})</span>
              )}
            </p>
          </div>

          {/* Comment field */}
          <div>
            <Label className="mb-1.5 block text-sm text-[var(--color-text-700)]">
              Comment / Overall Feedback (Optional)
            </Label>
            <Textarea
              value={evalComment}
              onChange={e => setEvalComment(e.target.value)}
              placeholder="Add optional overall comments or feedback for this group…"
              className="min-h-[100px]"
              disabled={isReadOnly || isSubmitting}
            />
          </div>

          {!allScored && criteria.length > 0 && (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {criteria.filter(c => (evaluationScores[c.criterionKey] || 0) === 0).length} criteria not scored yet.
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEvaluationModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmitEvaluation(false)}
              disabled={isSubmitting || isReadOnly}
              className="bg-amber-500! hover:bg-amber-600! text-black font-bold border-amber-500"
            >
              <Save className="w-4 h-4 mr-2" />Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmitEvaluation(true)}
              disabled={isSubmitting || !allScored || isReadOnly}
              className="bg-emerald-600! hover:bg-emerald-700! text-white font-bold border-emerald-600"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Submitting...' : 'Submit Evaluation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
