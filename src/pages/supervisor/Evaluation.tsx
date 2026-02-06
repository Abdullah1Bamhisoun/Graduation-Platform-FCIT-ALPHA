import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
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
import { mockUsers } from '../../lib/mock-data';
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
  ChevronRight,
  StickyNote
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Chapter498Scores {
  chapter1: number | null;
  chapter2: number | null;
  chapter3: number | null;
  chapter4: number | null;
  chapter5: number | null;
}

interface Chapter498Notes {
  chapter1: string;
  chapter2: string;
  chapter3: string;
  chapter4: string;
  chapter5: string;
}

interface Criteria499Scores {
  student1: {
    documentation: number | null;
    implementation: number | null;
    testing: number | null;
  };
  student2: {
    documentation: number | null;
    implementation: number | null;
    testing: number | null;
  };
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

export function SupervisorEvaluation() {
  const navigate = useNavigate();
  const user = mockUsers.supervisor;
  const [status, setStatus] = useState<SubmissionStatus>('under-review');
  const [isIPModalOpen, setIsIPModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cpis498');
  const [selectedStudent, setSelectedStudent] = useState<'student1' | 'student2'>('student1');
  const [showNotes, setShowNotes] = useState<Record<string, boolean>>({});
  
  // Decision state
  const [decision, setDecision] = useState<'approve' | 'request-changes' | 'mark-ip' | 'draft'>('draft');
  const [decisionComment, setDecisionComment] = useState('');
  const [ipReason, setIpReason] = useState('');

  // CPIS-498 scores (Likert 1-5)
  const [scores498, setScores498] = useState<Chapter498Scores>({
    chapter1: null,
    chapter2: null,
    chapter3: null,
    chapter4: null,
    chapter5: null,
  });

  const [notes498, setNotes498] = useState<Chapter498Notes>({
    chapter1: '',
    chapter2: '',
    chapter3: '',
    chapter4: '',
    chapter5: '',
  });

  // CPIS-499 scores (Likert 1-5, directly mapped)
  const [scores499, setScores499] = useState<Criteria499Scores>({
    student1: {
      documentation: null,
      implementation: null,
      testing: null,
    },
    student2: {
      documentation: null,
      implementation: null,
      testing: null,
    },
  });

  // Audit history
  const [auditHistory] = useState<AuditEntry[]>([
    {
      id: '1',
      timestamp: '2024-11-25T10:30:00',
      actor: 'Dr. Ahmad AlKhatib',
      action: 'Started Review',
      details: 'Evaluation process initiated',
    },
    {
      id: '2',
      timestamp: '2024-11-26T14:15:00',
      actor: 'Dr. Ahmad AlKhatib',
      action: 'Updated Score',
      details: 'Chapter 1 score changed from 3 to 4',
    },
    {
      id: '3',
      timestamp: '2024-11-27T09:00:00',
      actor: 'Dr. Ahmad AlKhatib',
      action: 'Added Comment',
      details: 'Requested improvements on related work section',
    },
  ]);

  // Mock group data
  const groupData = {
    groupId: '13_498_2026_01_M',
    groupName: 'Group 13',
    milestone: 'Chapter 3 - Data Analysis',
    students: ['Abdullah Bamhisoun', 'Abdulrahman Solymani'],
    course: 'CPIS-498' as const,
    supervisor: 'Dr. Ahmad AlKhatib',
    submittedAt: '2024-11-23T15:30:00',
  };

  // Calculate CPIS-498 total (scaled from 1-5 to 0-4 per chapter)
  const calculate498Total = () => {
    let total = 0;
    Object.values(scores498).forEach(score => {
      if (score !== null) {
        // Scale from 1-5 to 0-4: (score / 5) * 4
        total += Math.round((score / 5) * 4 * 10) / 10;
      }
    });
    return Math.round(total * 10) / 10;
  };

  // Calculate CPIS-499 total for a student (direct 1-5 mapping)
  const calculate499StudentTotal = (studentScores: { documentation: number | null; implementation: number | null; testing: number | null }) => {
    let total = 0;
    Object.values(studentScores).forEach(score => {
      if (score !== null) {
        total += score;
      }
    });
    return total;
  };

  // Calculate CPIS-499 group average
  const calculate499Average = () => {
    const student1Total = calculate499StudentTotal(scores499.student1);
    const student2Total = calculate499StudentTotal(scores499.student2);
    return Math.round(((student1Total + student2Total) / 2) * 10) / 10;
  };

  // Get current total based on active tab
  const getCurrentTotal = () => {
    if (activeTab === 'cpis498') {
      return calculate498Total();
    } else if (activeTab === 'cpis499') {
      return calculate499Average();
    }
    return 0;
  };

  // Get max score based on active tab
  const getMaxScore = () => {
    if (activeTab === 'cpis498') return 20;
    if (activeTab === 'cpis499') return 15;
    return 0;
  };

  // Get breakdown for rubric card
  const getBreakdown = () => {
    if (activeTab === 'cpis498') {
      return [
        { name: 'Chapter 1', score: scores498.chapter1 ? Math.round((scores498.chapter1 / 5) * 4 * 10) / 10 : 0, max: 4 },
        { name: 'Chapter 2', score: scores498.chapter2 ? Math.round((scores498.chapter2 / 5) * 4 * 10) / 10 : 0, max: 4 },
        { name: 'Chapter 3', score: scores498.chapter3 ? Math.round((scores498.chapter3 / 5) * 4 * 10) / 10 : 0, max: 4 },
        { name: 'Chapter 4', score: scores498.chapter4 ? Math.round((scores498.chapter4 / 5) * 4 * 10) / 10 : 0, max: 4 },
        { name: 'Chapter 5', score: scores498.chapter5 ? Math.round((scores498.chapter5 / 5) * 4 * 10) / 10 : 0, max: 4 },
      ];
    } else if (activeTab === 'cpis499') {
      const currentStudent = scores499[selectedStudent];
      return [
        { name: 'Documentation', score: currentStudent.documentation || 0, max: 5 },
        { name: 'Implementation', score: currentStudent.implementation || 0, max: 5 },
        { name: 'Testing', score: currentStudent.testing || 0, max: 5 },
      ];
    }
    return [];
  };

  const handleMarkIP = () => {
    setIsIPModalOpen(true);
  };

  const confirmMarkIP = () => {
    setStatus('approved'); // Using 'approved' as placeholder for IP status
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

  const toggleNotes = (chapter: string) => {
    setShowNotes(prev => ({ ...prev, [chapter]: !prev[chapter] }));
  };

  return (
    <Layout user={user} pageTitle="Evaluation">
      <div className="flex gap-6">
        {/* Main Content Area */}
        <div className="flex-1 max-w-[800px]">
          {/* Header Section */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-[var(--color-text-900)] mb-2">
                  Evaluation – {groupData.groupName} – {groupData.milestone}
                </h1>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--color-text-600)]">
                  <div className="flex items-center gap-2">
                    <span>Students:</span>
                    <span className="text-[var(--color-text-900)]">{groupData.students.join(', ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Course:</span>
                    <span className="text-[var(--color-text-900)]">{groupData.course}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Supervisor:</span>
                    <span className="text-[var(--color-text-900)]">{groupData.supervisor}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-2 text-[var(--color-text-600)]">
                    <Clock className="w-4 h-4" />
                    <span>Submitted: {new Date(groupData.submittedAt).toLocaleString()}</span>
                  </div>
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

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4 border-t border-[var(--color-border)]">
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
                className="gap-2 bg-[#10B981] text-white hover:bg-[#0ea572]"
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="cpis498">CPIS-498 (20 marks)</TabsTrigger>
              <TabsTrigger value="cpis499">CPIS-499 (15 marks)</TabsTrigger>
              <TabsTrigger value="history">History & Audit</TabsTrigger>
            </TabsList>

            {/* Tab 1: CPIS-498 */}
            <TabsContent value="cpis498">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="mb-6">
                  <h3 className="text-[var(--color-text-900)] mb-2">Chapters Matrix</h3>
                  <p className="text-[var(--color-text-600)]">
                    Evaluate 5 chapters using Likert scale (1-5). Each chapter is weighted at 4 marks. Total: 20 marks.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[var(--color-border)]">
                        <th className="text-left py-3 px-4 text-[var(--color-text-900)]">Chapter</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">1</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">2</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">3</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">4</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">5</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-900)] w-24">Score /4</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['chapter1', 'chapter2', 'chapter3', 'chapter4', 'chapter5'] as const).map((chapterKey, idx) => {
                        const chapterNames = [
                          'Chapter-1 Introduction',
                          'Chapter-2 Related Work',
                          'Chapter-3 Data Analysis',
                          'Chapter-4 Design',
                          'Chapter-5 Conclusion'
                        ];
                        const score = scores498[chapterKey];
                        const scaledScore = score ? Math.round((score / 5) * 4 * 10) / 10 : 0;

                        return (
                          <tr key={chapterKey} className={`border-b border-[var(--color-border)] ${idx % 2 === 0 ? 'bg-[var(--color-surface-alt)]' : ''} hover:bg-blue-50 transition-colors`}>
                            <td className="py-4 px-4 text-[var(--color-text-900)]">
                              <div className="flex items-center gap-2">
                                <span>{chapterNames[idx]}</span>
                                <button
                                  onClick={() => toggleNotes(chapterKey)}
                                  className="text-[var(--color-text-600)] hover:text-[var(--color-primary-600)] transition-colors"
                                >
                                  <StickyNote className="w-4 h-4" />
                                </button>
                              </div>
                              {showNotes[chapterKey] && (
                                <div className="mt-2">
                                  <Textarea
                                    placeholder="Add notes for this chapter..."
                                    value={notes498[chapterKey]}
                                    onChange={(e) => setNotes498({ ...notes498, [chapterKey]: e.target.value })}
                                    className="min-h-[80px] text-sm"
                                  />
                                </div>
                              )}
                            </td>
                            {[1, 2, 3, 4, 5].map((value) => (
                              <td key={value} className="text-center py-4 px-4">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`score-498-${chapterKey}`}
                                    value={value}
                                    checked={scores498[chapterKey] === value}
                                    onChange={() => setScores498({ ...scores498, [chapterKey]: value })}
                                    className="w-5 h-5 cursor-pointer accent-[var(--color-primary-600)] focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2"
                                  />
                                </label>
                              </td>
                            ))}
                            <td className="text-center py-4 px-4 text-[var(--color-text-900)]">
                              {scaledScore.toFixed(1)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[var(--color-border)]">
                        <td colSpan={6} className="py-4 px-4 text-right text-[var(--color-text-900)]">
                          <strong>Total:</strong>
                        </td>
                        <td className="text-center py-4 px-4 text-[var(--color-text-900)]">
                          <strong>{calculate498Total().toFixed(1)} / 20</strong>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Validation Warning */}
                {Object.values(scores498).some(s => s === null) && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-900">Missing Selections</p>
                      <p className="text-amber-700 text-sm mt-1">
                        Some chapters have not been evaluated yet. You can save as draft to complete later.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: CPIS-499 */}
            <TabsContent value="cpis499">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="mb-6">
                  <h3 className="text-[var(--color-text-900)] mb-2">Supervisor Evaluation (499)</h3>
                  <p className="text-[var(--color-text-600)]">
                    Evaluate 3 criteria using Likert scale (1-5). Each criterion contributes directly to the total. Max: 15 marks.
                  </p>
                </div>

                {/* Student Selector */}
                <div className="mb-6">
                  <Label className="mb-2 block">Select Student</Label>
                  <div className="flex gap-2">
                    <Button
                      variant={selectedStudent === 'student1' ? 'default' : 'outline'}
                      onClick={() => setSelectedStudent('student1')}
                      className={selectedStudent === 'student1' ? 'bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)]' : ''}
                    >
                      {groupData.students[0]}
                    </Button>
                    <Button
                      variant={selectedStudent === 'student2' ? 'default' : 'outline'}
                      onClick={() => setSelectedStudent('student2')}
                      className={selectedStudent === 'student2' ? 'bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)]' : ''}
                    >
                      {groupData.students[1]}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-[var(--color-border)]">
                        <th className="text-left py-3 px-4 text-[var(--color-text-900)]">Criterion *</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">1</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">2</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">3</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">4</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-600)] w-16">5</th>
                        <th className="text-center py-3 px-4 text-[var(--color-text-900)] w-24">Score /5</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(['documentation', 'implementation', 'testing'] as const).map((criterionKey, idx) => {
                        const criterionNames = [
                          'Project Documentation',
                          'Project Implementation',
                          'Project Testing'
                        ];
                        const score = scores499[selectedStudent][criterionKey];

                        return (
                          <tr key={criterionKey} className={`border-b border-[var(--color-border)] ${idx % 2 === 0 ? 'bg-[var(--color-surface-alt)]' : ''} hover:bg-blue-50 transition-colors`}>
                            <td className="py-4 px-4 text-[var(--color-text-900)]">
                              {criterionNames[idx]}
                            </td>
                            {[1, 2, 3, 4, 5].map((value) => (
                              <td key={value} className="text-center py-4 px-4">
                                <label className="flex items-center justify-center cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`score-499-${selectedStudent}-${criterionKey}`}
                                    value={value}
                                    checked={scores499[selectedStudent][criterionKey] === value}
                                    onChange={() => setScores499({
                                      ...scores499,
                                      [selectedStudent]: {
                                        ...scores499[selectedStudent],
                                        [criterionKey]: value
                                      }
                                    })}
                                    className="w-5 h-5 cursor-pointer accent-[var(--color-primary-600)] focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2"
                                  />
                                </label>
                              </td>
                            ))}
                            <td className="text-center py-4 px-4 text-[var(--color-text-900)]">
                              {score || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Student Totals */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-[var(--color-text-600)] mb-1">{groupData.students[0]}</p>
                    <p className="text-2xl text-[var(--color-text-900)]">
                      {calculate499StudentTotal(scores499.student1)} / 15
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-[var(--color-text-600)] mb-1">{groupData.students[1]}</p>
                    <p className="text-2xl text-[var(--color-text-900)]">
                      {calculate499StudentTotal(scores499.student2)} / 15
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-[var(--color-primary-100)] border border-[var(--color-primary-600)] rounded-lg">
                  <p className="text-[var(--color-text-600)] mb-1">Group Average</p>
                  <p className="text-3xl text-[var(--color-text-900)]">
                    {calculate499Average().toFixed(1)} / 15
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Tab 3: History & Audit */}
            <TabsContent value="history">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h3 className="text-[var(--color-text-900)] mb-4">Evaluation History</h3>
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
              </div>
            </TabsContent>
          </Tabs>

          {/* Decision Panel */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mt-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Final Decision</h3>
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
          <div className="sticky top-6 space-y-6">
            {/* Rubric Summary Card */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[var(--color-text-900)]">Rubric Summary</h3>
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
              <div className="text-center mb-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                <p className="text-[var(--color-text-600)] mb-2">Current Total</p>
                <p className="text-5xl text-[var(--color-text-900)] mb-2">
                  {getCurrentTotal().toFixed(1)}
                </p>
                <p className="text-[var(--color-text-600)]">out of {getMaxScore()}</p>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-2xl text-[var(--color-primary-600)]">
                    {((getCurrentTotal() / getMaxScore()) * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <h4 className="text-[var(--color-text-900)] mb-3">Breakdown</h4>
                {getBreakdown().map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--color-text-900)] text-sm">{item.name}</span>
                      <span className="text-[var(--color-text-600)] text-sm">
                        {item.score.toFixed(1)} / {item.max}
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--color-primary-600)] to-blue-500 transition-all duration-300"
                        style={{ width: `${(item.score / item.max) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <h4 className="text-[var(--color-text-900)] mb-3">Quick Links</h4>
              <div className="space-y-2">
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