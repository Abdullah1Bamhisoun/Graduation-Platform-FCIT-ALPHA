import { useState } from 'react';
import { Layout } from '../../components/Layout';
import { StatusBadge } from '../../components/StatusBadge';
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
import { mockUsers, mockGroupGrades } from '../../lib/mock-data';
import { SubmissionStatus } from '../../lib/types';
import { 
  Save, 
  CheckCircle, 
  Clock, 
  FileText,
  Download,
  Eye,
  ChevronRight,
  Award,
  Users,
  BookOpen,
  BarChart
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

interface AdminGradeData {
  chapter1: number;
  chapter2: number;
  chapter3: number;
  chapter4: number;
  finalReport: number;
  revisedFinalReport: number;
}

interface SupervisorGradeData {
  chapter1: number;
  chapter2: number;
  chapter3: number;
  chapter4: number;
  finalReport: number;
  revisedFinalReport: number;
  collaboration: number;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}

const mockGroups: Group[] = [
  {
    id: '13_498_2026_01_M',
    groupNumber: 13,
    course: 'CPIS-498',
    year: 2026,
    term: '01',
    section: 'M',
    students: [
      { id: '2236500', name: 'Abdullah Bamhisoun', email: 'abdullah.b@stu.kau.edu.sa' },
      { id: '2236501', name: 'Abdulrahman Solymani', email: 'abdulrahman.s@stu.kau.edu.sa' },
    ],
    projectTitle: 'Graduation Project Platform',
  },
  {
    id: '07_498_2026_01_M',
    groupNumber: 7,
    course: 'CPIS-498',
    year: 2026,
    term: '01',
    section: 'M',
    students: [
      { id: '2236789', name: 'Bandar Al-Juhani', email: 'bandar.j@stu.kau.edu.sa' },
      { id: '2236790', name: 'Rayan Al-Malki', email: 'rayan.m@stu.kau.edu.sa' },
    ],
    projectTitle: 'Smart Healthcare System',
  },
];

export function AdminGradesDeliverables() {
  const navigate = useNavigate();
  const user = mockUsers.admin;
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Admin grades (15 marks total)
  const [adminGrades, setAdminGrades] = useState<AdminGradeData>({
    chapter1: 5,
    chapter2: 1,
    chapter3: 0,
    chapter4: 3,
    finalReport: 3,
    revisedFinalReport: 3,
  });

  // Supervisor grades (20 marks total) - Read only for admin
  const [supervisorGrades] = useState<SupervisorGradeData>({
    chapter1: 5,
    chapter2: 2.5,
    chapter3: 0,
    chapter4: 2.5,
    finalReport: 2.5,
    revisedFinalReport: 2.5,
    collaboration: 0, // Part of 20 total
  });

  // Other grades
  const [peerFeedbackGrade] = useState<number>(4); // 5 marks total
  const [committeeGrade] = useState<number>(35); // 40 marks total
  const [weeklyReportGrade] = useState<number>(18); // 20 marks total

  // Audit history
  const [auditHistory] = useState<AuditEntry[]>([
    {
      id: '1',
      timestamp: '2024-11-25T10:30:00',
      actor: 'Admin - Dr. Faisal Ahmed',
      action: 'Updated Admin Grades',
      details: 'Chapter 1 admin grade set to 5/5',
    },
    {
      id: '2',
      timestamp: '2024-11-26T14:15:00',
      actor: 'Supervisor - Dr. Ahmad AlKhatib',
      action: 'Submitted Supervisor Grades',
      details: 'Chapter grading completed: 15.5/20',
    },
    {
      id: '3',
      timestamp: '2024-11-27T09:00:00',
      actor: 'Committee',
      action: 'Committee Evaluation',
      details: 'Final presentation graded: 35/40',
    },
  ]);

  const currentGroup = mockGroups.find(g => g.id === selectedGroup);

  // Calculate totals
  const calculateAdminTotal = () => {
    return Object.values(adminGrades).reduce((sum, grade) => sum + grade, 0);
  };

  const calculateSupervisorTotal = () => {
    return Object.values(supervisorGrades).reduce((sum, grade) => sum + grade, 0);
  };

  const calculateGrandTotal = () => {
    return calculateAdminTotal() + calculateSupervisorTotal() + peerFeedbackGrade + committeeGrade + weeklyReportGrade;
  };

  const handleEditAdmin = () => {
    setEditingSection('admin');
  };

  const handleSaveAdmin = () => {
    setEditingSection(null);
    toast.success('Admin grades saved successfully!');
  };

  const handleExport = (format: 'pdf' | 'csv') => {
    toast.success(`Exporting all grades as ${format.toUpperCase()}...`);
  };

  const handleViewFile = (fileName: string) => {
    toast.success(`Opening ${fileName}...`);
    window.open('#', '_blank');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'graded':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-green-50 text-green-600 border border-green-200">Graded</span>;
      case 'submitted':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">Needs Grading</span>;
      case 'upcoming':
        return <span className="inline-block px-2 py-1 text-xs rounded-full bg-gray-50 text-gray-600 border border-gray-200">Upcoming</span>;
      default:
        return null;
    }
  };

  // Get grade category color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'admin':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      case 'supervisor':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'peer':
        return 'bg-purple-50 border-purple-200 text-purple-900';
      case 'committee':
        return 'bg-orange-50 border-orange-200 text-orange-900';
      case 'weekly':
        return 'bg-indigo-50 border-indigo-200 text-indigo-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  return (
    <Layout user={user} pageTitle="Course Deliverables Grading">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          View and manage all grades for groups (Total: 100 marks)
        </p>

        {/* Group Selection */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
          <div className="max-w-md">
            <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">
              Select Group to View Grades
            </Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger id="group-select">
                <SelectValue placeholder="Choose a group..." />
              </SelectTrigger>
              <SelectContent>
                {mockGroups.map((group) => (
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
        <div className="flex gap-6">
          {/* Main Content Area */}
          <div className="flex-1 max-w-[800px]">
            {/* Header Section */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-[var(--color-text-900)] mb-2">
                    Complete Grading – Group {currentGroup.groupNumber}
                  </h1>
                  <p className="text-[var(--color-text-600)]">{currentGroup.projectTitle}</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-[var(--color-text-600)] mt-2">
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
                </div>
              </div>

              {/* Grade Categories Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--color-border)]">
                <div className={`rounded-lg border p-3 ${getCategoryColor('supervisor')}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span>Chapter Grading</span>
                  </div>
                  <p className="text-xl">{calculateSupervisorTotal()}/20</p>
                  <p className="text-xs opacity-75">Supervisor</p>
                </div>

                <div className={`rounded-lg border p-3 ${getCategoryColor('peer')}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4" />
                    <span>Peer Feedback</span>
                  </div>
                  <p className="text-xl">{peerFeedbackGrade}/5</p>
                  <p className="text-xs opacity-75">Students</p>
                </div>

                <div className={`rounded-lg border p-3 ${getCategoryColor('admin')}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4" />
                    <span>Admin Grading</span>
                  </div>
                  <p className="text-xl">{calculateAdminTotal()}/15</p>
                  <p className="text-xs opacity-75">Deliverables</p>
                </div>

                <div className={`rounded-lg border p-3 ${getCategoryColor('committee')}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4" />
                    <span>Committee</span>
                  </div>
                  <p className="text-xl">{committeeGrade}/40</p>
                  <p className="text-xs opacity-75">Final Evaluation</p>
                </div>

                <div className={`rounded-lg border p-3 ${getCategoryColor('weekly')}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart className="w-4 h-4" />
                    <span>Weekly Reports</span>
                  </div>
                  <p className="text-xl">{weeklyReportGrade}/20</p>
                  <p className="text-xs opacity-75">14 Weeks</p>
                </div>

                <div className="rounded-lg border p-3 bg-gradient-to-br from-blue-50 to-purple-50 border-blue-300">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-900">Grand Total</span>
                  </div>
                  <p className="text-xl text-blue-900">{calculateGrandTotal()}/100</p>
                  <p className="text-xs text-blue-700">{((calculateGrandTotal() / 100) * 100).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Tabs Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="admin-grading">Admin Grading (15)</TabsTrigger>
                <TabsTrigger value="supervisor-grading">Supervisor (20)</TabsTrigger>
                <TabsTrigger value="history">History & Audit</TabsTrigger>
              </TabsList>

              {/* Tab 1: Overview */}
              <TabsContent value="overview">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                  <h3 className="text-[var(--color-text-900)] mb-4">Complete Grade Breakdown</h3>
                  
                  <div className="space-y-4">
                    {/* Chapter Grading by Supervisor */}
                    <div className="p-4 border border-[var(--color-border)] rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-5 h-5 text-green-600" />
                          <h4 className="text-[var(--color-text-900)]">Chapter Grading (Supervisor)</h4>
                        </div>
                        <span className="text-[var(--color-text-900)]">{calculateSupervisorTotal()} / 20</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 1</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.chapter1}/5</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 2</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.chapter2}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 3</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.chapter3}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 4</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.chapter4}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Final Report</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.finalReport}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Revised Final Report</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.revisedFinalReport}/3</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-[var(--color-text-600)]">Collaboration</span>
                          <span className="text-[var(--color-text-900)]">{supervisorGrades.collaboration} (Part of 20)</span>
                        </div>
                      </div>
                    </div>

                    {/* Peer Feedback */}
                    <div className="p-4 border border-[var(--color-border)] rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-5 h-5 text-purple-600" />
                          <h4 className="text-[var(--color-text-900)]">Peer Feedback</h4>
                        </div>
                        <span className="text-[var(--color-text-900)]">{peerFeedbackGrade} / 5</span>
                      </div>
                      <p className="text-[var(--color-text-600)] text-sm mt-2">Student peer evaluations</p>
                    </div>

                    {/* Admin Grading */}
                    <div className="p-4 border border-[var(--color-border)] rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <h4 className="text-[var(--color-text-900)]">Admin Grading (Deliverables)</h4>
                        </div>
                        <span className="text-[var(--color-text-900)]">{calculateAdminTotal()} / 15</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 1</span>
                          <span className="text-[var(--color-text-900)]">{adminGrades.chapter1}/5</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 2</span>
                          <span className="text-[var(--color-text-900)]">{adminGrades.chapter2}/1</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 3</span>
                          <span className="text-[var(--color-text-900)]">{adminGrades.chapter3}/0</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Chapter 4</span>
                          <span className="text-[var(--color-text-900)]">{adminGrades.chapter4}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Final Report</span>
                          <span className="text-[var(--color-text-900)]">{adminGrades.finalReport}/3</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--color-text-600)]">Revised Final Report</span>
                          <span className="text-[var(--color-text-900)]">{adminGrades.revisedFinalReport}/3</span>
                        </div>
                      </div>
                    </div>

                    {/* Committee Evaluation */}
                    <div className="p-4 border border-[var(--color-border)] rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-orange-600" />
                          <h4 className="text-[var(--color-text-900)]">Committee Evaluation</h4>
                        </div>
                        <span className="text-[var(--color-text-900)]">{committeeGrade} / 40</span>
                      </div>
                      <p className="text-[var(--color-text-600)] text-sm mt-2">Final presentation and defense</p>
                    </div>

                    {/* Weekly Reports */}
                    <div className="p-4 border border-[var(--color-border)] rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart className="w-5 h-5 text-indigo-600" />
                          <h4 className="text-[var(--color-text-900)]">Weekly Reports</h4>
                        </div>
                        <span className="text-[var(--color-text-900)]">{weeklyReportGrade} / 20</span>
                      </div>
                      <p className="text-[var(--color-text-600)] text-sm mt-2">14 weeks of progress tracking</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 2: Admin Grading */}
              <TabsContent value="admin-grading">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                    <div>
                      <h3 className="text-[var(--color-text-900)]">Admin Deliverables Grading</h3>
                      <p className="text-[var(--color-text-600)] text-sm mt-1">Total: 15 marks</p>
                    </div>
                    {editingSection !== 'admin' ? (
                      <Button 
                        onClick={handleEditAdmin}
                        className="bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]"
                      >
                        Edit Grades
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setEditingSection(null)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveAdmin} className="bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]">
                          <Save className="w-4 h-4 mr-2" />
                          Save Grades
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--color-surface-alt)]">
                        <tr>
                          <th className="p-4 text-left text-[var(--color-text-900)]">Deliverable</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Status</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">File</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Max Score</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Admin Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 1 (Project Outlines)</td>
                          <td className="p-4 text-center">{getStatusBadge('graded')}</td>
                          <td className="p-4 text-center">
                            <Button size="sm" variant="outline" onClick={() => handleViewFile('Chapter1.pdf')}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">5</td>
                          <td className="p-4 text-center">
                            {editingSection === 'admin' ? (
                              <Input
                                type="number"
                                min="0"
                                max="5"
                                step="0.5"
                                value={adminGrades.chapter1}
                                onChange={(e) => setAdminGrades({ ...adminGrades, chapter1: parseFloat(e.target.value) || 0 })}
                                className="w-20 mx-auto"
                              />
                            ) : (
                              <span className="text-[var(--color-text-900)]">{adminGrades.chapter1}</span>
                            )}
                          </td>
                        </tr>

                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 2 (Literature review)</td>
                          <td className="p-4 text-center">{getStatusBadge('graded')}</td>
                          <td className="p-4 text-center">
                            <Button size="sm" variant="outline" onClick={() => handleViewFile('Chapter2.pdf')}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">1</td>
                          <td className="p-4 text-center">
                            {editingSection === 'admin' ? (
                              <Input
                                type="number"
                                min="0"
                                max="1"
                                step="0.5"
                                value={adminGrades.chapter2}
                                onChange={(e) => setAdminGrades({ ...adminGrades, chapter2: parseFloat(e.target.value) || 0 })}
                                className="w-20 mx-auto"
                              />
                            ) : (
                              <span className="text-[var(--color-text-900)]">{adminGrades.chapter2}</span>
                            )}
                          </td>
                        </tr>

                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 3 (Analysis)</td>
                          <td className="p-4 text-center">{getStatusBadge('submitted')}</td>
                          <td className="p-4 text-center">
                            <Button size="sm" variant="outline" onClick={() => handleViewFile('Chapter3.pdf')}>
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">0</td>
                          <td className="p-4 text-center">
                            {editingSection === 'admin' ? (
                              <Input
                                type="number"
                                min="0"
                                max="0"
                                step="0.5"
                                value={adminGrades.chapter3}
                                onChange={(e) => setAdminGrades({ ...adminGrades, chapter3: parseFloat(e.target.value) || 0 })}
                                className="w-20 mx-auto"
                              />
                            ) : (
                              <span className="text-[var(--color-text-900)]">{adminGrades.chapter3}</span>
                            )}
                          </td>
                        </tr>

                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 4 (System design)</td>
                          <td className="p-4 text-center">{getStatusBadge('upcoming')}</td>
                          <td className="p-4 text-center">
                            <span className="text-[var(--color-text-400)]">-</span>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center">
                            {editingSection === 'admin' ? (
                              <Input
                                type="number"
                                min="0"
                                max="3"
                                step="0.5"
                                value={adminGrades.chapter4}
                                onChange={(e) => setAdminGrades({ ...adminGrades, chapter4: parseFloat(e.target.value) || 0 })}
                                className="w-20 mx-auto"
                              />
                            ) : (
                              <span className="text-[var(--color-text-900)]">{adminGrades.chapter4}</span>
                            )}
                          </td>
                        </tr>

                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Final report</td>
                          <td className="p-4 text-center">{getStatusBadge('upcoming')}</td>
                          <td className="p-4 text-center">
                            <span className="text-[var(--color-text-400)]">-</span>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center">
                            {editingSection === 'admin' ? (
                              <Input
                                type="number"
                                min="0"
                                max="3"
                                step="0.5"
                                value={adminGrades.finalReport}
                                onChange={(e) => setAdminGrades({ ...adminGrades, finalReport: parseFloat(e.target.value) || 0 })}
                                className="w-20 mx-auto"
                              />
                            ) : (
                              <span className="text-[var(--color-text-900)]">{adminGrades.finalReport}</span>
                            )}
                          </td>
                        </tr>

                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Revised_final_report</td>
                          <td className="p-4 text-center">{getStatusBadge('upcoming')}</td>
                          <td className="p-4 text-center">
                            <span className="text-[var(--color-text-400)]">-</span>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center">
                            {editingSection === 'admin' ? (
                              <Input
                                type="number"
                                min="0"
                                max="3"
                                step="0.5"
                                value={adminGrades.revisedFinalReport}
                                onChange={(e) => setAdminGrades({ ...adminGrades, revisedFinalReport: parseFloat(e.target.value) || 0 })}
                                className="w-20 mx-auto"
                              />
                            ) : (
                              <span className="text-[var(--color-text-900)]">{adminGrades.revisedFinalReport}</span>
                            )}
                          </td>
                        </tr>

                        <tr className="bg-[var(--color-primary-100)]">
                          <td className="p-4 text-[var(--color-text-900)]" colSpan={3}>
                            <strong>Total Admin Grade</strong>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">15</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">
                            <strong>{calculateAdminTotal()}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 3: Supervisor Grading (Read-only) */}
              <TabsContent value="supervisor-grading">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                  <div className="mb-4">
                    <h3 className="text-[var(--color-text-900)] mb-2">Supervisor Chapter Grading (Read-Only)</h3>
                    <p className="text-[var(--color-text-600)]">
                      These grades are submitted by the supervisor. Total: 20 marks.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--color-surface-alt)]">
                        <tr>
                          <th className="p-4 text-left text-[var(--color-text-900)]">Chapter</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Max Score</th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">Supervisor Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 1 (Project Outlines)</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">5</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.chapter1}</td>
                        </tr>
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 2 (Literature review)</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.chapter2}</td>
                        </tr>
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 3 (Analysis)</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.chapter3}</td>
                        </tr>
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Chapter 4 (System design)</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.chapter4}</td>
                        </tr>
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Final report</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.finalReport}</td>
                        </tr>
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Revised_final_report</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">3</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.revisedFinalReport}</td>
                        </tr>
                        <tr className="hover:bg-[var(--color-surface-alt)]">
                          <td className="p-4 text-[var(--color-text-900)]">Collaboration</td>
                          <td className="p-4 text-center text-[var(--color-text-600)]">Part of 20</td>
                          <td className="p-4 text-center text-green-600">{supervisorGrades.collaboration}</td>
                        </tr>
                        <tr className="bg-[var(--color-primary-100)]">
                          <td className="p-4 text-[var(--color-text-900)]">
                            <strong>Total Supervisor Grade</strong>
                          </td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">20</td>
                          <td className="p-4 text-center text-[var(--color-text-900)]">
                            <strong>{calculateSupervisorTotal()}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              {/* Tab 4: History & Audit */}
              <TabsContent value="history">
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                  <h3 className="text-[var(--color-text-900)] mb-4">Grading History & Audit Trail</h3>
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
          </div>

          {/* Right Sidebar - Summary (Sticky) */}
          <div className="w-[320px] flex-shrink-0">
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

                {/* Grand Total */}
                <div className="text-center mb-6 p-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                  <p className="text-[var(--color-text-600)] mb-2">Grand Total</p>
                  <p className="text-5xl text-[var(--color-text-900)] mb-2">
                    {calculateGrandTotal()}
                  </p>
                  <p className="text-[var(--color-text-600)]">out of 100</p>
                  <div className="mt-3 pt-3 border-t border-blue-200">
                    <p className="text-2xl text-[var(--color-primary-600)]">
                      {((calculateGrandTotal() / 100) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-[var(--color-text-900)] mb-3">Grade Breakdown</h4>
                  
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--color-text-900)] text-sm">Chapter Grading</span>
                      <span className="text-[var(--color-text-600)] text-sm">
                        {calculateSupervisorTotal()} / 20
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all duration-300"
                        style={{ width: `${(calculateSupervisorTotal() / 20) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--color-text-900)] text-sm">Peer Feedback</span>
                      <span className="text-[var(--color-text-600)] text-sm">
                        {peerFeedbackGrade} / 5
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-500 transition-all duration-300"
                        style={{ width: `${(peerFeedbackGrade / 5) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--color-text-900)] text-sm">Admin Grading</span>
                      <span className="text-[var(--color-text-600)] text-sm">
                        {calculateAdminTotal()} / 15
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-300"
                        style={{ width: `${(calculateAdminTotal() / 15) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--color-text-900)] text-sm">Committee</span>
                      <span className="text-[var(--color-text-600)] text-sm">
                        {committeeGrade} / 40
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-600 to-orange-500 transition-all duration-300"
                        style={{ width: `${(committeeGrade / 40) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[var(--color-text-900)] text-sm">Weekly Reports</span>
                      <span className="text-[var(--color-text-600)] text-sm">
                        {weeklyReportGrade} / 20
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 transition-all duration-300"
                        style={{ width: `${(weeklyReportGrade / 20) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h4 className="text-[var(--color-text-900)] mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => navigate('/admin/committee')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] transition-colors"
                  >
                    View Committee Evaluation
                  </button>
                  <button
                    onClick={() => navigate('/admin/weekly-reports')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] transition-colors"
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
            Please select a group to view complete grading information
          </p>
        </div>
      )}
    </Layout>
  );
}
