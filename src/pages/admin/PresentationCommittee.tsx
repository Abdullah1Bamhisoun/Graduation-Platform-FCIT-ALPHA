import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { getProfilesByRole } from '../../services/profiles';
import { getAllGroups } from '../../services/groups';
import { getAuditLog } from '../../services/audit';
import {
  assignPresentationSchedule,
  computeScheduledAt,
  dateToIsoWeek,
  getPresentationsByCourse,
  getServerTime,
} from '../../services/presentations';
import type { AuditLogEntry } from '../../types';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import {
  Calendar,
  Users,
  MapPin,
  Plus,
  Download,
  Send,
  RotateCcw,
  Sparkles,
  Trash2,
  GripVertical,
  AlertCircle,
  CheckCircle,
  Search,
  Filter,
  Undo2,
  Redo2,
} from 'lucide-react';
import { toast } from 'sonner';

interface TimeSlot {
  id: string;
  day: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu';
  startTime: string;
  endTime: string;
  room: string;
  supervisor: string;
  supervisor2?: string;
  status: 'empty' | 'offered' | 'assigned';
  projectName?: string;
  projectId?: string;
  course?: '498' | '499';
  conflicts?: string[];
}

interface Project {
  id: string;
  name: string;
  groupId: string;
  course: '498' | '499';
  preferredDay?: string;
  status: 'unassigned' | 'assigned';
  supervisor?: string;
  students?: { id: string; name: string }[];
}

interface SupervisorAvailability {
  id: string;
  name: string;
  sun: number;
  mon: number;
  tue: number;
  wed: number;
  thu: number;
  total: number;
  status: 'ready' | 'none';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const;
const TIME_SLOTS = [
  { start: '09:00 am', end: '09:25 am' },
  { start: '09:30 am', end: '09:55 am' },
  { start: '10:00 am', end: '10:25 am' },
  { start: '10:30 am', end: '10:55 am' },
  { start: '11:00 am', end: '11:25 am' },
  { start: '11:30 am', end: '11:55 am' },
  { start: '12:00 pm', end: '12:25 pm' },
  { start: '12:30 pm', end: '01:00 pm' },
];


export function AdminPresentationCommittee() {
  const { user } = useAuth();

  // State
  const [term, setTerm] = useState('2026-01');
  // Coordinators are locked to their assigned course; admins choose explicitly.
  const [course, setCourse] = useState<'498' | '499' | null>(null);
  const [weekStart, setWeekStart] = useState(() => new Date().toISOString().slice(0, 10));

  // Planning inputs (will be populated from DB)
  const [numStudents498, setNumStudents498] = useState(0);
  const [numStudents499, setNumStudents499] = useState(0);
  const [numSupervisors, setNumSupervisors] = useState(0);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState(4);
  const [sessionDuration, setSessionDuration] = useState(30);
  const [bufferDuration, setBufferDuration] = useState(10);

  // Constraints
  const [limitSessionsPerDay, setLimitSessionsPerDay] = useState(true);
  const [avoidSameCommittee, setAvoidSameCommittee] = useState(true);
  const [spreadEvenly, setSpreadEvenly] = useState(true);

  // Schedule slots (start empty)
  const [slots, setSlots] = useState<TimeSlot[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorAvailability[]>([]);
  const [changesLog, setChangesLog] = useState<AuditLogEntry[]>([]);

  const isCoordinator = user?.activeRole === 'coordinator';

  useEffect(() => {
    if (!user) return;

    async function init() {
      const [sups, groups, auditEntries] = await Promise.all([
        getProfilesByRole('supervisor'),
        // Pass activeRole so the backend applies coordinator course-scoping
        getAllGroups(user!.activeRole),
        getAuditLog(),
      ]);

      setSupervisors(sups.map(s => ({
        id: s.id,
        name: s.name,
        sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, total: 0,
        status: 'none' as const,
      })));
      // courseCode may be empty when groups come from the backend API (no course join).
      // Use courseNumber (e.g. '499') as the reliable fallback.
      const isCourse499 = (g: (typeof groups)[number]) =>
        g.courseCode.includes('499') || (g.courseNumber ?? '').includes('499');

      const mappedProjects = groups.map(g => ({
        id: g.id,
        name: g.projectName,
        groupId: g.groupCode,
        course: (isCourse499(g) ? '499' : '498') as '498' | '499',
        status: 'unassigned' as const,
        supervisor: g.supervisorName || undefined,
        students: g.members.map(m => ({ id: m.id, name: m.name })),
      }));
      setChangesLog(auditEntries.slice(0, 20));
      const count498 = groups.filter(g => !isCourse499(g)).length;
      const count499 = groups.filter(g => isCourse499(g)).length;
      setNumStudents498(count498);
      setNumStudents499(count499);
      setNumSupervisors(sups.length);

      // For coordinators: auto-detect their course from loaded groups
      if (isCoordinator && mappedProjects.length > 0) {
        setCourse(mappedProjects[0].course);
      }

      // Load saved schedules from DB and hydrate the slot board
      const courseIds = [...new Set(groups.map(g => g.courseId).filter(Boolean))];
      const allSaved = (
        await Promise.all(courseIds.map(id => getPresentationsByCourse(id)))
      ).flat().filter(s => s.day && s.timeSlot);

      if (allSaved.length > 0) {
        // Set week picker to the week the saved schedules belong to
        const firstWithDate = allSaved.find(s => s.scheduledAt);
        if (firstWithDate?.scheduledAt) {
          setWeekStart(dateToIsoWeek(new Date(firstWithDate.scheduledAt)));
        }

        // Reconstruct TimeSlot[] from saved data
        const reconstructed: TimeSlot[] = allSaved.map((s, i) => {
          const timeInfo = TIME_SLOTS.find(t => t.start === s.timeSlot);
          const project = mappedProjects.find(p => p.id === s.groupId);
          return {
            id: `slot-${Date.now()}-${i}`,
            day: s.day as TimeSlot['day'],
            startTime: s.timeSlot!,
            endTime: timeInfo?.end ?? '',
            room: '',
            supervisor: s.committeeMembers[0] ?? '',
            supervisor2: s.committeeMembers[1],
            status: 'assigned' as const,
            projectName: s.projectName,
            projectId: s.groupId,
            course: project?.course,
          };
        });
        setSlots(reconstructed);

        // Mark projects as assigned
        const assignedIds = new Set(allSaved.map(s => s.groupId));
        setProjects(mappedProjects.map(p => ({
          ...p,
          status: assignedIds.has(p.id) ? 'assigned' as const : 'unassigned' as const,
        })));
      } else {
        setProjects(mappedProjects);
      }
    }

    init();
  }, [user?.activeRole, isCoordinator]);

  // UI State
  const [showSlotDialog, setShowSlotDialog] = useState(false);
  const [showAutoAssignDialog, setShowAutoAssignDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [editingSlot, setEditingSlot] = useState<Partial<TimeSlot>>({});
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState('schedule');
  const [searchSupervisor, setSearchSupervisor] = useState('');
  const [filterDay, setFilterDay] = useState<string>('all');

  // History for undo/redo
  const [history, setHistory] = useState<TimeSlot[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  if (!user) return null;

  // Calculations
  const requiredSlots498 = numStudents498;
  const requiredSlots499 = numStudents499;
  const totalRequired = requiredSlots498 + requiredSlots499;
  const availableSlots = supervisors.reduce((sum, s) => sum + s.total, 0);
  const coverage = totalRequired > 0 ? (availableSlots / totalRequired) * 100 : 0;
  
  const getCoverageColor = () => {
    if (coverage < 90) return 'bg-red-500';
    if (coverage < 100) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // Add to history
  const addToHistory = (newSlots: TimeSlot[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newSlots);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo/Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setSlots(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setSlots(history[historyIndex + 1]);
    }
  };

  // Create new slot
  const handleCreateSlot = (day: typeof DAYS[number], time: string) => {
    const endTime = calculateEndTime(time, sessionDuration);
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}`,
      day,
      startTime: time,
      endTime,
      room: '',
      supervisor: '',
      status: 'empty',
    };
    setEditingSlot(newSlot);
    setSelectedSlot(null);
    setShowSlotDialog(true);
  };

  // Edit slot
  const handleEditSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setEditingSlot({ ...slot });
    setShowSlotDialog(true);
  };

  // Save slot
  const handleSaveSlot = () => {
    if (selectedSlot) {
      // Update existing
      const newSlots = slots.map(s => s.id === selectedSlot.id ? { ...selectedSlot, ...editingSlot } as TimeSlot : s);
      setSlots(newSlots);
      addToHistory(newSlots);
      toast.success('Slot updated');
    } else {
      // Create new
      const newSlots = [...slots, editingSlot as TimeSlot];
      setSlots(newSlots);
      addToHistory(newSlots);
      toast.success('Slot created');
    }
    setShowSlotDialog(false);
    setEditingSlot({});
  };

  // Delete slot
  const handleDeleteSlot = (slotId: string) => {
    const newSlots = slots.filter(s => s.id !== slotId);
    setSlots(newSlots);
    addToHistory(newSlots);
    setShowSlotDialog(false);
    toast.success('Slot deleted');
  };

  // Assign project to slot
  const handleAssignProject = (slotId: string, project: Project) => {
    const newSlots = slots.map(s => 
      s.id === slotId 
        ? { ...s, status: 'assigned' as const, projectName: project.name, projectId: project.id, course: project.course }
        : s
    );
    const newProjects = projects.map(p => 
      p.id === project.id ? { ...p, status: 'assigned' as const } : p
    );
    setSlots(newSlots);
    setProjects(newProjects);
    addToHistory(newSlots);
    toast.success(`${project.name} assigned`);
  };

  // Unassign project
  const handleUnassignProject = (slotId: string) => {
    const slot = slots.find(s => s.id === slotId);
    if (slot?.projectId) {
      const newProjects = projects.map(p => 
        p.id === slot.projectId ? { ...p, status: 'unassigned' as const } : p
      );
      setProjects(newProjects);
    }
    const newSlots = slots.map(s => 
      s.id === slotId 
        ? { ...s, status: 'offered' as const, projectName: undefined, projectId: undefined, course: undefined }
        : s
    );
    setSlots(newSlots);
    addToHistory(newSlots);
    toast.success('Project unassigned');
  };

  // Auto-assign
  const handleAutoAssign = () => {
    toast.success('Auto-assign completed');
    setShowAutoAssignDialog(false);
  };

  // Publish — saves assigned slots to backend with server-side date validation
  const handlePublish = async () => {
    const assignedSlots = slots.filter((s) => s.status === 'assigned' && s.projectId);
    if (assignedSlots.length === 0) {
      toast.error('No assigned slots to publish');
      return;
    }

    // Validate that weekStart is a proper ISO week string (e.g. "2026-W08")
    if (!/^\d{4}-W\d{2}$/.test(weekStart)) {
      toast.error('Please select a valid week before publishing');
      return;
    }

    // Fetch server time for frontend pre-validation (backend always re-validates)
    const serverNow = await getServerTime();

    // Pre-check all slots: compute scheduledAt and ensure they are in the future
    const invalids: string[] = [];
    for (const slot of assignedSlots) {
      const scheduledAt = computeScheduledAt(weekStart, slot.day, slot.startTime);
      if (!scheduledAt || scheduledAt <= serverNow) {
        invalids.push(`${slot.day} ${slot.startTime}${slot.projectName ? ` (${slot.projectName})` : ''}`);
      }
    }
    if (invalids.length > 0) {
      toast.error(`These slots are in the past and cannot be published:\n${invalids.join(', ')}`);
      return;
    }

    setPublishing(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const slot of assignedSlots) {
      const scheduledAt = computeScheduledAt(weekStart, slot.day, slot.startTime)!;
      try {
        await assignPresentationSchedule({
          groupId: slot.projectId!,
          scheduledAt: scheduledAt.toISOString(),
          day: slot.day,
          timeSlot: slot.startTime,
          committeeMembers: [slot.supervisor, slot.supervisor2].filter(Boolean) as string[],
        });
        successCount++;
      } catch (err: any) {
        errors.push(err?.message ?? `Failed: ${slot.projectName}`);
      }
    }

    setPublishing(false);
    setShowPublishDialog(false);

    if (errors.length === 0) {
      toast.success(`Schedule published — ${successCount} slot(s) saved, calendar events and announcements created`);
    } else {
      toast.error(`${successCount} saved, ${errors.length} failed: ${errors[0]}`);
    }
  };

  // Download schedule
  const handleDownload = () => {
    toast.success('Downloading schedule...');
  };

  // Reset schedule
  const handleReset = () => {
    if (confirm('Reset all assignments? This cannot be undone.')) {
      const newSlots = slots.map(s => ({ ...s, status: 'offered' as const, projectName: undefined, projectId: undefined, course: undefined }));
      const newProjects = projects.map(p => ({ ...p, status: 'unassigned' as const }));
      setSlots(newSlots);
      setProjects(newProjects);
      addToHistory(newSlots);
      toast.success('Schedule reset');
    }
  };

  // Helper functions
  const calculateEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
  };

  const getSlotForDayTime = (day: typeof DAYS[number], time: string) => {
    return slots.find(s => s.day === day && s.startTime === time);
  };

  const getSlotsForDay = (day: typeof DAYS[number]) => {
    return slots.filter(s => s.day === day);
  };

  const getUnassignedProjects = () => {
    return projects.filter(p => p.status === 'unassigned' && (course === null || p.course === course));
  };

  const filteredSupervisors = supervisors.filter(s =>
    s.name.toLowerCase().includes(searchSupervisor.toLowerCase()) &&
    (filterDay === 'all' || (s[filterDay.toLowerCase() as keyof SupervisorAvailability] as number) > 0)
  );

  return (
    <Layout user={user} pageTitle="Presentation & Committee Management">
      {/* Header Controls */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select value={term} onValueChange={setTerm}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-01">Term 1, 2026</SelectItem>
              <SelectItem value="2026-02">Term 2, 2026</SelectItem>
              <SelectItem value="2025-01">Term 1, 2025</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            <button
              onClick={() => !isCoordinator && setCourse('498')}
              disabled={isCoordinator && course !== '498'}
              className={`px-4 py-2 text-sm transition-colors ${
                course === '498' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              CPIS-498
            </button>
            <button
              onClick={() => !isCoordinator && setCourse('499')}
              disabled={isCoordinator && course !== '499'}
              className={`px-4 py-2 text-sm border-l border-[var(--color-border)] transition-colors ${
                course === '499' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              CPIS-499
            </button>
          </div>

          <Input
            type="week"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            className="w-[180px]"
          />

          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Week
          </Button>

          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={historyIndex === 0}
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={historyIndex === history.length - 1}
          >
            <Redo2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={() => setShowAutoAssignDialog(true)}>
            <Sparkles className="w-4 h-4 mr-2" />
            Auto-Assign
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button onClick={() => setShowPublishDialog(true)} className="bg-green-600 hover:bg-green-700 text-[rgb(0,0,0)]">
            <Send className="w-4 h-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="audit">Changes Log</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <div className="grid grid-cols-[320px_1fr_380px] gap-6">
            {/* Left Panel - Planning & Capacity ONLY */}
            <div>
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h3 className="text-[var(--color-text-900)] mb-4">Planning & Capacity</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Students (498)</Label>
                      <Input
                        type="number"
                        value={numStudents498}
                        onChange={(e) => setNumStudents498(parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Students (499)</Label>
                      <Input
                        type="number"
                        value={numStudents499}
                        onChange={(e) => setNumStudents499(parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Number of Supervisors</Label>
                    <Input
                      type="number"
                      value={numSupervisors}
                      onChange={(e) => setNumSupervisors(parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Max Sessions/Day</Label>
                      <Input
                        type="number"
                        value={maxSessionsPerDay}
                        onChange={(e) => setMaxSessionsPerDay(parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Session Duration (min)</Label>
                      <Input
                        type="number"
                        value={sessionDuration}
                        onChange={(e) => setSessionDuration(parseInt(e.target.value) || 0)}
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Buffer (min)</Label>
                    <Input
                      type="number"
                      value={bufferDuration}
                      onChange={(e) => setBufferDuration(parseInt(e.target.value) || 0)}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Computed Metrics */}
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-600)]">Required Slots</span>
                    <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {totalRequired}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-600)]">Available Slots</span>
                    <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                      {availableSlots}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-[var(--color-text-600)]">Coverage</span>
                      <span className="text-[var(--color-text-900)]">{coverage.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getCoverageColor()} transition-all duration-300`}
                        style={{ width: `${Math.min(coverage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Constraints */}
                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <h4 className="text-sm text-[var(--color-text-900)] mb-3">Constraints</h4>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="limit-sessions" className="text-sm">Limit sessions per day</Label>
                      <Switch
                        id="limit-sessions"
                        checked={limitSessionsPerDay}
                        onCheckedChange={setLimitSessionsPerDay}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="avoid-same" className="text-sm">Avoid same committee twice</Label>
                      <Switch
                        id="avoid-same"
                        checked={avoidSameCommittee}
                        onCheckedChange={setAvoidSameCommittee}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="spread-evenly" className="text-sm">Spread evenly</Label>
                      <Switch
                        id="spread-evenly"
                        checked={spreadEvenly}
                        onCheckedChange={setSpreadEvenly}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Panel - Week Schedule */}
            <div>
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[var(--color-text-900)]">Week Schedule</h3>
                  <span className="text-sm text-[var(--color-text-600)]">
                    {slots.filter(s => s.status === 'assigned').length} / {slots.length} slots assigned
                  </span>
                </div>

                {/* Calendar Grid */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-[var(--color-border)] p-2 bg-[var(--color-surface-alt)] w-24 text-xs text-[var(--color-text-600)]">
                          Time
                        </th>
                        {DAYS.map((day) => (
                          <th key={day} className="border border-[var(--color-border)] p-2 bg-[var(--color-surface-alt)] w-[140px]">
                            <div className="text-sm text-[var(--color-text-900)]">{day}</div>
                            <div className="text-xs text-[var(--color-text-600)]">
                              {getSlotsForDay(day).length} slots
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TIME_SLOTS.map((time) => (
                        <tr key={time.start}>
                          <td className="border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-600)] text-center bg-[var(--color-surface-alt)]">
                            {time.start} - {time.end}
                          </td>
                          {DAYS.map((day) => {
                            const slot = getSlotForDayTime(day, time.start);
                            return (
                              <td
                                key={day}
                                className="border border-[var(--color-border)] p-1 align-top"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (draggedProject && slot && slot.status === 'offered') {
                                    handleAssignProject(slot.id, draggedProject);
                                  }
                                }}
                              >
                                {slot ? (
                                  <div
                                    onClick={() => handleEditSlot(slot)}
                                    className={`p-2 rounded cursor-pointer transition-all hover:shadow-md ${
                                      slot.status === 'assigned'
                                        ? 'bg-green-50 border border-green-300'
                                        : slot.status === 'offered'
                                        ? 'bg-blue-50 border border-blue-200 border-dashed'
                                        : 'bg-gray-50 border border-gray-200'
                                    } ${slot.conflicts?.length ? 'border-red-500' : ''}`}
                                  >
                                    <div className="text-xs text-[var(--color-text-600)] mb-1">
                                      {slot.startTime} {slot.endTime}
                                    </div>
                                    {slot.status === 'assigned' && slot.projectName && (
                                      <>
                                        <div className="text-xs text-[var(--color-text-900)] mb-1 truncate">
                                          {slot.projectName}
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-600)]">
                                          <Users className="w-3 h-3" />
                                          <span className="truncate">{slot.supervisor.split(' ')[1]}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-600)] mt-1">
                                          <MapPin className="w-3 h-3" />
                                          <span>{slot.room}</span>
                                        </div>
                                        {slot.course && (
                                          <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded ${
                                            slot.course === '498'
                                              ? 'bg-blue-100 text-blue-700'
                                              : 'bg-purple-100 text-purple-700'
                                          }`}>
                                            {slot.course}
                                          </span>
                                        )}
                                      </>
                                    )}
                                    {slot.status === 'offered' && (
                                      <div className="text-xs text-blue-600 text-center">
                                        Drop here
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleCreateSlot(day, time.start)}
                                    className="w-full h-full min-h-[60px] flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors rounded"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {slots.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-[var(--color-text-600)] mb-2">No slots created yet</p>
                    <p className="text-sm text-[var(--color-text-600)]">Click + in any cell to create a time slot</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel - Availability Pool & Unassigned Projects */}
            <div className="space-y-6">
              {/* Availability Pool */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[var(--color-text-900)]">Availability Pool</h3>
                  <span className="text-xs text-[var(--color-text-600)]">LIVE</span>
                </div>

                <div className="flex gap-2 mb-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search supervisor..."
                      value={searchSupervisor}
                      onChange={(e) => setSearchSupervisor(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterDay} onValueChange={setFilterDay}>
                    <SelectTrigger className="w-[120px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Days</SelectItem>
                      <SelectItem value="sun">Sunday</SelectItem>
                      <SelectItem value="mon">Monday</SelectItem>
                      <SelectItem value="tue">Tuesday</SelectItem>
                      <SelectItem value="wed">Wednesday</SelectItem>
                      <SelectItem value="thu">Thursday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {filteredSupervisors.map((supervisor) => (
                    <div
                      key={supervisor.id}
                      className="p-3 border border-[var(--color-border)] rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-[var(--color-text-900)]">{supervisor.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          supervisor.status === 'ready' 
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                          {supervisor.status === 'ready' ? 'Ready' : 'None'}
                        </span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="text-[var(--color-text-600)]">Sun: {supervisor.sun}</span>
                        <span className="text-[var(--color-text-600)]">Mon: {supervisor.mon}</span>
                        <span className="text-[var(--color-text-600)]">Tue: {supervisor.tue}</span>
                        <span className="text-[var(--color-text-600)]">Wed: {supervisor.wed}</span>
                        <span className="text-[var(--color-text-600)]">Thu: {supervisor.thu}</span>
                        <span className="text-[var(--color-text-900)] ml-auto">Total: {supervisor.total}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unassigned Projects */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <h3 className="text-[var(--color-text-900)] mb-4">Unassigned Projects</h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {getUnassignedProjects().map((project) => (
                    <div
                      key={project.id}
                      draggable
                      onDragStart={() => setDraggedProject(project)}
                      onDragEnd={() => setDraggedProject(null)}
                      className="p-3 border border-[var(--color-border)] rounded-lg hover:border-[var(--color-primary-600)] hover:bg-blue-50 cursor-grab active:cursor-grabbing transition-all"
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm text-[var(--color-text-900)] truncate">{project.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                              project.course === '498'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                              {project.course}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--color-text-600)]">
                            <span>{project.groupId}</span>
                            {project.preferredDay && (
                              <span className="text-amber-600">Prefers: {project.preferredDay}</span>
                            )}
                          </div>
                          {project.supervisor && (
                            <div className="text-xs text-[var(--color-text-600)] mt-1">
                              <span className="font-medium">Supervisor:</span> {project.supervisor}
                            </div>
                          )}
                          {project.students && project.students.length > 0 && (
                            <div className="text-xs text-[var(--color-text-600)] mt-0.5">
                              <span className="font-medium">Students:</span> {project.students.map(s => s.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {getUnassignedProjects().length === 0 && (
                    <div className="text-center py-8 text-[var(--color-text-600)]">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                      <p className="text-sm">All projects assigned!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-8">
            <h3 className="text-[var(--color-text-900)] mb-6">Changes Log</h3>
            <div className="space-y-4">
              {changesLog.length > 0 ? changesLog.map((entry) => (
                <div key={entry.id} className="flex gap-4 pb-4 border-b border-[var(--color-border)] last:border-0">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--color-text-900)]">{entry.action}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{entry.entity}</span>
                    </div>
                    <p className="text-[var(--color-text-600)] text-sm">{entry.context || '—'}</p>
                    <p className="text-[var(--color-text-600)] text-xs mt-1">
                      {entry.actor} • {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-[var(--color-text-600)]">
                  <p>No changes logged yet</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Slot Dialog */}
      <Dialog open={showSlotDialog} onOpenChange={setShowSlotDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedSlot ? 'Edit Slot' : 'Create Slot'}</DialogTitle>
            <DialogDescription>
              {selectedSlot ? 'Modify slot details' : 'Add a new presentation time slot'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Day</Label>
                <Select
                  value={editingSlot.day}
                  onValueChange={(value) => setEditingSlot({ ...editingSlot, day: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Room</Label>
                <Input
                  value={editingSlot.room || ''}
                  onChange={(e) => setEditingSlot({ ...editingSlot, room: e.target.value })}
                  placeholder="Room A-101"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Supervisor 1</Label>
                <Select
                  value={editingSlot.supervisor}
                  onValueChange={(value) => setEditingSlot({ ...editingSlot, supervisor: value, status: 'offered' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Supervisor 2</Label>
                <Select
                  value={editingSlot.supervisor2 || 'none'}
                  onValueChange={(value) => setEditingSlot({ ...editingSlot, supervisor2: value === 'none' ? undefined : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {supervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedSlot?.projectName && (
              <div className="p-4 border border-[var(--color-border)] rounded-lg bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm">Assigned Project</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectedSlot && handleUnassignProject(selectedSlot.id)}
                  >
                    Unassign
                  </Button>
                </div>
                <p className="text-sm text-[var(--color-text-900)]">{selectedSlot.projectName}</p>
              </div>
            )}

            {/* Unassigned Projects Section */}
            {!selectedSlot?.projectName && editingSlot.supervisor && (
              <div className="border-t border-[var(--color-border)] pt-4">
                <Label className="text-sm mb-3 block">Unassigned Projects (Optional)</Label>
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {getUnassignedProjects().length > 0 ? (
                    getUnassignedProjects().map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => {
                          setEditingSlot({ 
                            ...editingSlot, 
                            projectId: project.id, 
                            projectName: project.name, 
                            course: project.course,
                            status: 'assigned'
                          });
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all hover:border-[var(--color-primary-600)] hover:bg-blue-50 ${
                          editingSlot.projectId === project.id 
                            ? 'border-[var(--color-primary-600)] bg-blue-50' 
                            : 'border-[var(--color-border)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-[var(--color-text-900)] truncate">{project.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                            project.course === '498'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-purple-100 text-purple-700 border border-purple-200'
                          }`}>
                            CPIS-{project.course}
                          </span>
                        </div>
                        <div className="text-xs text-[var(--color-text-600)]">{project.groupId}</div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-6 text-[var(--color-text-600)]">
                      <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-600" />
                      <p className="text-sm">All projects assigned!</p>
                    </div>
                  )}
                </div>
                {editingSlot.projectId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSlot({ ...editingSlot, projectId: undefined, projectName: undefined, course: undefined, status: 'offered' })}
                    className="mt-2 w-full"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {selectedSlot && (
              <Button
                variant="outline"
                onClick={() => handleDeleteSlot(selectedSlot.id)}
                className="mr-auto text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowSlotDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSlot} className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-[rgb(0,0,0)]">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Assign Dialog */}
      <Dialog open={showAutoAssignDialog} onOpenChange={setShowAutoAssignDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Auto-Assign Presentations</DialogTitle>
            <DialogDescription>
              Automatically assign unassigned projects to available slots
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Prefer preferred day</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>Balance supervisor load</Label>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <Label>Avoid back-to-back for same group</Label>
              <Switch defaultChecked />
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                This will assign {getUnassignedProjects().length} unassigned projects to available slots.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoAssignDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAutoAssign} className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-black">
              Preview & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Publish Schedule</DialogTitle>
            <DialogDescription>
              Make the schedule visible to supervisors and students
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-900 mb-2">
                    Publishing will send notifications to:
                  </p>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                    <li>Supervisors: &quot;You have X assigned presentations this week&quot;</li>
                    <li>Students: &quot;Your presentation is scheduled on [date time]&quot;</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-600)]">Total slots:</span>
                <span className="text-[var(--color-text-900)]">{slots.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-600)]">Assigned:</span>
                <span className="text-[var(--color-text-900)]">{slots.filter(s => s.status === 'assigned').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-600)]">Unassigned projects:</span>
                <span className="text-[var(--color-text-900)]">{getUnassignedProjects().length}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="bg-green-600 hover:bg-green-700 text-black"
            >
              <Send className="w-4 h-4 mr-2" />
              {publishing ? 'Publishing…' : 'Publish Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}