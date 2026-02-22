import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForEvaluation } from '../../services/groups';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import {
  Save,
  AlertCircle,
  CheckCircle,
  FileText,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface Group {
  id: string;
  groupNumber: number;
  course: string;
  projectTitle: string;
  /** Server-computed: evaluation unlocks when presentation time has passed. */
  evaluationActive: boolean;
}

interface ChapterGrade {
  chapter: string;
  score: number | null;
}

interface CommitteeCriterion {
  id: string;
  name: string;
  maxScore: 5;
  score: number | null;
}


export function SupervisorGradingEvaluation() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'chapters' | 'committee'>('chapters');
  const [status, setStatus] = useState<'draft' | 'submitted'>('draft');
  // True when the backend uses evaluation_assignments; empty list means not yet assigned.
  const [assignmentMode, setAssignmentMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Backend enforces: supervised group excluded; in assignment mode only
    // officially assigned groups are returned (empty = not yet assigned).
    getGroupsForEvaluation().then(({ groups: data, assignmentMode: mode }) => {
      setAssignmentMode(mode);
      setGroups(data.map((g) => ({
        id: g.id,
        groupNumber: g.groupNumber ?? 0,
        course: g.courseCode,
        projectTitle: g.projectName,
        evaluationActive: g.evaluationActive,
      })));
    });
  }, [user?.id]);

  // Chapter grades (CPIS-498 - 20 marks total)
  const [chapterGrades, setChapterGrades] = useState<ChapterGrade[]>([
    { chapter: 'Chapter-1 Introduction', score: null },
    { chapter: 'Chapter-2 Related Work', score: null },
    { chapter: 'Chapter-3 Data Analysis', score: null },
    { chapter: 'Chapter-4 Design', score: null },
    { chapter: 'Chapter-5 Conclusion', score: null },
  ]);

  const [chapterComments, setChapterComments] = useState('');

  // Committee criteria (CPIS-498 - 40 marks total)
  const [committeeCriteria, setCommitteeCriteria] = useState<CommitteeCriterion[]>([
    { id: 'technical', name: 'Technical Work Level', maxScore: 5, score: null },
    { id: 'complexity', name: 'Project Complexity', maxScore: 5, score: null },
    { id: 'presentation', name: 'Presentation (Style & Format)', maxScore: 5, score: null },
    { id: 'conclusion', name: 'Conclusion & Future Work', maxScore: 5, score: null },
    { id: 'document', name: 'Document (Style & Format)', maxScore: 5, score: null },
    { id: 'testing', name: 'Testing Results', maxScore: 5, score: null },
    { id: 'code', name: 'Code Check', maxScore: 5, score: null },
    { id: 'finalReport', name: 'Final Report Submission', maxScore: 5, score: null },
  ]);
  
  const [committeeComments, setCommitteeComments] = useState('');
  
  // IP Modal
  const [showIPModal, setShowIPModal] = useState(false);
  const [ipReason, setIpReason] = useState('');
  const [isIP, setIsIP] = useState(false);
  
  // Confirm Submit Modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const currentGroup = groups.find(g => g.id === selectedGroup);

  if (!user) return null;

  // Calculate totals
  const calculateChapterTotal = () => {
    return chapterGrades.reduce((sum, grade) => {
      if (grade.score !== null) {
        // Each chapter is worth 4 marks (score 1-5 mapped to /4)
        return sum + ((grade.score / 5) * 4);
      }
      return sum;
    }, 0);
  };

  const calculateCommitteeTotal = () => {
    return committeeCriteria.reduce((sum, criterion) => sum + (criterion.score || 0), 0);
  };

  const hasUnfilledChapters = () => {
    return chapterGrades.some(g => g.score === null);
  };

  const hasUnfilledCommittee = () => {
    return committeeCriteria.some(c => c.score === null);
  };

  // Handle chapter score change
  const handleChapterScoreChange = (index: number, score: number) => {
    const newGrades = [...chapterGrades];
    newGrades[index].score = score;
    setChapterGrades(newGrades);
  };

  // Handle committee score change
  const handleCommitteeScoreChange = (id: string, score: number) => {
    const newCriteria = committeeCriteria.map(c =>
      c.id === id ? { ...c, score } : c
    );
    setCommitteeCriteria(newCriteria);
  };

  // Handle save draft
  const handleSaveDraft = () => {
    toast.success('Draft saved successfully');
  };

  // Handle submit grades
  const handleSubmitGrades = () => {
    if (activeTab === 'chapters' && hasUnfilledChapters()) {
      toast.error('Please grade all chapters before submitting');
      return;
    }
    if (activeTab === 'committee' && hasUnfilledCommittee()) {
      toast.error('Please score all criteria before submitting');
      return;
    }
    setShowSubmitModal(true);
  };

  const confirmSubmitGrades = () => {
    setStatus('submitted');
    setShowSubmitModal(false);
    toast.success('Grades submitted successfully');
  };

  // Handle Mark IP
  const handleMarkIP = () => {
    setShowIPModal(true);
  };

  const confirmMarkIP = () => {
    if (!ipReason.trim()) {
      toast.error('Please provide a reason for marking as IP');
      return;
    }
    setIsIP(true);
    setShowIPModal(false);
    toast.success('Marked as IP (Not Ready)');
  };

  return (
    <Layout user={user} pageTitle="Grading & Evaluation">
      {isLocked && <LockedBanner />}
      <div className="mb-6">
        {/* Group Selection */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
          {/* Assignment-mode banner: no groups assigned yet → evaluation blocked */}
          {assignmentMode && groups.length === 0 ? (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 font-medium">No groups assigned for evaluation</p>
                <p className="text-sm text-amber-800 mt-1">
                  Evaluation cannot start until a group is officially assigned to you by the coordinator or admin.
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-md">
              <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">
                Select Group to Evaluate
              </Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger id="group-select">
                  <SelectValue placeholder="Choose a group..." />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      Group {group.groupNumber} - {group.projectTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {selectedGroup && currentGroup ? (
        <div>
          {/* Evaluation lock banner — shown until presentation time passes */}
          {!currentGroup.evaluationActive && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 font-medium">Evaluation not yet active</p>
                <p className="text-sm text-amber-800 mt-1">
                  The evaluation form is locked until the presentation date and time has passed. This is enforced by the server.
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-[var(--color-text-900)]">
                    Group {currentGroup.groupNumber}
                  </h1>
                  <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    {currentGroup.course}
                  </span>
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    status === 'submitted' 
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {status === 'submitted' ? 'Submitted' : 'Draft'}
                  </span>
                  {isIP && (
                    <span className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-700 border border-red-200">
                      IP - Not Ready
                    </span>
                  )}
                </div>
                <p className="text-[var(--color-text-600)]">{currentGroup.projectTitle}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={isLocked || !currentGroup.evaluationActive}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  onClick={handleSubmitGrades}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={isLocked || !currentGroup.evaluationActive || status === 'submitted' || isIP}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Grades
                </Button>
                <Button
                  variant="outline"
                  onClick={handleMarkIP}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  disabled={isIP || !currentGroup.evaluationActive}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark IP (Not Ready)
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="mb-6 bg-[var(--color-surface-alt)]">
              <TabsTrigger value="chapters" className="data-[state=active]:bg-white">
                CPIS-498 – Chapters (20)
              </TabsTrigger>
              <TabsTrigger value="committee" className="data-[state=active]:bg-white">
                CPIS-498 – Committee (40)
              </TabsTrigger>
            </TabsList>

            {/* Chapters Tab */}
            <TabsContent value="chapters">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-8">
                <div className="mb-6">
                  <h3 className="text-[var(--color-text-900)] mb-2">Chapters Evaluation Matrix</h3>
                  <p className="text-[var(--color-text-600)]">
                    Evaluate 5 chapters using Likert scale (1-5). Each chapter is weighted at 4 marks. Total: 20 marks.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b-2 border-[var(--color-border)]">
                      <tr>
                        <th className="text-left py-4 px-4 text-[var(--color-text-900)]">Chapter</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">1</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">2</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">3</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">4</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">5</th>
                        <th className="text-center py-4 px-4 text-[var(--color-text-900)] w-24">Score /4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chapterGrades.map((grade, index) => (
                        <tr key={index} className="border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors">
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-[var(--color-text-900)]">{grade.chapter}</span>
                            </div>
                          </td>
                          {[1, 2, 3, 4, 5].map((score) => (
                            <td key={score} className="text-center py-4 px-3">
                              <label className="flex justify-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`chapter-${index}`}
                                  checked={grade.score === score}
                                  onChange={() => handleChapterScoreChange(index, score)}
                                  disabled={isIP || !currentGroup.evaluationActive}
                                  className="w-6 h-6 cursor-pointer appearance-none rounded-full border-2 border-gray-400 checked:border-green-600 checked:border-[6px] checked:bg-white hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                  }}
                                />
                              </label>
                            </td>
                          ))}
                          <td className="text-center py-4 px-4 text-[var(--color-text-900)]">
                            {grade.score ? ((grade.score / 5) * 4).toFixed(1) : '0.0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                        <td colSpan={6} className="py-4 px-4 text-right text-[var(--color-text-900)]">
                          <strong>Total:</strong>
                        </td>
                        <td className="py-4 px-4 text-center text-[var(--color-text-900)]">
                          <strong>{calculateChapterTotal().toFixed(1)} / 20</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {hasUnfilledChapters() && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 text-sm text-amber-900">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Some chapters are not scored yet</span>
                  </div>
                )}

                {/* Comments */}
                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <Label htmlFor="chapter-comments" className="mb-2 block text-[var(--color-text-900)]">
                    Comments for Chapter Grading
                  </Label>
                  <Textarea
                    id="chapter-comments"
                    value={chapterComments}
                    onChange={(e) => setChapterComments(e.target.value)}
                    placeholder="Overall feedback on chapters..."
                    className="min-h-[120px]"
                    disabled={isIP || !currentGroup.evaluationActive}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Committee Tab */}
            <TabsContent value="committee">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-8">
                <div className="mb-6">
                  <h3 className="text-[var(--color-text-900)] mb-2">Committee Evaluation Matrix</h3>
                  <p className="text-[var(--color-text-600)]">
                    Evaluate 8 criteria using Likert scale (1-5). Each criterion is worth 5 marks. Total: 40 marks.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b-2 border-[var(--color-border)]">
                      <tr>
                        <th className="text-left py-4 px-4 text-[var(--color-text-900)]">Criterion</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">1</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">2</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">3</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">4</th>
                        <th className="text-center py-4 px-3 text-[var(--color-text-600)] w-16">5</th>
                        <th className="text-center py-4 px-4 text-[var(--color-text-900)] w-24">Score /5</th>
                      </tr>
                    </thead>
                    <tbody>
                      {committeeCriteria.map((criterion, index) => (
                        <tr key={criterion.id} className={`border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="py-4 px-4">
                            <span className="text-[var(--color-text-900)]">{criterion.name}</span>
                          </td>
                          {[1, 2, 3, 4, 5].map((score) => (
                            <td key={score} className="text-center py-4 px-3">
                              <label className="flex justify-center cursor-pointer">
                                <input
                                  type="radio"
                                  name={`criterion-${criterion.id}`}
                                  checked={criterion.score === score}
                                  onChange={() => handleCommitteeScoreChange(criterion.id, score)}
                                  disabled={isIP || !currentGroup.evaluationActive}
                                  className="w-6 h-6 cursor-pointer appearance-none rounded-full border-2 border-gray-400 checked:border-green-600 checked:border-[6px] checked:bg-white hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                  style={{
                                    WebkitAppearance: 'none',
                                    MozAppearance: 'none',
                                  }}
                                />
                              </label>
                            </td>
                          ))}
                          <td className="text-center py-4 px-4 text-[var(--color-text-900)]">
                            {criterion.score || 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                        <td colSpan={6} className="py-4 px-4 text-right text-[var(--color-text-900)]">
                          <strong>Total:</strong>
                        </td>
                        <td className="py-4 px-4 text-center text-[var(--color-text-900)]">
                          <strong>{calculateCommitteeTotal()} / 40</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {hasUnfilledCommittee() && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 text-sm text-amber-900">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Some criteria are not scored yet</span>
                  </div>
                )}

                {/* Comments */}
                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <Label htmlFor="committee-comments" className="mb-2 block text-[var(--color-text-900)]">
                    Comments for Committee Evaluation
                  </Label>
                  <Textarea
                    id="committee-comments"
                    value={committeeComments}
                    onChange={(e) => setCommitteeComments(e.target.value)}
                    placeholder="Overall notes / justification for the scores..."
                    className="min-h-[150px]"
                    disabled={isIP || !currentGroup.evaluationActive}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
          <p className="text-[var(--color-text-600)]">
            Please select a group to begin evaluation
          </p>
        </div>
      )}

      {/* Mark IP Modal */}
      <Dialog open={showIPModal} onOpenChange={setShowIPModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Mark as IP (Not Ready)</DialogTitle>
            <DialogDescription>
              This will mark the project as In Progress and not ready for final defense
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-900">
                <p className="mb-2"><strong>Warning:</strong> This action will:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Lock all grading inputs</li>
                  <li>Prevent submission of grades</li>
                  <li>Notify the students and admin</li>
                  <li>Require admin approval to reverse</li>
                </ul>
              </div>
            </div>

            <Label htmlFor="ip-reason" className="mb-2 block">Reason (Required)</Label>
            <Textarea
              id="ip-reason"
              value={ipReason}
              onChange={(e) => setIpReason(e.target.value)}
              placeholder="Explain why this project is not ready for final defense..."
              className="min-h-[120px]"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIPModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMarkIP} className="bg-red-600 hover:bg-red-700 text-white">
              Confirm Mark IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submit Confirmation Modal */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Submit Grades</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit these grades?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-[var(--color-text-600)]">Chapters Total:</span>
                <span className="text-[var(--color-text-900)]">{calculateChapterTotal().toFixed(1)} / 20</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-[var(--color-text-600)]">Committee Total:</span>
                <span className="text-[var(--color-text-900)]">{calculateCommitteeTotal()} / 40</span>
              </div>
              <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-blue-900"><strong>Grand Total:</strong></span>
                <span className="text-blue-900"><strong>{(calculateChapterTotal() + calculateCommitteeTotal()).toFixed(1)} / 60</strong></span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900">
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Once submitted, grades will be visible to admin and locked from further editing.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSubmitGrades} className="bg-green-600 hover:bg-green-700 text-white">
              <Send className="w-4 h-4 mr-2" />
              Submit Grades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
