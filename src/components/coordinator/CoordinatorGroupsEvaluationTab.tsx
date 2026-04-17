import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getCoordinatorGroupsWithGrades,
} from '../../services/groups';
import {
  getCoordinatorEvalComponent,
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

export function CoordinatorGroupsEvaluationTab({ courseType, refreshKey }: CoordinatorGroupsEvaluationTabProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<CoordinatorGroupWithGrades[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<ExpandedGroups>({});
  const [evalComponent, setEvalComponent] = useState<GradingComponent | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('all');

  // Inline student marks: selectedStudentKey = `${groupId}:${studentId}`
  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(null);

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

  function toggleStudentMarks(groupId: string, studentId: string) {
    const key = `${groupId}:${studentId}`;
    setSelectedStudentKey((prev) => (prev === key ? null : key));
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpanded((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

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
                      <span className="text-xs font-normal text-gray-500">— click a name to view marks</span>
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {group.students.map((student) => {
                        const key = `${group.id}:${student.id}`;
                        const isSelected = selectedStudentKey === key;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => toggleStudentMarks(group.id, student.id)}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                            }`}
                          >
                            {student.name || 'Unknown'}
                            {student.studentId && <span className="text-xs ml-1 opacity-75">({student.studentId})</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(() => {
                    const selectedStudent = group.students.find(
                      (s) => selectedStudentKey === `${group.id}:${s.id}`
                    ) ?? null;
                    const sg = selectedStudent
                      ? (group.studentGrades?.[selectedStudent.id] ?? null)
                      : null;

                    const studentScoreByKey: Record<string, number | null> = {};
                    if (sg) {
                      studentScoreByKey['supervisor_eval']          = sg.supervisorScore;
                      studentScoreByKey['committee_eval']           = sg.committeeScore;
                      studentScoreByKey['progress_reports']         = sg.weeklyScore;
                      studentScoreByKey['coordinator_deliverables'] = sg.deliverablesTotal;
                      studentScoreByKey['peer_review']              = sg.peerScore;
                    }

                    return (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />Grade Components
                          </h4>
                          {selectedStudent && (
                            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                              Viewing: {selectedStudent.name}
                            </span>
                          )}
                        </div>
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
                              {group.gradeComponents.map((component) => {
                                const displayScore = selectedStudent
                                  ? (studentScoreByKey[component.componentKey] ?? null)
                                  : component.score;
                                return (
                                  <tr key={component.componentKey} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-gray-900">{component.componentName}</td>
                                    <td className="px-4 py-2 text-right">
                                      <span className="font-mono text-gray-900">
                                        {displayScore !== null && displayScore !== undefined
                                          ? Number(displayScore).toFixed(1)
                                          : '—'} / {component.maxScore}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right text-gray-600">{component.weight} marks</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const delivComp = group.gradeComponents.find(c => c.componentKey === 'coordinator_deliverables');
                    const delivScore = delivComp?.score ?? null;
                    const delivMax = delivComp?.maxScore ?? evalComponent?.totalMarks ?? null;
                    const rubricStatus = group.coordinatorEvaluation?.submissionStatus;
                    const rubricScore = group.coordinatorEvaluation?.normalizedScore;
                    const rubricMax = group.coordinatorEvaluation?.maxScore;
                    const hasDelivScore = delivScore !== null;
                    const hasRubricScore = rubricStatus === 'submitted';

                    return (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-semibold text-blue-900">
                            {evalComponent?.componentName ?? 'Coordinator Evaluation'}
                          </h5>

                          {/* Deliverables score from Chapter Submissions */}
                          {hasDelivScore && (
                            <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              Chapter Submissions score:{' '}
                              <strong>{Number(delivScore).toFixed(1)} / {delivMax}</strong>
                            </p>
                          )}

                          {/* Rubric evaluation score */}
                          {hasRubricScore ? (
                            <p className="text-xs text-blue-700 mt-0.5 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 shrink-0" />
                              Rubric evaluation:{' '}
                              <strong>{rubricScore?.toFixed(1) || '—'} / {rubricMax || '—'}</strong>
                            </p>
                          ) : rubricStatus === 'draft' ? (
                            <p className="text-xs text-yellow-700 mt-0.5">Rubric evaluation: Draft saved</p>
                          ) : (
                            <p className="text-xs text-blue-500 mt-0.5">
                              {hasDelivScore ? 'Rubric evaluation: not yet submitted' : 'Not yet evaluated'}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => navigate(`/coordinator/evaluate-group/${group.id}`)}
                          variant="primary"
                        >
                          {rubricStatus ? 'Edit Evaluation' : 'Evaluate Group'}
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
