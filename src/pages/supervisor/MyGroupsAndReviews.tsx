import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../components/ui/tooltip';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForSupervisor } from '../../services/groups';
import { SubmissionStatus } from '../../types';
import { 
  Save, 
  AlertCircle, 
  CheckCircle, 
  MessageSquare, 
  Clock, 
  FileText,
  Download,
  Info,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Group {
  id: string;
  groupNumber: number;
  course: string;
  year: number;
  term: string;
  section: string;
  students: {
    id: string;
    name: string;
    email: string;
  }[];
  projectTitle: string;
}

interface ChapterSubmission {
  chapterId: string;
  chapterName: string;
  dueDate: string;
  adminMarks: number | string;
  supervisorMarks: number;
  status: 'graded' | 'needs-grading' | 'upcoming';
  submittedAt?: string;
  supervisorGrade?: number;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}


const initialChapterSubmissions: ChapterSubmission[] = [];

export function SupervisorMyGroupsAndReviews() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    getGroupsForSupervisor(user.id).then((data) => {
      setGroups(data.map((g) => ({
        id: g.id,
        groupNumber: g.groupNumber ?? 0,
        course: g.courseCode,
        year: 0,
        term: '',
        section: '',
        students: g.members.map((m) => ({ id: m.id, name: m.name, email: '' })),
        projectTitle: g.projectName,
      })));
    });
  }, [user?.id]);
  const [status, setStatus] = useState<SubmissionStatus>('under-review');
  const [isIPModalOpen, setIsIPModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('chapters');
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<ChapterSubmission | null>(null);
  const [gradeInput, setGradeInput] = useState('');
  const [collaborationGrade, setCollaborationGrade] = useState('');
  const [chapterFeedback, setChapterFeedback] = useState('');
  
  // Decision state
  const [decision, setDecision] = useState<'approve' | 'request-changes' | 'mark-ip' | 'draft'>('draft');
  const [decisionComment, setDecisionComment] = useState('');
  const [ipReason, setIpReason] = useState('');

  // Chapter submissions state
  const [chapterSubmissions, setChapterSubmissions] = useState<ChapterSubmission[]>(initialChapterSubmissions);

  // Audit history
  const [auditHistory] = useState<AuditEntry[]>([]);

  const currentGroup = groups.find(g => g.id === selectedGroup);

  if (!user) return null;

  // Calculate totals
  const calculateSupervisorTotal = () => {
    let total = 0;
    chapterSubmissions.forEach(chapter => {
      if (chapter.supervisorGrade !== undefined) {
        total += chapter.supervisorGrade;
      }
    });
    // Add collaboration grade if it exists
    if (collaborationGrade) {
      total += parseFloat(collaborationGrade) || 0;
    }
    return total;
  };

  const calculateAdminTotal = () => {
    let total = 0;
    chapterSubmissions.forEach(chapter => {
      if (typeof chapter.adminMarks === 'number') {
        total += chapter.adminMarks;
      }
    });
    return total;
  };

  // Get status styling
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'graded':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'needs-grading':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'upcoming':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'graded':
        return 'Graded';
      case 'needs-grading':
        return 'Needs Grading';
      case 'upcoming':
        return 'Upcoming';
      default:
        return status;
    }
  };

  const handleGradeClick = (chapter: ChapterSubmission) => {
    setSelectedChapter(chapter);
    setGradeInput(chapter.supervisorGrade?.toString() || '');
    setChapterFeedback('');
    setShowGradeDialog(true);
  };

  const handleSubmitGrade = () => {
    if (!selectedChapter) return;

    const grade = parseFloat(gradeInput);
    if (isNaN(grade) || grade < 0 || grade > selectedChapter.supervisorMarks) {
      toast.error(`Grade must be between 0 and ${selectedChapter.supervisorMarks}`);
      return;
    }

    // Update the chapter submission
    setChapterSubmissions(prev => prev.map(ch => 
      ch.chapterId === selectedChapter.chapterId 
        ? { ...ch, supervisorGrade: grade, status: 'graded' as const }
        : ch
    ));

    toast.success(`Grade submitted for ${selectedChapter.chapterName}`);
    setShowGradeDialog(false);
    setGradeInput('');
    setChapterFeedback('');
  };

  const handleMarkIP = () => {
    setIsIPModalOpen(true);
  };

  const confirmMarkIP = () => {
    setStatus('approved');
    setDecision('mark-ip');
    setIsIPModalOpen(false);
    toast.success('Project marked as IP (In Progress). Will continue in next term.', {
      duration: 4000,
    });
  };

  const handleSaveDraft = () => {
    toast.success('Draft saved successfully!');
  };

  const handleRequestChanges = () => {
    if (!decisionComment.trim()) {
      toast.error('Please provide comments when requesting changes.');
      return;
    }
    setDecision('request-changes');
    setStatus('changes-requested');
    toast.success('Changes requested. Students will be notified.');
  };

  const handleApprove = () => {
    setDecision('approve');
    setStatus('approved');
    toast.success('Evaluation approved successfully!');
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    toast.success(`Exporting evaluation as ${format.toUpperCase()}...`);
  };

  const totalAdminMarks = calculateAdminTotal();
  const totalSupervisorMarks = 20; // Fixed total

  return (
    <Layout user={user} pageTitle="Chapter Grading">
      <div className="mb-4">
        <p className="text-[var(--color-text-600)] mb-3">
          Review and grade chapter submissions from your supervised groups
        </p>

        {/* Group Selection */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-4">
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
        </div>
      </div>

      {selectedGroup && currentGroup ? (
        <div className="flex gap-6 items-start">
          {/* Main Content Area */}
          <div className="flex-1 max-w-[800px]">
            {/* Header Section */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-[var(--color-text-900)] mb-2">
                    Evaluation – Group {currentGroup.groupNumber} – {currentGroup.projectTitle}
                  </h1>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--color-text-600)]">
                    <div className="flex items-center gap-2">
                      <span>Students:</span>
                      <span className="text-[var(--color-text-900)]">{currentGroup.students.map(s => s.name).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Course:</span>
                      <span className="text-[var(--color-text-900)]">{currentGroup.course}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span>Year:</span>
                      <span className="text-[var(--color-text-900)]">{currentGroup.year}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <StatusBadge status={status} />
                    {decision === 'mark-ip' && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-300 flex items-center gap-1 cursor-help">
                              <Info className="w-3 h-3" />
                              <span>IP (Not Ready)</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Students are not ready to enter the final defense; continue in next term.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              </div>

              {/* Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-blue-900">Admin Marks</span>
                  </div>
                  <p className="text-blue-900">
                    Total: {totalAdminMarks} marks
                  </p>
                  <p className="text-blue-600 mt-1">Managed by admin for deliverables</p>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-green-900">Supervisor Marks</span>
                  </div>
                  <p className="text-green-900">
                    Total: 20 marks
                  </p>
                  <p className="text-green-600 mt-1">Distributed across chapters and collaboration</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-3 border-t border-[var(--color-border)]">
                <Button variant="outline" onClick={handleSaveDraft} className="gap-2">
                  <Save className="w-4 h-4" />
                  Save Draft
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleRequestChanges} 
                  className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  Request Changes
                </Button>
                <Button 
                  onClick={handleApprove} 
                  className="gap-2 bg-[#10B981] text-[rgb(41,207,36)] hover:bg-[#0ea572]"
                >
                  <CheckCircle className="w-4 h-4" />
                  Approve
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleMarkIP} 
                  className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  <AlertCircle className="w-4 h-4" />
                  Mark IP
                </Button>
              </div>
            </div>

            {/* Tabs Section */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden mt-4">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col">
                <div className="border-b border-[var(--color-border)]">
                  <TabsList className="mb-0 w-full justify-start rounded-none bg-transparent p-0 h-auto">
                    <TabsTrigger value="chapters" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary-600)] data-[state=active]:bg-transparent">Chapter Submissions</TabsTrigger>
                    <TabsTrigger value="collaboration" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary-600)] data-[state=active]:bg-transparent">Collaboration</TabsTrigger>
                    <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary-600)] data-[state=active]:bg-transparent">History & Audit</TabsTrigger>
                  </TabsList>
                </div>

                <div className="p-6">

              {/* Tab 1: Chapter Submissions */}
              <TabsContent value="chapters" className="mt-0">
                <div className="overflow-hidden">
                  {chapterSubmissions.length === 0 ? (
                    <div className="flex items-center justify-center min-h-40 p-6">
                      <div className="text-center">
                        <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-3" />
                        <p className="text-[var(--color-text-600)] text-lg">No chapter submissions yet</p>
                        <p className="text-[var(--color-text-500)] text-sm mt-1">Select a group to view their chapter submissions</p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                      <thead className="bg-[var(--color-surface-alt)]">
                        <tr>
                          <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Chapter Name
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Due Date
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Status
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Admin Marks
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Supervisor Marks
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {chapterSubmissions.map((chapter) => (
                          <tr key={chapter.chapterId} className="hover:bg-[var(--color-surface-alt)] transition-colors">
                            <td className="p-4 border-r border-[var(--color-border)]">
                              <span className="text-[var(--color-text-900)]">{chapter.chapterName}</span>
                            </td>
                            <td className="p-4 text-center border-r border-[var(--color-border)]">
                              <span className="text-[var(--color-text-600)]">{chapter.dueDate}</span>
                            </td>
                            <td className="p-4 text-center border-r border-[var(--color-border)]">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full border ${getStatusColor(chapter.status)}`}>
                                {getStatusText(chapter.status)}
                              </span>
                            </td>
                            <td className="p-4 text-center border-r border-[var(--color-border)]">
                              <span className="text-[var(--color-text-900)]">{chapter.adminMarks}</span>
                            </td>
                            <td className="p-4 text-center border-r border-[var(--color-border)]">
                              {chapter.supervisorGrade !== undefined ? (
                                <span className="text-green-600">
                                  {chapter.supervisorGrade}/{chapter.supervisorMarks}
                                </span>
                              ) : (
                                <span className="text-[var(--color-text-900)]">
                                  {chapter.supervisorMarks}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {chapter.status === 'needs-grading' && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleGradeClick(chapter)}
                                >
                                  Grade
                                </Button>
                              )}
                              {chapter.status === 'graded' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleGradeClick(chapter)}
                                >
                                  Edit Grade
                                </Button>
                              )}
                              {chapter.status === 'upcoming' && (
                                <span className="text-[var(--color-text-600)]">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-[var(--color-surface-alt)]">
                        <tr>
                          <td className="p-4 text-right border-r border-[var(--color-border)]" colSpan={3}>
                            <span className="text-[var(--color-text-900)]">Total:</span>
                          </td>
                          <td className="p-4 text-center border-r border-[var(--color-border)]">
                            <span className="text-[var(--color-text-900)]">{totalAdminMarks}</span>
                          </td>
                          <td className="p-4 text-center border-r border-[var(--color-border)]">
                            <span className="text-[var(--color-text-900)]">
                              {calculateSupervisorTotal()}/{totalSupervisorMarks}
                            </span>
                          </td>
                          <td className="p-4 text-center"></td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Tab 2: Collaboration */}
              <TabsContent value="collaboration" className="mt-0">
                <div className="mb-4">
                  <h3 className="text-[var(--color-text-900)] mb-2">Collaboration & Teamwork</h3>
                  <p className="text-[var(--color-text-600)] text-sm">
                    Evaluate the group's collaboration and teamwork. This is part of the supervisor's 20 marks total.
                  </p>
                </div>

                <div className="space-y-4">
                    <div>
                      <Label htmlFor="collaboration-grade" className="mb-2 block">
                        Collaboration Grade (Part of 20 total)
                      </Label>
                      <Input
                        id="collaboration-grade"
                        type="number"
                        min="0"
                        step="0.5"
                        value={collaborationGrade}
                        onChange={(e) => setCollaborationGrade(e.target.value)}
                        placeholder="Enter collaboration grade"
                      />
                    </div>

                    <div>
                      <Label htmlFor="collaboration-feedback" className="mb-2 block">
                        Feedback & Comments
                      </Label>
                      <Textarea
                        id="collaboration-feedback"
                        placeholder="Provide feedback on the group's collaboration and teamwork..."
                        className="min-h-[120px]"
                      />
                    </div>

                    <Button onClick={() => toast.success('Collaboration grade saved!')}>
                      Save Collaboration Grade
                    </Button>
                  </div>
              </TabsContent>

              {/* Tab 3: History & Audit */}
              <TabsContent value="history" className="mt-0">
                <div>
                  <h3 className="text-[var(--color-text-900)] mb-3">Evaluation History</h3>
                  {auditHistory.length === 0 ? (
                    <div className="flex items-center justify-center min-h-40 p-6">
                      <div className="text-center">
                        <Clock className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-3" />
                        <p className="text-[var(--color-text-600)] text-lg">No history yet</p>
                        <p className="text-[var(--color-text-500)] text-sm mt-1">Evaluation actions will appear here</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                    {auditHistory.map((entry) => (
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
                          <p className="text-[var(--color-text-600)] mb-1">{entry.details}</p>
                          <p className="text-[var(--color-text-600)]">by {entry.actor}</p>
                        </div>
                        <button className="text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] flex items-center gap-1">
                          View
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    </div>
                  )}
                </div>
              </TabsContent>
                </div>
              </Tabs>
            </div>

            {/* Decision Panel */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mt-4">
              <h3 className="text-[var(--color-text-900)] mb-3">Final Decision</h3>
              <RadioGroup value={decision} onValueChange={(value: any) => setDecision(value)}>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="draft" id="decision-draft" />
                    <Label htmlFor="decision-draft" className="cursor-pointer">Save as Draft</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="approve" id="decision-approve" />
                    <Label htmlFor="decision-approve" className="cursor-pointer">Approve Evaluation</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="request-changes" id="decision-changes" />
                    <Label htmlFor="decision-changes" className="cursor-pointer">Request Changes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mark-ip" id="decision-ip" />
                    <Label htmlFor="decision-ip" className="cursor-pointer">Mark as IP (In Progress)</Label>
                  </div>
                </div>
              </RadioGroup>

              {decision === 'request-changes' && (
                <div className="mt-4">
                  <Label htmlFor="changes-comment" className="mb-2 block">Comments (Required)</Label>
                  <Textarea
                    id="changes-comment"
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    placeholder="Explain what changes are needed..."
                    className="min-h-[120px]"
                    required
                  />
                </div>
              )}

              {decision === 'mark-ip' && (
                <div className="mt-4">
                  <Label htmlFor="ip-reason" className="mb-2 block">Reason (Optional)</Label>
                  <Textarea
                    id="ip-reason"
                    value={ipReason}
                    onChange={(e) => setIpReason(e.target.value)}
                    placeholder="Explain why the project will continue in the next term..."
                    className="min-h-[100px]"
                  />
                  <p className="text-[var(--color-text-600)] text-sm mt-2">
                    This project will carry into the next term. Students will not proceed to final defense.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar - Rubric Summary (Sticky) */}
          <div className="w-[320px] flex-shrink-0">
            <div className="sticky top-6 space-y-4">
              {/* Rubric Summary Card */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-md p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-semibold">Grading Summary</h3>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        Export
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleExport('pdf')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export as PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport('csv')}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export as CSV
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Current Total */}
                <div className="text-center mb-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <p className="text-[var(--color-text-600)] mb-1 text-sm">Supervisor Total</p>
                  <p className="text-4xl text-[var(--color-text-900)] mb-1">
                    {calculateSupervisorTotal().toFixed(1)}
                  </p>
                  <p className="text-[var(--color-text-600)] text-sm">out of 20</p>
                  <div className="mt-2 pt-2 border-t border-blue-200">
                    <p className="text-xl text-[var(--color-primary-600)]">
                      {((calculateSupervisorTotal() / 20) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-3 mt-3">
                  <h4 className="text-[var(--color-text-900)] mb-2">Chapter Breakdown</h4>
                  {chapterSubmissions.map((chapter, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--color-text-900)] text-sm truncate">{chapter.chapterName}</span>
                        <span className="text-[var(--color-text-600)] text-sm">
                          {chapter.supervisorGrade || 0} / {chapter.supervisorMarks}
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--color-primary-600)] to-blue-500 transition-all duration-300"
                          style={{ width: `${chapter.supervisorMarks > 0 ? ((chapter.supervisorGrade || 0) / chapter.supervisorMarks) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Admin Marks Info */}
                <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-600)]">Admin Marks</span>
                    <span className="text-[var(--color-text-900)]">{totalAdminMarks} / 15</span>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-4">
                <h4 className="text-[var(--color-text-900)] mb-2 text-sm font-semibold">Quick Links</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => navigate('/supervisor/groups')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] transition-colors"
                  >
                    Reviews Inbox
                  </button>
                  <button
                    onClick={() => navigate('/student/feedback')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] transition-colors"
                  >
                    Student Feedback & Grades
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
            Please select a group to begin evaluation
          </p>
        </div>
      )}

      {/* Grade Dialog */}
      <Dialog open={showGradeDialog} onOpenChange={setShowGradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grade {selectedChapter?.chapterName}</DialogTitle>
            <DialogDescription>
              Enter your grade and feedback for this chapter submission.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="mb-4">
              <p className="text-[var(--color-text-600)] mb-2">
                Maximum marks: {selectedChapter?.supervisorMarks}
              </p>
              {currentGroup && (
                <p className="text-[var(--color-text-600)] mb-2">
                  Group: {currentGroup.groupNumber} - {currentGroup.projectTitle}
                </p>
              )}
            </div>
            <div className="mb-4">
              <Label htmlFor="grade" className="mb-2 block">
                Grade (0-{selectedChapter?.supervisorMarks})
              </Label>
              <Input
                id="grade"
                type="number"
                min="0"
                max={selectedChapter?.supervisorMarks}
                step="0.5"
                value={gradeInput}
                onChange={(e) => setGradeInput(e.target.value)}
                placeholder={`Enter grade (0-${selectedChapter?.supervisorMarks})`}
              />
            </div>
            <div>
              <Label htmlFor="feedback" className="mb-2 block">
                Feedback (Optional)
              </Label>
              <Textarea
                id="feedback"
                value={chapterFeedback}
                onChange={(e) => setChapterFeedback(e.target.value)}
                placeholder="Provide feedback for this chapter..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGradeDialog(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSubmitGrade}>
              Submit Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark IP Confirmation Modal */}
      <Dialog open={isIPModalOpen} onOpenChange={setIsIPModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Project as IP (In Progress)?</DialogTitle>
            <DialogDescription>
              This indicates that the students are not ready to enter the final defense and will continue working on the project in the next term.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-[var(--color-text-600)]">
              Are you sure you want to mark this project as IP? This action will:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-[var(--color-text-600)]">
              <li>Prevent students from proceeding to final defense</li>
              <li>Carry the project to the next term</li>
              <li>Notify students and administrators</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIPModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={confirmMarkIP}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              Confirm Mark IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
