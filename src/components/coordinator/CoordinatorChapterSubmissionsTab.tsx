import { useState, useEffect, useRef } from 'react';
import { Card } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Award,
  Loader2,
  Eye,
  Download,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { toast } from 'sonner';
import { getChapterSubmissionsForCoordinator } from '../../services/submissions';
import { getSignedUrl } from '../../services/storage';
import { getCoordinatorGroupsWithGrades } from '../../services/groups';
import { getMilestoneConfigs } from '../../services/milestones';
import { saveCoordinatorDeliverableScore } from '../../services/grading-rubric';
import { supabase } from '../../lib/supabase';
import { DocumentViewerWithAnnotations } from '../DocumentViewerWithAnnotations';
import type { ChapterSubmission, CoordinatorChapterSubmissionsResult } from '../../services/submissions';
import type { CoordinatorGroupWithGrades } from '../../services/groups';
import type { MilestoneConfig } from '../../types';

interface CoordinatorChapterSubmissionsTabProps {
  courseType: '498' | '499';
  courseId: string;
  onGradeSaved?: () => void;
  refreshKey?: number;
  role?: string;
}

/** criterionKey → score for a given groupId */
type GroupScores = Record<string, number>;

export function CoordinatorChapterSubmissionsTab({ courseType, courseId, onGradeSaved, role = 'coordinator' }: CoordinatorChapterSubmissionsTabProps) {
  const [submissions, setSubmissions] = useState<ChapterSubmission[]>([]);
  const [stats, setStats] = useState<CoordinatorChapterSubmissionsResult['stats']>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [groups, setGroups] = useState<CoordinatorGroupWithGrades[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  // Milestone criterion map: milestoneId → MilestoneConfig (with criterion info)
  const [milestoneMap, setMilestoneMap] = useState<Record<string, MilestoneConfig>>({});

  // Existing coordinator deliverable scores: groupId → { criterionKey → score }
  const [groupScores, setGroupScores] = useState<Record<string, GroupScores>>({});

  // Grade dialog state
  const [gradingSubmission, setGradingSubmission] = useState<ChapterSubmission | null>(null);
  const [gradeInput, setGradeInput] = useState<string>('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // View file modal state
  const [viewerFile, setViewerFile] = useState<{ url: string; filePath: string; fileName: string } | null>(null);

  // Track current user info
  const userIdRef = useRef<string | null>(null);
  const userNameRef = useRef<string>('');
  const userRoleRef = useRef<string>(role);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      userIdRef.current = data.session?.user?.id ?? null;
      userNameRef.current = data.session?.user?.user_metadata?.name ?? data.session?.user?.email ?? '';
    });
  }, [role]);

  // Reset filter and reload when course type changes
  useEffect(() => {
    setSelectedGroupFilter('all');
    loadData('all');
  }, [courseType]);

  async function loadData(groupFilter = selectedGroupFilter) {
    setIsLoading(true);
    try {
      const [submissionsData, groupsData, milestoneCfgs] = await Promise.all([
        getChapterSubmissionsForCoordinator(courseType, groupFilter === 'all' ? undefined : groupFilter, role),
        getCoordinatorGroupsWithGrades(courseType, role),
        getMilestoneConfigs(courseId),
      ]);

      setSubmissions(submissionsData.submissions);
      setStats(submissionsData.stats);
      setGroups(groupsData);

      // Build milestone lookup map
      const mMap: Record<string, MilestoneConfig> = {};
      for (const m of milestoneCfgs) {
        mMap[m.id] = m;
      }
      setMilestoneMap(mMap);

      // Load existing scores for all unique groups
      const uniqueGroupIds = [...new Set(submissionsData.submissions.map((s) => s.groupId).filter(Boolean))];
      if (uniqueGroupIds.length > 0 && courseId) {
        const { data: scoreRows } = await supabase
          .from('coordinator_deliverable_scores')
          .select('group_id, deliverable_key, score')
          .eq('course_id', courseId)
          .in('group_id', uniqueGroupIds);

        const scores: Record<string, GroupScores> = {};
        for (const row of scoreRows ?? []) {
          if (!scores[row.group_id]) scores[row.group_id] = {};
          scores[row.group_id][row.deliverable_key] = Number(row.score);
        }
        setGroupScores(scores);
      }
    } catch (error) {
      console.error('Error loading chapter submissions:', error);
      toast.error('Failed to load chapter submissions');
    } finally {
      setIsLoading(false);
    }
  }

  // Reload when group filter changes
  useEffect(() => {
    if (!isLoading) {
      loadData(selectedGroupFilter);
    }
  }, [selectedGroupFilter]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'changes-requested':
      case 'rejected':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
      case 'under-review':
      case 'submitted':
        return <Clock className="w-5 h-5 text-yellow-600" />;
      default:
        return <FileText className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'changes-requested': return 'Changes Requested';
      case 'rejected': return 'Rejected';
      case 'pending':
      case 'under-review': return 'Under Review';
      case 'submitted': return 'Submitted';
      default: return status;
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'approved': return 'bg-green-50 text-green-700 border-green-200';
      case 'changes-requested':
      case 'rejected': return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
      case 'under-review':
      case 'submitted': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const openGradeDialog = (submission: ChapterSubmission) => {
    const criterion = milestoneMap[submission.milestoneId];
    if (!criterion?.gradingCriterionKey) return;
    const existing = groupScores[submission.groupId]?.[criterion.gradingCriterionKey];
    setGradeInput(existing !== undefined ? String(existing) : '');
    setGradingSubmission(submission);
  };

  const handleSaveGrade = async () => {
    if (!gradingSubmission || !courseId) return;
    const criterion = milestoneMap[gradingSubmission.milestoneId];
    if (!criterion?.gradingCriterionKey || !criterion.gradingCriterionMax) return;

    const score = parseFloat(gradeInput);
    if (isNaN(score) || score < 0 || score > criterion.gradingCriterionMax) {
      toast.error(`Score must be between 0 and ${criterion.gradingCriterionMax}`);
      return;
    }

    setIsSavingGrade(true);
    try {
      await saveCoordinatorDeliverableScore({
        groupId: gradingSubmission.groupId,
        courseId,
        deliverableKey: criterion.gradingCriterionKey,
        score,
        maxScore: criterion.gradingCriterionMax,
        gradedBy: userIdRef.current ?? '',
      });

      // Update local scores
      setGroupScores((prev) => ({
        ...prev,
        [gradingSubmission.groupId]: {
          ...(prev[gradingSubmission.groupId] ?? {}),
          [criterion.gradingCriterionKey!]: score,
        },
      }));

      toast.success(`Grade saved: ${score}/${criterion.gradingCriterionMax}`);
      setGradingSubmission(null);
      onGradeSaved?.();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save grade');
    } finally {
      setIsSavingGrade(false);
    }
  };

  const handleView = async (filePath: string, fileName: string) => {
    try {
      const url = await getSignedUrl(filePath);
      setViewerFile({ url, filePath, fileName });
    } catch {
      toast.error('Failed to open file');
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const url = await getSignedUrl(filePath);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download file');
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-gray-600 uppercase tracking-wide leading-tight">Total Submissions</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400 shrink-0" />
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-yellow-600 uppercase tracking-wide leading-tight">Pending Review</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 shrink-0" />
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-green-600 uppercase tracking-wide leading-tight">Approved</p>
              <p className="text-xl sm:text-2xl font-bold text-green-700">{stats.approved}</p>
            </div>
            <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 shrink-0" />
          </div>
        </Card>

        <Card className="p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-red-600 uppercase tracking-wide leading-tight">Changes Requested</p>
              <p className="text-xl sm:text-2xl font-bold text-red-700">{stats.rejected}</p>
            </div>
            <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 shrink-0" />
          </div>
        </Card>
      </div>

      {/* Group Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Group:</label>
        <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Select a group..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Groups</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id}>
                Group {group.number} — {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Submissions Table */}
      <Card className="overflow-hidden max-w-full">
        <div className="overflow-x-auto w-full">
          <div className="min-w-[700px]">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Group</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Student</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Chapter</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Version</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Submitted</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Grade</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    Loading submissions...
                  </td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                    No submissions found for the selected filter.
                  </td>
                </tr>
              ) : (
                submissions.map((submission, idx) => {
                  const criterion = milestoneMap[submission.milestoneId];
                  const hasLinkedCriterion = !!(criterion?.gradingCriterionKey);
                  const existingScore = hasLinkedCriterion
                    ? groupScores[submission.groupId]?.[criterion.gradingCriterionKey!]
                    : undefined;

                  return (
                    <tr key={submission.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {submission.groupNumber ? `Group ${submission.groupNumber}` : 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {submission.studentName || 'Unknown Student'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {submission.milestoneName || 'Unknown Milestone'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        v{submission.currentVersion}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(submission.submittedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(submission.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(submission.status)}`}>
                            {getStatusLabel(submission.status)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {hasLinkedCriterion ? (
                          <div className="flex items-center gap-2">
                            {existingScore !== undefined ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                <Award className="w-3 h-3" />
                                {existingScore}/{criterion.gradingCriterionMax}
                              </span>
                            ) : null}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-50"
                              onClick={() => openGradeDialog(submission)}
                            >
                              <Award className="w-3 h-3" />
                              {existingScore !== undefined ? 'Edit' : 'Grade'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No grade linked</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {(() => {
                          const latestVersion = submission.versions.find(v => v.version === submission.currentVersion)
                            ?? submission.versions[submission.versions.length - 1];
                          const filePath = latestVersion?.filePath;
                          const fileName = latestVersion?.fileName ?? `submission-v${submission.currentVersion}`;
                          if (!filePath) return <span className="text-xs text-gray-400">No file</span>;
                          return (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                                onClick={() => handleView(filePath, fileName)}
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                                onClick={() => handleDownload(filePath, fileName)}
                              >
                                <Download className="w-3 h-3" />
                                Download
                              </Button>
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </Card>

      {/* File Viewer with Annotations */}
      {viewerFile && (
        <DocumentViewerWithAnnotations
          fileUrl={viewerFile.url}
          filePath={viewerFile.filePath}
          fileName={viewerFile.fileName}
          onClose={() => setViewerFile(null)}
          userId={userIdRef.current ?? ''}
          userName={userNameRef.current}
          userRole={userRoleRef.current}
        />
      )}

      {/* Grade Dialog */}
      <Dialog open={!!gradingSubmission} onOpenChange={(open) => { if (!open) setGradingSubmission(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-600" />
              Grade Submission
            </DialogTitle>
            {gradingSubmission && (
              <DialogDescription>
                Group {gradingSubmission.groupNumber} — {gradingSubmission.milestoneName}
              </DialogDescription>
            )}
          </DialogHeader>

          {gradingSubmission && (() => {
            const criterion = milestoneMap[gradingSubmission.milestoneId];
            return (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="text-xs text-purple-600 font-medium mb-0.5">Grading Criterion</p>
                  <p className="text-sm font-semibold text-purple-900">{criterion?.gradingCriterionName}</p>
                  <p className="text-xs text-purple-700 mt-0.5">Max score: {criterion?.gradingCriterionMax}</p>
                </div>

                <div>
                  <Label htmlFor="grade-score" className="mb-1 block">
                    Score (0 – {criterion?.gradingCriterionMax})
                  </Label>
                  <Input
                    id="grade-score"
                    type="number"
                    min={0}
                    max={criterion?.gradingCriterionMax}
                    step={0.5}
                    value={gradeInput}
                    onChange={(e) => setGradeInput(e.target.value)}
                    placeholder={`Enter score out of ${criterion?.gradingCriterionMax}`}
                    className="w-40"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This grade applies to the entire group (Group {gradingSubmission.groupNumber}).
                  </p>
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setGradingSubmission(null)} disabled={isSavingGrade}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveGrade}
              disabled={isSavingGrade || gradeInput === ''}
              className="!bg-green-600 text-white hover:!bg-green-700 disabled:!bg-green-300 disabled:!text-white disabled:!border-green-300"
            >
              {isSavingGrade ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Saving…</>
              ) : (
                <>Save Grade</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
