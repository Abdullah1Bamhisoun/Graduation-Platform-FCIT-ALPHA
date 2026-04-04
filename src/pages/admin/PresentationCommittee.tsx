import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { Layout } from '../../components/layout/Layout';
import { getProfilesByRole } from '../../services/profiles';
import { getAllGroups } from '../../services/groups';
import {
  assignPresentationSchedule,
  computeScheduledAt,
  dateToIsoWeek,
  deletePresentationSchedule,
  getPresentationsByCourse,
  getServerTime,
} from '../../services/presentations';
import { Button } from '../../components/ui/button';
import { WeekPicker } from '../../components/ui/WeekPicker';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent } from '../../components/ui/tabs';
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
  ChevronDown,
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
  /** ISO week this slot belongs to, e.g. "2026-W15". Used to filter by selected week. */
  week?: string;
  /** True once the admin has explicitly saved this slot's supervisor fields via the dialog. */
  supervisorsModified?: boolean;
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
const DAY_NAMES: Record<typeof DAYS[number], string> = {
  Sun: 'Sunday',
  Mon: 'Monday',
  Tue: 'Tuesday',
  Wed: 'Wednesday',
  Thu: 'Thursday',
};
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
  // Coordinators are locked to their assigned course; admins choose explicitly.
  const [course, setCourse] = useState<'498' | '499' | null>(null);
  const [weekStart, setWeekStart] = useState(() => dateToIsoWeek(new Date()));


  // Schedule slots (start empty)
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  // Committee members loaded from DB on init — used as fallback when publishing
  // a slot whose supervisor field is empty (e.g. after recreating a slot to
  // change its time without re-selecting the supervisor).
  const [savedCommitteeMembers, setSavedCommitteeMembers] = useState<Map<string, string[]>>(new Map());

  const [projects, setProjects] = useState<Project[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorAvailability[]>([]);
  const [committeePool, setCommitteePool] = useState<Set<string>>(new Set());
  const [poolOpen, setPoolOpen] = useState(true);
  const [unassignedOpen, setUnassignedOpen] = useState(true);

  const isCoordinator = user?.activeRole === 'coordinator';

  useEffect(() => {
    if (!user) return;

    async function init() {
      const [sups, groups] = await Promise.all([
        getProfilesByRole('supervisor'),
        // Pass activeRole so the backend applies coordinator course-scoping
        getAllGroups(user!.activeRole),
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

      // For coordinators: auto-detect their course from loaded groups
      if (isCoordinator && mappedProjects.length > 0) {
        setCourse(mappedProjects[0].course);
      }

      // Load saved schedules from DB and hydrate the slot board
      const courseIds = [...new Set(groups.map(g => g.courseId).filter(Boolean))];
      const allSaved = (
        await Promise.all(courseIds.map(id => getPresentationsByCourse(id)))
      ).flat().filter(s => s.day && s.timeSlot);

      // Store existing committee members keyed by groupId so handlePublish can
      // fall back to them when a slot has no supervisor set (e.g. after the
      // admin deletes and recreates a slot to change its time).
      setSavedCommitteeMembers(new Map(allSaved.map(s => [s.groupId, s.committeeMembers])));

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
          const slotWeek = s.scheduledAt ? dateToIsoWeek(new Date(s.scheduledAt)) : undefined;
          return {
            id: `slot-${Date.now()}-${i}`,
            day: s.day as TimeSlot['day'],
            startTime: s.timeSlot!,
            endTime: timeInfo?.end ?? '',
            room: s.location ?? '',
            supervisor: s.committeeMembers[0] ?? '',
            supervisor2: s.committeeMembers[1],
            status: 'assigned' as const,
            projectName: s.projectName,
            projectId: s.groupId,
            course: project?.course,
            week: slotWeek,
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

  // Auto-assign options
  const [autoPreferDay, setAutoPreferDay] = useState(true);
  const [autoBalanceLoad, setAutoBalanceLoad] = useState(true);
  const [autoAvoidBackToBack, setAutoAvoidBackToBack] = useState(true);

  // History for undo/redo
  const [history, setHistory] = useState<TimeSlot[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  if (!user) return null;


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
    const timeInfo = TIME_SLOTS.find(t => t.start === time);
    const endTime = timeInfo?.end ?? '';
    const newSlot: TimeSlot = {
      id: `slot-${Date.now()}`,
      day,
      startTime: time,
      endTime,
      room: '',
      supervisor: '',
      status: 'empty',
      course: course ?? undefined,
      week: weekStart,
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
    // Guard: if the currently-set supervisor(s) happen to be the group's own
    // supervisor (e.g. set before the project was selected), strip them out.
    const assignedProject = editingSlot.projectId
      ? projects.find(p => p.id === editingSlot.projectId)
      : null;
    const groupSupLower = assignedProject?.supervisor?.trim().toLowerCase();
    const slot = { ...editingSlot };
    if (groupSupLower) {
      if (slot.supervisor?.trim().toLowerCase() === groupSupLower) slot.supervisor = '';
      if (slot.supervisor2?.trim().toLowerCase() === groupSupLower) slot.supervisor2 = undefined;
    }

    if (selectedSlot) {
      // Update existing — mark supervisorsModified so handlePublish knows the
      // admin explicitly reviewed (and potentially changed) the supervisor fields.
      const newSlots = slots.map(s => s.id === selectedSlot.id ? { ...selectedSlot, ...slot, supervisorsModified: true } as TimeSlot : s);
      setSlots(newSlots);
      addToHistory(newSlots);

      // Sync projects: unassign old project, assign new project
      const oldProjectId = selectedSlot.projectId;
      const newProjectId = slot.projectId;
      if (oldProjectId !== newProjectId) {
        setProjects(projects.map(p => {
          if (p.id === oldProjectId) return { ...p, status: 'unassigned' as const };
          if (p.id === newProjectId) return { ...p, status: 'assigned' as const };
          return p;
        }));
      }

      toast.success('Slot updated');
    } else {
      // Create new — mark supervisorsModified so handlePublish knows the admin
      // explicitly reviewed the supervisor fields for this new slot.
      const newSlots = [...slots, { ...slot, week: slot.week ?? weekStart, supervisorsModified: true } as TimeSlot];
      setSlots(newSlots);
      addToHistory(newSlots);

      // Mark the selected project as assigned
      const newProjectId = slot.projectId;
      if (newProjectId) {
        setProjects(projects.map(p =>
          p.id === newProjectId ? { ...p, status: 'assigned' as const } : p
        ));
      }

      toast.success('Slot created');
    }
    setShowSlotDialog(false);
    setEditingSlot({});
  };

  // Delete slot
  const handleDeleteSlot = (slotId: string) => {
    // If the slot had an assigned project, return it to the unassigned pool
    const slot = slots.find(s => s.id === slotId);
    if (slot?.projectId) {
      setProjects(projects.map(p =>
        p.id === slot.projectId ? { ...p, status: 'unassigned' as const } : p
      ));
    }
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
    // Clear selectedSlot so the dialog immediately reflects the unassigned state
    setSelectedSlot(prev =>
      prev?.id === slotId
        ? { ...prev, status: 'offered', projectName: undefined, projectId: undefined, course: undefined }
        : prev
    );
    setEditingSlot(prev => ({ ...prev, status: 'offered', projectName: undefined, projectId: undefined, course: undefined }));
    toast.success('Project unassigned');
  };

  // Auto-assign
  // Automatically creates slots for every unassigned project — no manual slot creation needed.
  // Rule: a committee member may have AT MOST 4 consecutive sessions in a single day.
  const handleAutoAssign = () => {
    const unassigned = projects
      .filter(p => p.status === 'unassigned' && (course === null || p.course === course))
      // Sort by groupId (IS_01 < IS_02 ...) so IS_01 always gets the first slot
      .sort((a, b) => a.groupId.localeCompare(b.groupId, undefined, { numeric: true }));

    if (committeePool.size === 0) {
      toast.error('No supervisors selected in the committee pool. Please select supervisors before running auto-assign.');
      setShowAutoAssignDialog(false);
      return;
    }

    if (unassigned.length === 0) {
      toast.error('No unassigned projects to place.');
      setShowAutoAssignDialog(false);
      return;
    }

    // Track which day+time combinations are already occupied
    const takenSlots = new Set<string>(slots.map(s => `${s.day}-${s.startTime}`));

    // committeeLoad[supervisorName][day] = TIME_SLOTS indices already assigned
    const committeeLoad: Record<string, Record<string, number[]>> = {};
    slots
      .filter(s => s.status === 'assigned')
      .forEach(s => {
        const idx = TIME_SLOTS.findIndex(t => t.start === s.startTime);
        [s.supervisor, s.supervisor2].filter(Boolean).forEach(name => {
          if (!name) return;
          committeeLoad[name] ??= {};
          committeeLoad[name][s.day] ??= [];
          if (!committeeLoad[name][s.day].includes(idx)) committeeLoad[name][s.day].push(idx);
        });
      });

    // groupSessionsInDay[groupId][day] = TIME_SLOTS indices — for back-to-back avoidance
    const groupSessionsInDay: Record<string, Record<string, number[]>> = {};
    slots
      .filter(s => s.status === 'assigned' && s.projectId)
      .forEach(s => {
        const idx = TIME_SLOTS.findIndex(t => t.start === s.startTime);
        groupSessionsInDay[s.projectId!] ??= {};
        groupSessionsInDay[s.projectId!][s.day] ??= [];
        groupSessionsInDay[s.projectId!][s.day].push(idx);
      });

    /** Returns true only if adding timeIdx to this supervisor's day keeps max-consecutive ≤ 4 */
    const canAssign = (name: string, day: string, timeIdx: number): boolean => {
      const existing = [...(committeeLoad[name]?.[day] ?? []), timeIdx].sort((a, b) => a - b);
      let run = 1;
      for (let i = 1; i < existing.length; i++) {
        run = existing[i] === existing[i - 1] + 1 ? run + 1 : 1;
        if (run > 4) return false;
      }
      return true;
    };

    const recordAssignment = (name: string, day: string, timeIdx: number) => {
      committeeLoad[name] ??= {};
      committeeLoad[name][day] ??= [];
      committeeLoad[name][day].push(timeIdx);
    };

    const totalLoad = (name: string) =>
      Object.values(committeeLoad[name] ?? {}).flat().length;

    // dayLoad tracks how many slots are placed per day — used for even spreading
    const dayLoad: Record<string, number> = {};
    DAYS.forEach(d => { dayLoad[d] = slots.filter(s => s.day === d).length; });

    const newSlots = slots.map(s => ({ ...s }));
    const newProjects = projects.map(p => ({ ...p }));
    let assigned = 0;
    const unplaceable: string[] = [];
    // Track which newly-created slot indices belong to each day (for rotation later)
    const newSlotsByDay: Record<string, number[]> = {};

    for (let pi = 0; pi < unassigned.length; pi++) {
      const project = unassigned[pi];
      const chosenGroupSupervisor = project.supervisor?.trim().toLowerCase();
      const isFirstProject = pi === 0;

      // Build day priority order
      let dayOrder = [...DAYS];
      if (isFirstProject) {
        // Force IS_01 (first group) to Sunday first
        dayOrder = ['Sun', ...DAYS.filter(d => d !== 'Sun')];
      } else if (autoBalanceLoad) {
        dayOrder.sort((a, b) => dayLoad[a] - dayLoad[b]);
      }
      // If preferred day is set, always try it first (except for IS_01)
      if (!isFirstProject && autoPreferDay && project.preferredDay) {
        const preferred = DAYS.find(d => d.toLowerCase() === project.preferredDay!.toLowerCase());
        if (preferred) {
          dayOrder = [preferred, ...dayOrder.filter(d => d !== preferred)];
        }
      }

      let placed = false;

      outer: for (const day of dayOrder) {
        for (let timeIdx = 0; timeIdx < TIME_SLOTS.length; timeIdx++) {
          const timeInfo = TIME_SLOTS[timeIdx];
          const key = `${day}-${timeInfo.start}`;

          if (takenSlots.has(key)) continue;

          // Back-to-back avoidance
          if (autoAvoidBackToBack && project.id) {
            const existingSessions = groupSessionsInDay[project.id]?.[day] ?? [];
            if (existingSessions.includes(timeIdx - 1) || existingSessions.includes(timeIdx + 1)) continue;
          }

          // Pick committee members — respect the pool selection if any supervisors are checked
          const poolCandidates = committeePool.size > 0
            ? supervisors.filter(s => committeePool.has(s.name))
            : supervisors;
          const eligible = poolCandidates.filter(s => {
            if (chosenGroupSupervisor && s.name.trim().toLowerCase() === chosenGroupSupervisor) return false;
            return canAssign(s.name, day, timeIdx);
          });

          if (autoBalanceLoad) {
            eligible.sort((a, b) => totalLoad(a.name) - totalLoad(b.name));
          }

          const member1 = eligible[0];
          const member2 = eligible.find(s => s.id !== member1?.id);

          // Create the new slot with the project already assigned
          newSlots.push({
            id: `slot-${Date.now()}-${assigned}`,
            day,
            startTime: timeInfo.start,
            endTime: timeInfo.end,
            room: '',
            supervisor: member1?.name ?? '',
            supervisor2: member2?.name,
            status: 'assigned',
            projectName: project.name,
            projectId: project.id,
            course: project.course,
            week: weekStart,
            supervisorsModified: true,
          });

          takenSlots.add(key);
          dayLoad[day] = (dayLoad[day] ?? 0) + 1;

          if (member1) recordAssignment(member1.name, day, timeIdx);
          if (member2) recordAssignment(member2.name, day, timeIdx);

          groupSessionsInDay[project.id] ??= {};
          groupSessionsInDay[project.id][day] ??= [];
          groupSessionsInDay[project.id][day].push(timeIdx);

          // Track newly-created slot index per day for committee rotation
          newSlotsByDay[day] ??= [];
          newSlotsByDay[day].push(newSlots.length - 1);

          const projIdx = newProjects.findIndex(p => p.id === project.id);
          if (projIdx !== -1) newProjects[projIdx] = { ...newProjects[projIdx], status: 'assigned' };

          assigned++;
          placed = true;
          break outer;
        }
      }

      if (!placed) {
        unplaceable.push(project.name);
      }
    }

    // ── Committee rotation pass ─────────────────────────────────────────────
    // For each day, sort newly-placed slots by time and process in blocks of 4.
    // Each slot's committee members are drawn from the supervisors of the OTHER
    // groups in the same block (rotating), so no group is evaluated by its own supervisor.
    for (const day of DAYS) {
      const dayIndices = (newSlotsByDay[day] ?? [])
        .sort((a, b) =>
          TIME_SLOTS.findIndex(t => t.start === newSlots[a].startTime) -
          TIME_SLOTS.findIndex(t => t.start === newSlots[b].startTime)
        );

      for (let blockStart = 0; blockStart < dayIndices.length; blockStart += 4) {
        const block = dayIndices.slice(blockStart, blockStart + 4);

        block.forEach((slotIdx, i) => {
          const s = newSlots[slotIdx];
          const ownProj = newProjects.find(p => p.id === s.projectId);
          const ownSupLower = ownProj?.supervisor?.trim().toLowerCase();

          // Collect supervisors from the other slots in this block (rotating order)
          const rotatedCandidates: string[] = [];
          for (let offset = 1; offset < block.length; offset++) {
            const neighborIdx = block[(i + offset) % block.length];
            const neighborSlot = newSlots[neighborIdx];
            const neighborProj = newProjects.find(p => p.id === neighborSlot.projectId);
            const supName = neighborProj?.supervisor;
            if (
              supName &&
              supName.trim().toLowerCase() !== ownSupLower &&
              !rotatedCandidates.includes(supName) &&
              (committeePool.size === 0 || committeePool.has(supName))
            ) {
              rotatedCandidates.push(supName);
            }
          }

          // Apply rotated members; fall back to originally picked members if not enough candidates
          if (rotatedCandidates.length > 0) {
            newSlots[slotIdx] = {
              ...s,
              supervisor: rotatedCandidates[0],
              supervisor2: rotatedCandidates[1] ?? s.supervisor2,
            };
          }
        });
      }
    }

    setSlots(newSlots);
    setProjects(newProjects);
    addToHistory(newSlots);
    setShowAutoAssignDialog(false);

    if (unplaceable.length > 0) {
      toast.warning(`${assigned} project(s) placed. Could not find a slot for: ${unplaceable.join(', ')}`);
    } else {
      toast.success(`Auto-assigned ${assigned} project(s) — committee members capped at 4 consecutive sessions/day`);
    }
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

    // Admins can publish any date; coordinators are restricted to future slots only.
    let publishable = assignedSlots;
    if (isCoordinator) {
      const skipped: string[] = [];
      publishable = assignedSlots.filter(slot => {
        const scheduledAt = computeScheduledAt(weekStart, slot.day, slot.startTime);
        if (!scheduledAt || scheduledAt <= serverNow) {
          skipped.push(`${slot.day} ${slot.startTime}${slot.projectName ? ` (${slot.projectName})` : ''}`);
          return false;
        }
        return true;
      });
      if (publishable.length === 0) {
        toast.error(`All slots are in the past and cannot be published:\n${skipped.join(', ')}`);
        return;
      }
      if (skipped.length > 0) {
        toast.warning(`Skipping ${skipped.length} past slot(s): ${skipped.join(', ')}`);
      }
    }

    // Warn if any slots will publish without committee members.
    // Slots that were never opened in the dialog (supervisorsModified = false)
    // automatically fall back to saved DB committee members, so they only show
    // this warning if there are no saved members for that group either.
    const noCommitteeSlots = publishable.filter(slot => {
      const fromSlot = [slot.supervisor, slot.supervisor2].filter(Boolean);
      if (fromSlot.length > 0) return false;
      if (!slot.supervisorsModified && slot.projectId && savedCommitteeMembers.get(slot.projectId)?.length) return false;
      return true;
    });
    if (noCommitteeSlots.length > 0) {
      toast.warning(
        `${noCommitteeSlots.length} slot(s) have no committee members — supervisors won't see those groups for evaluation. Open each slot to assign committee members.`
      );
    }

    setPublishing(true);
    let successCount = 0;
    const errors: string[] = [];

    for (const slot of publishable) {
      const scheduledAt = computeScheduledAt(weekStart, slot.day, slot.startTime) ?? serverNow;

      // Determine committee members: use slot's supervisors if the admin
      // explicitly reviewed them (supervisorsModified = true); otherwise fall
      // back to the committee members saved in the DB for this group so that
      // "change the time" workflows don't accidentally clear assignments.
      const fromSlot = [slot.supervisor, slot.supervisor2].filter(Boolean) as string[];
      const committeeMembers =
        fromSlot.length > 0
          ? fromSlot
          : !slot.supervisorsModified && slot.projectId
          ? (savedCommitteeMembers.get(slot.projectId) ?? [])
          : [];

      try {
        await assignPresentationSchedule({
          groupId: slot.projectId!,
          scheduledAt: scheduledAt.toISOString(),
          day: slot.day,
          timeSlot: slot.startTime,
          committeeMembers,
          location: slot.room || undefined,
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
    const assignedSlots = slots.filter(s => s.status === 'assigned' && s.projectId);
    if (assignedSlots.length === 0) {
      toast.error('No assigned slots to download.');
      return;
    }

    const rows = assignedSlots
      .sort((a, b) => {
        const dayOrder = DAYS.indexOf(a.day as typeof DAYS[number]) - DAYS.indexOf(b.day as typeof DAYS[number]);
        if (dayOrder !== 0) return dayOrder;
        return TIME_SLOTS.findIndex(t => t.start === a.startTime) - TIME_SLOTS.findIndex(t => t.start === b.startTime);
      })
      .map(slot => {
        const proj = slot.projectId ? projects.find(p => p.id === slot.projectId) : null;
        const students = proj?.students?.map(s => s.name).join(', ') ?? '';
        return {
          'Group ID': proj?.groupId ?? '',
          'Project Name': slot.projectName ?? '',
          'Course': slot.course ? `CPIS-${slot.course}` : '',
          'Day': DAY_NAMES[slot.day as typeof DAYS[number]] ?? slot.day,
          'Time Slot': `${slot.startTime} – ${slot.endTime}`,
          'Room': slot.room,
          'Committee Member 1': slot.supervisor,
          'Committee Member 2': slot.supervisor2 ?? '',
          'Supervisor': proj?.supervisor ?? '',
          'Students': students,
        };
      });

    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width columns
    const colWidths = Object.keys(rows[0] ?? {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key as keyof typeof r] ?? '').length)) + 2,
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

    const label = course ? `CPIS-${course}` : 'All';
    const week = weekStart.replace('-', '_');
    XLSX.writeFile(wb, `Presentation_Schedule_${label}_${week}.xlsx`);
    toast.success('Schedule downloaded.');
  };

  // Reset schedule — clears UI state and deletes published DB records so
  // supervisors no longer see stale committee assignments.
  const handleReset = async () => {
    if (confirm('Reset all assignments? This will also remove published committee assignments visible to supervisors. This cannot be undone.')) {
      // Delete all previously-published schedules from the DB
      const publishedGroupIds = Array.from(savedCommitteeMembers.keys());
      if (publishedGroupIds.length > 0) {
        const results = await Promise.allSettled(
          publishedGroupIds.map(id => deletePresentationSchedule(id))
        );
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) {
          toast.error(`Reset partially failed: ${failed} schedule(s) could not be removed from the database`);
        }
        setSavedCommitteeMembers(new Map());
      }

      const newSlots = slots.map(s => ({ ...s, status: 'offered' as const, projectName: undefined, projectId: undefined, course: undefined }));
      const newProjects = projects.map(p => ({ ...p, status: 'unassigned' as const }));
      setSlots(newSlots);
      setProjects(newProjects);
      addToHistory(newSlots);
      toast.success('Schedule reset — supervisor assignments cleared');
    }
  };

  const courseSlots = slots.filter(s =>
    (!s.week || s.week === weekStart) &&
    (!course || !s.course || s.course === course)
  );

  const getSlotForDayTime = (day: typeof DAYS[number], time: string) => {
    return courseSlots.find(s => s.day === day && s.startTime === time);
  };

  const getSlotsForDay = (day: typeof DAYS[number]) => {
    return courseSlots.filter(s => s.day === day);
  };

  const getUnassignedProjects = () => {
    return projects.filter(p => p.status === 'unassigned' && (course === null || p.course === course));
  };

  return (
    <Layout user={user} pageTitle="Presentation & Committee Management">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* Header Controls */}
      <div className="mb-6 flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            {(!isCoordinator || course === '498') && (
              <button
                onClick={() => !isCoordinator && setCourse('498')}
                className={`px-4 py-2 text-sm transition-colors ${
                  course === '498' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
                }`}
              >
                CPIS-498
              </button>
            )}
            {(!isCoordinator || course === '499') && (
              <button
                onClick={() => !isCoordinator && setCourse('499')}
                className={`px-4 py-2 text-sm ${!isCoordinator ? 'border-l border-[var(--color-border)]' : ''} transition-colors ${
                  course === '499' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
                }`}
              >
                CPIS-499
              </button>
            )}
          </div>


          <WeekPicker value={weekStart} onChange={setWeekStart} />

          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>

        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <span className="hidden sm:inline">Auto-Assign</span>
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
          <Button onClick={() => setShowPublishDialog(true)} className="bg-green-600! hover:bg-green-700! text-white border-green-600">
            <Send className="w-4 h-4 mr-2" />
            Publish
          </Button>
        </div>
      </div>

        <TabsContent value="schedule">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
            {/* Left Panel - Week Schedule */}
            <div>
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[var(--color-text-900)]">Week Schedule</h3>
                  <span className="text-sm text-[var(--color-text-600)]">
                    {courseSlots.filter(s => s.status === 'assigned').length} / {courseSlots.length} slots assigned
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
                            <div className="text-sm text-[var(--color-text-900)]">{DAY_NAMES[day]}</div>
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
                                        {(() => {
                                          const proj = slot.projectId ? projects.find(p => p.id === slot.projectId) : null;
                                          return proj?.groupId ? (
                                            <div className="text-xs font-mono text-[var(--color-text-600)] mb-1 truncate">
                                              {proj.groupId}
                                            </div>
                                          ) : null;
                                        })()}
                                        <div className="flex items-center gap-1 text-xs text-[var(--color-text-600)]">
                                          <Users className="w-3 h-3" />
                                          <span className="truncate">
                                            {[slot.supervisor, slot.supervisor2].filter(Boolean).join(', ')}
                                          </span>
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

            {/* Right Panel */}
            <div className="space-y-6">
              {/* Committee Supervisors Pool */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <button
                  onClick={() => setPoolOpen(o => !o)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[var(--color-text-900)]">Committee Supervisors</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-600)]">
                        {supervisors.length}
                      </span>
                    </div>
                    {!poolOpen && committeePool.size > 0 && (
                      <p className="text-xs text-[var(--color-text-600)] mt-0.5">{committeePool.size} selected</p>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${poolOpen ? 'rotate-180' : ''}`} />
                </button>
                {poolOpen && (
                  <div className="px-6 pb-5 border-t border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-600)] mt-3 mb-3">
                      Select which supervisors can evaluate committees for CPIS-{course ?? '…'}
                    </p>
                    <div className="space-y-1 max-h-[260px] overflow-y-auto">
                      {supervisors.map((sup) => {
                        const checked = committeePool.has(sup.name);
                        return (
                          <label
                            key={sup.id}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setCommitteePool(prev => {
                                  const next = new Set(prev);
                                  checked ? next.delete(sup.name) : next.add(sup.name);
                                  return next;
                                });
                              }}
                              className="w-4 h-4 accent-[var(--color-primary-600)]"
                            />
                            <span className="text-sm text-[var(--color-text-900)]">{sup.name}</span>
                          </label>
                        );
                      })}
                    </div>
                    {committeePool.size > 0 && (
                      <p className="text-xs text-[var(--color-text-600)] mt-3 border-t border-[var(--color-border)] pt-3">
                        {committeePool.size} supervisor{committeePool.size !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Unassigned Projects */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                <button
                  onClick={() => setUnassignedOpen(o => !o)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[var(--color-text-900)]">Unassigned Projects</h3>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-600)]">
                        {getUnassignedProjects().length}
                      </span>
                    </div>
                    {!unassignedOpen && (
                      <p className="text-xs text-[var(--color-text-600)] mt-0.5">{getUnassignedProjects().length} remaining</p>
                    )}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${unassignedOpen ? 'rotate-180' : ''}`} />
                </button>
                {unassignedOpen && (
                <div className="px-6 pb-5 border-t border-[var(--color-border)]">
                <div className="space-y-2 max-h-[400px] overflow-y-auto mt-4">
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
                )}
              </div>
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
            {/* Committee member selectors */}
            {(() => {
              const baseList = committeePool.size > 0
                ? supervisors.filter(s => committeePool.has(s.name))
                : supervisors;
              // Exclude the group's own supervisor from being selectable as a committee member
              const assignedProject = editingSlot.projectId
                ? projects.find(p => p.id === editingSlot.projectId)
                : null;
              const groupSupervisorName = assignedProject?.supervisor?.trim().toLowerCase();
              const poolList = groupSupervisorName
                ? baseList.filter(s => s.name.trim().toLowerCase() !== groupSupervisorName)
                : baseList;
              return (
                <div className="space-y-3">
                  {committeePool.size === 0 && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      No supervisors selected in the pool — showing all supervisors.
                    </p>
                  )}
                  {groupSupervisorName && assignedProject?.supervisor && (
                    <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <strong>{assignedProject.supervisor}</strong> is this group's supervisor and cannot be assigned as a committee member.
                    </p>
                  )}
                  <div>
                    <Label className="mb-1 block">Committee Member 1</Label>
                    <Select
                      value={editingSlot.supervisor}
                      onValueChange={(value) => setEditingSlot({ ...editingSlot, supervisor: value, status: 'offered' })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a supervisor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {poolList.map((sup) => (
                          <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block">Committee Member 2</Label>
                    <Select
                      value={editingSlot.supervisor2 || 'none'}
                      onValueChange={(value) => setEditingSlot({ ...editingSlot, supervisor2: value === 'none' ? undefined : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a supervisor..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— None —</SelectItem>
                        {poolList.map((sup) => (
                          <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <SelectItem key={day} value={day}>{DAY_NAMES[day]}</SelectItem>
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
                          const groupSupLower = project.supervisor?.trim().toLowerCase();
                          setEditingSlot({
                            ...editingSlot,
                            projectId: project.id,
                            projectName: project.name,
                            course: project.course,
                            status: 'assigned',
                            // Clear any committee member that is this group's own supervisor
                            supervisor: groupSupLower && editingSlot.supervisor?.trim().toLowerCase() === groupSupLower ? '' : editingSlot.supervisor,
                            supervisor2: groupSupLower && editingSlot.supervisor2?.trim().toLowerCase() === groupSupLower ? undefined : editingSlot.supervisor2,
                          });
                        }}
                        className={`w-full p-3 border rounded-lg text-left transition-all hover:border-[var(--color-primary-600)] hover:bg-blue-50 hover:[&_*]:text-gray-900 ${
                          editingSlot.projectId === project.id
                            ? 'border-[var(--color-primary-600)] bg-blue-50'
                            : 'border-[var(--color-border)]'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm truncate ${editingSlot.projectId === project.id ? 'text-gray-900' : 'text-[var(--color-text-900)]'}`}>{project.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                            project.course === '498'
                              ? 'bg-blue-100 text-blue-700 border border-blue-200'
                              : 'bg-purple-100 text-purple-700 border border-purple-200'
                          }`}>
                            CPIS-{project.course}
                          </span>
                        </div>
                        <div className={`text-xs ${editingSlot.projectId === project.id ? 'text-gray-600' : 'text-[var(--color-text-600)]'}`}>{project.groupId}</div>
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
            <Button onClick={handleSaveSlot} className="bg-(--color-primary-600)! hover:bg-(--color-primary-700)! text-white border-(--color-primary-600)">
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
              Automatically create slots and assign all unassigned projects
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <Label>Prefer preferred day</Label>
              <Switch checked={autoPreferDay} onCheckedChange={setAutoPreferDay} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Balance supervisor load</Label>
              <Switch checked={autoBalanceLoad} onCheckedChange={setAutoBalanceLoad} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Avoid back-to-back for same group</Label>
              <Switch checked={autoAvoidBackToBack} onCheckedChange={setAutoAvoidBackToBack} />
            </div>

            {committeePool.size === 0 ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg space-y-1">
                <p className="text-sm text-red-800 font-medium">No supervisors selected in the pool.</p>
                <p className="text-xs text-red-700">
                  Go to the <strong>Committee Supervisors</strong> panel and select which supervisors can evaluate committees before running auto-assign.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-1">
                <p className="text-sm text-blue-900">
                  This will automatically create slots and assign <strong>{getUnassignedProjects().length}</strong> unassigned project(s) using <strong>{committeePool.size}</strong> selected supervisor(s).
                </p>
                <p className="text-xs text-blue-700">
                  Slots are spread across days, committee members are capped at <strong>4 consecutive sessions</strong> per day, and the group's own supervisor is excluded.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutoAssignDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAutoAssign}
              disabled={committeePool.size === 0}
              className="bg-(--color-primary-600)! hover:bg-(--color-primary-700)! text-white border-(--color-primary-600) disabled:opacity-50 disabled:cursor-not-allowed"
            >
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
              className="bg-green-600! hover:bg-green-700! text-white border-green-600"
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