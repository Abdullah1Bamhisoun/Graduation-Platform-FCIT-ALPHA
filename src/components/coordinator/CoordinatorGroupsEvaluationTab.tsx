import { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
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

export function CoordinatorGroupsEvaluationTab({ courseType, refreshKey }: CoordinatorGroupsEvaluationTabProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CoordinatorGroupWithGrades[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedGroups>({});

  // Coordinator grading component (from Grade Scheme Editor)
  const [evalComponent, setEvalComponent] = useState<GradingComponent | null>(null);

  // Supervisor filter
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');

  // Evaluation modal state
  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupNumber, setSelectedGroupNumber] = useState<number | null>(null);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [evaluationScores, setEvaluationScores] = useState<EvaluationScores>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load groups and the grading component on mount / courseType change / external refresh signal
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

    try {
      // Load criteria and existing evaluation in parallel
      const [criteriaData, existingEvalData] = await Promise.all([
        getCoordinatorRubricCriteria(courseType),
        getCoordinatorEvaluation(groupId, courseType, user?.activeRole ?? 'coordinator'),
      ]);

      setCriteria(criteriaData);

      // Initialize scores to 0
      const scores: EvaluationScores = {};
      for (const c of criteriaData) {
        scores[c.criterionKey] = 0;
      }

      // Pre-fill with existing scores if they exist
      if (existingEvalData.evaluations && existingEvalData.evaluations.length > 0) {
        for (const item of existingEvalData.evaluations) {
          scores[item.criterionKey] = item.rawScore || 0;
        }
      }

      setEvaluationScores(scores);
      setEvaluationModalOpen(true);
    } catch (error) {
      console.error('Error loading evaluation:', error);
      toast.error('Failed to load evaluation criteria');
    }
  }

  async function handleSubmitEvaluation(shouldSubmit: boolean) {
    if (!selectedGroupId || !user) return;

    // Validate that all criteria have been scored
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

      toast.success(shouldSubmit ? 'Evaluation submitted!' : 'Evaluation saved as draft.');
      setEvaluationModalOpen(false);

      // Reload groups to reflect updated evaluation status
      await loadGroups();
    } catch (error: any) {
      console.error('Error submitting evaluation:', error);
      toast.error(error?.message || 'Failed to submit evaluation');
    } finally {
      setIsSubmitting(false);
    }
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpanded((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const calculateTotalScore = (): number => {
    const rawTotal = Object.values(evaluationScores).reduce((a, b) => a + b, 0);
    const maxRaw = criteria.reduce((sum, c) => sum + c.maxRawScore, 0);
    if (maxRaw === 0) return 0;

    // Use totalMarks from the Grade Scheme Editor component; fall back to 20
    const componentWeight = evalComponent?.totalMarks ?? 20;

    return Math.round((rawTotal / maxRaw) * componentWeight * 100) / 100;
  };

  const getCriterionDescription = (criterion: RubricCriterion, score: number): string | undefined => {
    const key = `description${score}` as keyof RubricCriterion;
    const val = criterion[key];
    return typeof val === 'string' ? val : undefined;
  };

  const downloadGradesCSV = () => {
    if (filteredGroups.length === 0) {
      toast.error('No groups to export');
      return;
    }

    const componentNames = filteredGroups[0]?.gradeComponents.map(c => c.componentName) ?? [];

    const headers = [
      'Group Number',
      'Group Name',
      'Group Code',
      'Course',
      'Supervisor',
      'Students',
      ...componentNames,
      'Total Score',
      'Coordinator Evaluation Status',
      'Coordinator Score',
      'Coordinator Max Score',
    ];

    const rows = filteredGroups.map(group => {
      const studentNames = group.students.map(s => s.name).join('; ');
      const componentScores = group.gradeComponents.map(c =>
        c.score !== null ? c.score.toFixed(1) : ''
      );

      return [
        group.number ?? '',
        group.name,
        group.groupCode ?? '',
        group.courseCode,
        group.supervisorName ?? '',
        studentNames,
        ...componentScores,
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

  // Derive unique supervisors and filtered groups before render
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

  return (
    <div className="space-y-6">
      {/* Description Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Groups Grades & Evaluation:</strong> Review all groups in your assigned course and submit
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
          <Button
            variant="outline"
            onClick={downloadGradesCSV}
            disabled={filteredGroups.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Download CSV
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
            <Card
              key={group.id}
              className="overflow-hidden transition-all hover:shadow-md"
            >
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
                      <CheckCircle className="w-4 h-4" />
                      Evaluated
                    </div>
                  ) : group.coordinatorEvaluation?.submissionStatus === 'draft' ? (
                    <div className="flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                      <AlertCircle className="w-4 h-4" />
                      Draft
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                      <AlertCircle className="w-4 h-4" />
                      Not Started
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expanded[group.id] && (
                <div className="p-6 border-t border-gray-200 space-y-6">
                  {/* Supervisor Section */}
                  {group.supervisorName && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-2 border border-gray-200">
                      <UserCheck className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-500">Supervisor:</span>
                      <span className="font-semibold text-gray-900">{group.supervisorName}</span>
                    </div>
                  )}

                  {/* Students Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Students ({group.students.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {group.students.map((student) => (
                        <span
                          key={student.id}
                          className="inline-block px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
                        >
                          {student.name || 'Unknown'}
                          {student.studentId && <span className="text-xs ml-1 opacity-75">({student.studentId})</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Grade Components Section */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      Grade Components
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
                              <td className="px-4 py-2 text-right text-gray-600">
                                {component.weight} marks
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Coordinator Evaluation Status & Button */}
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
                    <Button
                      onClick={() => openEvaluationModal(group.id, group.number)}
                      variant="primary"
                    >
                      {group.coordinatorEvaluation?.submissionStatus ? 'Edit Evaluation' : 'Evaluate Group'}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Evaluation Modal */}
      <Dialog open={evaluationModalOpen} onOpenChange={setEvaluationModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Evaluate Group {selectedGroupNumber || '?'}</DialogTitle>
            <DialogDescription>
              {evalComponent
                ? `${evalComponent.componentName} — Rate each criterion on a scale of 1–${criteria[0]?.maxRawScore ?? 5}. Scores are normalized to ${evalComponent.totalMarks} marks.`
                : 'Rate each criterion on a scale of 1–5. Your scores will be automatically normalized based on the grading scheme.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {criteria.map((criterion) => {
              const currentScore = evaluationScores[criterion.criterionKey] || 0;
              const description = getCriterionDescription(criterion, currentScore);
              return (
                <div key={criterion.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{criterion.criterionName}</h4>
                      <p className="text-xs text-gray-600 mt-1">Max score: {criterion.maxRawScore}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-right text-lg font-bold text-blue-600">
                        {currentScore}
                      </span>
                      <span className="text-gray-600">/ {criterion.maxRawScore}</span>
                    </div>
                  </div>

                  {/* Score Slider */}
                  <input
                    type="range"
                    min="1"
                    max={criterion.maxRawScore}
                    value={currentScore}
                    onChange={(e) =>
                      setEvaluationScores({
                        ...evaluationScores,
                        [criterion.criterionKey]: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full"
                  />

                  {/* Score Indicator Buttons */}
                  <div className="flex gap-2">
                    {Array.from({ length: criterion.maxRawScore }, (_, i) => i + 1).map((score) => (
                      <button
                        key={score}
                        onClick={() =>
                          setEvaluationScores({
                            ...evaluationScores,
                            [criterion.criterionKey]: score,
                          })
                        }
                        className={`px-3 py-1 rounded text-xs font-semibold transition ${
                          currentScore === score
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>

                  {/* Description for current score */}
                  {description && (
                    <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded">
                      {description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Score Preview */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              Normalized Score:{' '}
              <span className="font-bold text-gray-900">{calculateTotalScore().toFixed(2)}</span>
              {' '}/ {evalComponent?.totalMarks ?? 20}
              {evalComponent && (
                <span className="ml-2 text-xs text-gray-400">({evalComponent.componentName})</span>
              )}
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEvaluationModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmitEvaluation(false)}
              disabled={isSubmitting}
              className="!bg-amber-500 hover:!bg-amber-600 text-black font-bold border-amber-500"
            >
              <Save className="w-4 h-4 mr-2" />
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmitEvaluation(true)}
              disabled={isSubmitting}
              className="!bg-emerald-600 hover:!bg-emerald-700 text-white font-bold border-emerald-600"
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
