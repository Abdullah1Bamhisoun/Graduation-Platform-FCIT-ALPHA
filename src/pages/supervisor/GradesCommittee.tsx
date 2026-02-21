import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForSupervisor } from '../../services/groups';
import {
  Search,
  FileText,
  Calendar,
  Clock,
  Plus,
  Info,
  Save,
  Send,
  XCircle,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignedGroup {
  id: string;
  projectName: string;
  groupId: string;
  course: 'CPIS-498' | 'CPIS-499';
  milestone: 'Presentation' | 'Poster';
  date?: string;
  room?: string;
  status: 'not-scheduled' | 'scheduled' | 'completed';
}

interface AvailabilityBlock {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
}

interface AssignedSession {
  date: string;
  time: string;
  room: string;
  projectName: string;
}

interface CommitteeCriterion {
  id: string;
  name: string;
  maxScore: 5;
  score: number | null;
}


const timeSlots = [
  '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM',
  '2:00 PM', '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM',
];

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];


export function SupervisorGradesCommittee() {
  const { user } = useAuth();

  const [mainTab, setMainTab] = useState<'groups' | 'availability'>('groups');
  const [isGrading, setIsGrading] = useState(false);
  const [selectedGroupForGrading, setSelectedGroupForGrading] = useState<AssignedGroup | null>(null);
  const [assignedGroups, setAssignedGroups] = useState<AssignedGroup[]>([]);

  useEffect(() => {
    if (!user) return;
    getGroupsForSupervisor(user.id).then((data) => {
      setAssignedGroups(data.map((g) => ({
        id: g.id,
        projectName: g.projectName,
        groupId: g.groupCode,
        course: g.courseCode.includes('499') ? 'CPIS-499' : 'CPIS-498',
        milestone: 'Presentation' as const,
        status: 'not-scheduled' as const,
      })));
    });
  }, [user?.id]);

  // Tab 1: Groups to Evaluate
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['498', '499']);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['not-scheduled', 'scheduled', 'completed']);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Tab 2: Select Available Slot
  const [selectedTerm, setSelectedTerm] = useState('2025/26 – Term 1');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<'498' | '499' | 'both'>('both');
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([]);
  const [assignedSessions] = useState<AssignedSession[]>([]);
  const [allowBackToBack, setAllowBackToBack] = useState(false);
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [editingSlot, setEditingSlot] = useState<AvailabilityBlock | null>(null);
  const [slotForm, setSlotForm] = useState({ day: '', startTime: '', endTime: '' });

  // Grading States
  const [gradingStatus, setGradingStatus] = useState<'draft' | 'submitted'>('draft');
  const [isIP, setIsIP] = useState(false);
  const [ipReason, setIpReason] = useState('');
  const [showIPModal, setShowIPModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Committee criteria (CPIS-498 - 40 marks total)
  const [committeeCriteria, setCommitteeCriteria] = useState<CommitteeCriterion[]>([
    { id: 'problemDef', name: 'Problem Definition and Aims', maxScore: 5, score: null },
    { id: 'litReview', name: 'Literature Review', maxScore: 5, score: null },
    { id: 'methodology', name: 'Methodology', maxScore: 5, score: null },
    { id: 'requirements', name: 'Requirements and Analysis', maxScore: 5, score: null },
    { id: 'design', name: 'Initial Solution/Design', maxScore: 5, score: null },
    { id: 'implementation', name: 'Implementation', maxScore: 5, score: null },
    { id: 'reportStyle', name: 'Report Style & Format', maxScore: 5, score: null },
    { id: 'presentation', name: 'Presentation Skills/Responses to Questions', maxScore: 5, score: null },
  ]);
  const [committeeComments, setCommitteeComments] = useState('');

  // Filter groups
  const filteredGroups = assignedGroups.filter(group => {
    const matchesSearch = group.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         group.groupId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourses.includes(group.course === 'CPIS-498' ? '498' : '499');
    const matchesStatus = selectedStatuses.includes(group.status);
    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const paginatedGroups = filteredGroups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle course chip toggle
  const toggleCourse = (course: string) => {
    setSelectedCourses(prev =>
      prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
    );
  };

  // Handle status chip toggle
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  // Handle evaluate - open grading view
  const handleEvaluate = (groupId: string) => {
    const group = assignedGroups.find(g => g.groupId === groupId);
    if (group) {
      setSelectedGroupForGrading(group);
      setIsGrading(true);
    }
  };

  // Handle back from grading
  const handleBackFromGrading = () => {
    setIsGrading(false);
    setSelectedGroupForGrading(null);
  };

  // Calculate committee total
  const calculateCommitteeTotal = () => {
    return committeeCriteria.reduce((sum, criterion) => sum + (criterion.score || 0), 0);
  };

  // Check unfilled
  const hasUnfilledCommittee = () => {
    return committeeCriteria.some(c => c.score === null);
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
    if (hasUnfilledCommittee()) {
      toast.error('Please score all criteria before submitting');
      return;
    }
    setShowSubmitModal(true);
  };

  const confirmSubmitGrades = () => {
    setGradingStatus('submitted');
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

  // Handle slot creation
  const handleCreateSlot = (day: string, time: string) => {
    setSlotForm({ day, startTime: time, endTime: '' });
    setEditingSlot(null);
    setShowSlotDialog(true);
  };

  // Handle slot edit
  const handleEditSlot = (slot: AvailabilityBlock) => {
    setEditingSlot(slot);
    setSlotForm({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime });
    setShowSlotDialog(true);
  };

  // Handle save slot
  const handleSaveSlot = () => {
    if (!slotForm.day || !slotForm.startTime || !slotForm.endTime) {
      toast.error('Please fill all fields');
      return;
    }

    if (editingSlot) {
      setAvailabilityBlocks(prev =>
        prev.map(block => block.id === editingSlot.id
          ? { ...block, ...slotForm }
          : block
        )
      );
      toast.success('Slot updated');
    } else {
      const newSlot: AvailabilityBlock = {
        id: Date.now().toString(),
        ...slotForm,
      };
      setAvailabilityBlocks(prev => [...prev, newSlot]);
      toast.success('Slot created');
    }
    setShowSlotDialog(false);
    setSlotForm({ day: '', startTime: '', endTime: '' });
  };

  // Handle delete slot
  const handleDeleteSlot = () => {
    if (editingSlot) {
      setAvailabilityBlocks(prev => prev.filter(block => block.id !== editingSlot.id));
      toast.success('Slot deleted');
      setShowSlotDialog(false);
    }
  };

  // Handle save availability
  const handleSaveAvailability = () => {
    toast.success('Availability saved successfully');
  };

  // Calculate slot counts per day
  const getSlotCountForDay = (day: string) => {
    return availabilityBlocks.filter(block => block.day === day).length;
  };

  if (!user) return null;

  // If in grading mode, show grading interface
  if (isGrading && selectedGroupForGrading) {
    return (
      <Layout user={user} pageTitle="Evaluate & Grade">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={handleBackFromGrading}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>

          {/* Header */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-[var(--color-text-900)]">
                    {selectedGroupForGrading.projectName}
                  </h1>
                  <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                    {selectedGroupForGrading.course === 'CPIS-498' ? '498' : '499'}
                  </span>
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    gradingStatus === 'submitted' 
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {gradingStatus === 'submitted' ? 'Submitted' : 'Draft'}
                  </span>
                  {isIP && (
                    <span className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-700 border border-red-200">
                      IP - Not Ready
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-600)]">{selectedGroupForGrading.groupId}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleSaveDraft}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </Button>
                <Button
                  onClick={handleSubmitGrades}
                  className="bg-green-600 hover:bg-green-700 text-[rgb(0,0,0)]"
                  disabled={gradingStatus === 'submitted' || isIP}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Submit Grades
                </Button>
                <Button
                  variant="outline"
                  onClick={handleMarkIP}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  disabled={isIP}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark IP
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Committee Evaluation */}
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
                            disabled={isIP || gradingStatus === 'submitted'}
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
              disabled={isIP || gradingStatus === 'submitted'}
            />
          </div>
        </div>

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
              <Button onClick={confirmMarkIP} className="bg-red-600 hover:bg-red-700 text-[rgb(0,0,0)]">
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
                <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-900"><strong>Committee Total:</strong></span>
                  <span className="text-blue-900"><strong>{calculateCommitteeTotal()} / 40</strong></span>
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
              <Button onClick={confirmSubmitGrades} className="bg-green-600 hover:bg-green-700 text-[rgb(0,0,0)]">
                <Send className="w-4 h-4 mr-2" />
                Submit Grades
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  // Main Committee Evaluation View (Groups & Availability)
  return (
    <Layout user={user} pageTitle="Committee Evaluation">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Manage your committee assignments and availability
        </p>
      </div>

      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)}>
        <TabsList className="mb-6 border-b w-full justify-start rounded-none bg-transparent p-0">
          <TabsTrigger
            value="groups"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent pb-3"
          >
            Groups to Evaluate
          </TabsTrigger>
          <TabsTrigger
            value="availability"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent pb-3"
          >
            Select Available Slot
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Groups to Evaluate */}
        <TabsContent value="groups" className="mt-0">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
            {/* Filter Bar */}
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-400)]" />
                  <input
                    type="text"
                    placeholder="Search groups or projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Course Filters */}
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-[var(--color-text-600)]">Course:</span>
                    <button
                      onClick={() => toggleCourse('498')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedCourses.includes('498')
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      498
                    </button>
                    <button
                      onClick={() => toggleCourse('499')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedCourses.includes('499')
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      499
                    </button>
                  </div>

                  {/* Status Filters */}
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-[var(--color-text-600)]">Status:</span>
                    <button
                      onClick={() => toggleStatus('not-scheduled')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedStatuses.includes('not-scheduled')
                          ? 'bg-gray-100 text-gray-700 border-gray-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      Not scheduled
                    </button>
                    <button
                      onClick={() => toggleStatus('scheduled')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedStatuses.includes('scheduled')
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      Scheduled
                    </button>
                    <button
                      onClick={() => toggleStatus('completed')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedStatuses.includes('completed')
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      Completed
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Table */}
            {filteredGroups.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
                <p className="text-[var(--color-text-600)]">No groups assigned yet.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-[var(--color-border)] bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Project Name</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Course</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Milestone</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Date & Room</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Status</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedGroups.map((group) => (
                        <tr
                          key={group.id}
                          className="border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div>
                              <p className="text-[var(--color-text-900)]">{group.projectName}</p>
                              <p className="text-sm text-[var(--color-text-600)]">{group.groupId}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 text-sm rounded-full ${
                              group.course === 'CPIS-498'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-purple-100 text-purple-700 border border-purple-200'
                            }`}>
                              {group.course === 'CPIS-498' ? '498' : '499'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[var(--color-text-900)]">
                            {group.milestone}
                          </td>
                          <td className="py-4 px-6">
                            {group.date && group.room ? (
                              <div>
                                <p className="text-[var(--color-text-900)]">{group.date}</p>
                                <p className="text-sm text-[var(--color-text-600)]">{group.room}</p>
                              </div>
                            ) : (
                              <span className="text-[var(--color-text-400)]">—</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 text-sm rounded-full ${
                              group.status === 'completed'
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : group.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {group.status === 'not-scheduled' ? 'Not scheduled' :
                               group.status === 'scheduled' ? 'Scheduled' : 'Completed'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <Button
                              onClick={() => handleEvaluate(group.groupId)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-[rgb(0,0,0)]"
                            >
                              Evaluate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-600)]">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredGroups.length)} of {filteredGroups.length} groups
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={currentPage === page ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Select Available Slot */}
        <TabsContent value="availability" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                {/* Controls */}
                <div className="mb-6 flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block text-[var(--color-text-900)]">Term</Label>
                    <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2025/26 – Term 1">2025/26 – Term 1</SelectItem>
                        <SelectItem value="2025/26 – Term 2">2025/26 – Term 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 min-w-[200px]">
                    <Label className="mb-2 block text-[var(--color-text-900)]">Course</Label>
                    <Select value={selectedCourseFilter} onValueChange={(v) => setSelectedCourseFilter(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="both">Both (498 & 499)</SelectItem>
                        <SelectItem value="498">CPIS-498</SelectItem>
                        <SelectItem value="499">CPIS-499</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Hint */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2 text-sm text-blue-900">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Click on any time slot to create an availability block. Max 3 sessions per day.</span>
                </div>

                {/* Week Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="grid grid-cols-6 gap-2 mb-2">
                      <div className="text-sm text-[var(--color-text-600)] py-2">Time</div>
                      {weekDays.map(day => (
                        <div key={day} className="text-sm text-[var(--color-text-900)] py-2 text-center">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Time Slots */}
                    {timeSlots.map((time) => (
                      <div key={time} className="grid grid-cols-6 gap-2 mb-1">
                        <div className="text-sm text-[var(--color-text-600)] py-3 flex items-center">
                          {time}
                        </div>
                        {weekDays.map(day => {
                          const existingBlock = availabilityBlocks.find(
                            block => block.day === day && block.startTime === time
                          );
                          
                          return (
                            <div key={day} className="relative">
                              {existingBlock ? (
                                <button
                                  onClick={() => handleEditSlot(existingBlock)}
                                  className="w-full py-3 bg-green-100 border-2 border-green-500 rounded-lg hover:bg-green-200 transition-colors text-sm text-green-900"
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span className="text-xs">{existingBlock.endTime}</span>
                                  </div>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleCreateSlot(day, time)}
                                  className="w-full py-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                                  disabled={getSlotCountForDay(day) >= 3}
                                >
                                  {getSlotCountForDay(day) >= 3 ? (
                                    <span className="text-xs text-gray-400">Full</span>
                                  ) : (
                                    <Plus className="w-4 h-4 mx-auto text-gray-400" />
                                  )}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Rail */}
            <div className="lg:col-span-1 space-y-6">
              {/* Offered Slots Summary */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h3 className="text-[var(--color-text-900)] mb-4">Offered Slots Summary</h3>
                <div className="space-y-3">
                  {weekDays.map(day => (
                    <div key={day} className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-600)]">{day.slice(0, 3)}</span>
                      <span className="text-sm text-[var(--color-text-900)] px-2 py-1 bg-blue-50 rounded">
                        {getSlotCountForDay(day)} slots
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowBackToBack}
                      onChange={(e) => setAllowBackToBack(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-[var(--color-text-900)]">Allow back-to-back sessions</span>
                  </label>
                </div>
              </div>

              {/* Assigned Sessions */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h3 className="text-[var(--color-text-900)] mb-4">Assigned Sessions</h3>
                {assignedSessions.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-600)]">No sessions assigned yet</p>
                ) : (
                  <div className="space-y-3">
                    {assignedSessions.map((session, idx) => (
                      <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-2 mb-1">
                          <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-blue-900">{session.date}</p>
                            <p className="text-xs text-blue-700">{session.time} • {session.room}</p>
                            <p className="text-xs text-blue-600 mt-1 truncate">{session.projectName}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Save Button */}
          <div className="fixed bottom-6 right-6">
            <Button
              onClick={handleSaveAvailability}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
            >
              Save Availability
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Slot Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingSlot ? 'Edit' : 'Create'} Availability Block</DialogTitle>
            <DialogDescription>
              Set your available time slot for committee evaluations
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label className="mb-2 block">Day</Label>
              <Select value={slotForm.day} onValueChange={(v) => setSlotForm(prev => ({ ...prev, day: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {weekDays.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">Start Time</Label>
              <Select value={slotForm.startTime} onValueChange={(v) => setSlotForm(prev => ({ ...prev, startTime: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="mb-2 block">End Time</Label>
              <Select value={slotForm.endTime} onValueChange={(v) => setSlotForm(prev => ({ ...prev, endTime: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select end time" />
                </SelectTrigger>
                <SelectContent>
                  {timeSlots.map(time => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            {editingSlot && (
              <Button variant="outline" onClick={handleDeleteSlot} className="mr-auto text-red-600 border-red-300 hover:bg-red-50">
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowSlotDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSlot} className="bg-blue-600 hover:bg-blue-700 text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}