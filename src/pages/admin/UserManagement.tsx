import { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Search, CheckCircle, XCircle, Clock, Users, UserCheck, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { getPendingRegistrationsViaAPI, approveRegistration, rejectRegistration, subscribe, type PendingRegistration } from '../../lib/pending-registrations';
import { assignSupervisor, updateGroupStatus, deleteGroup, updateGroup, getGroupById, type GroupData } from '../../services/groups';
import type { User as ProfileUser } from '../../types';
import { apiUrl, apiFetch } from '@/lib/api';

// ── Local types ───────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'supervisor' | 'coordinator' | 'admin';
  employeeNumber?: string;
  studentId?: string;
  department?: string;
  gender?: string;
  status: 'active' | 'inactive';
}

function profileToUser(p: ProfileUser): User {
  return {
    id: p.id,
    name: p.name,
    email: p.email,
    role: p.role as User['role'],
    studentId: p.studentId,
    employeeNumber: p.employeeNumber,
    department: p.department,
    gender: p.gender,
    status: 'active',
  };
}

type ActiveTab = 'users' | 'groups' | 'pending';

// ─────────────────────────────────────────────────────────────────────────────

export function AdminUserManagement() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('groups');

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterGender, setFilterGender] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [filterCourse, setFilterCourse] = useState('all');

  const [isRepairingGroups, setIsRepairingGroups] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [createGroupForm, setCreateGroupForm] = useState({ projectName: '', projectDescription: '', courseId: '', department: '', gender: '', sectionNumber: '' });
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // ── Groups ────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [supervisors, setSupervisors] = useState<ProfileUser[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupFilterDept, setGroupFilterDept] = useState('all');
  const [groupFilterStatus, setGroupFilterStatus] = useState('all');
  const [groupFilterGender, setGroupFilterGender] = useState('all');
  const [groupFilterSemester, setGroupFilterSemester] = useState('all');
  const [groupFilterCourse, setGroupFilterCourse] = useState('all');
  const [assigningGroup, setAssigningGroup] = useState<GroupData | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [isBulkGroupProcessing, setIsBulkGroupProcessing] = useState(false);

  // ── Delete User ───────────────────────────────────────────────────────────
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Delete Group ──────────────────────────────────────────────────────────
  const [deletingGroup, setDeletingGroup] = useState<GroupData | null>(null);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // ── Edit Group ────────────────────────────────────────────────────────────
  const [editingGroup, setEditingGroup] = useState<GroupData | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [removingMemberIds, setRemovingMemberIds] = useState<string[]>([]);
  const [addingMemberIds, setAddingMemberIds] = useState<string[]>([]);
  const [removeSupervisor, setRemoveSupervisor] = useState(false);
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // ── Quick Assign Student to Group ─────────────────────────────────────────
  const [quickAssignStudent, setQuickAssignStudent] = useState<User | null>(null);
  const [quickAssignGroupId, setQuickAssignGroupId] = useState('');
  const [isQuickAssigning, setIsQuickAssigning] = useState(false);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [isCoordDropdownOpen, setIsCoordDropdownOpen] = useState(false);

  // ── Assign Coordinator ────────────────────────────────────────────────────
  const [assigningCoordinatorUser, setAssigningCoordinatorUser] = useState<User | null>(null);
  const [selectedCoordinatorCourseId, setSelectedCoordinatorCourseId] = useState('');
  const [isAssigningCoordinator, setIsAssigningCoordinator] = useState(false);
  const [courses, setCourses] = useState<{ id: string; code: string; name: string }[]>([]);
  // userId → courseCode for supervisors who have been assigned coordinator role
  const [coordinatorMap, setCoordinatorMap] = useState<Record<string, string>>({});

  // ── Pending Registrations ─────────────────────────────────────────────────
  const [pendingRegs, setPendingRegs] = useState<PendingRegistration[]>([]);
  const [expandedRegIds, setExpandedRegIds] = useState<Set<string>>(new Set());
  const [selectedRegIds, setSelectedRegIds] = useState<Set<string>>(new Set());
  const [regGroupCache, setRegGroupCache] = useState<Record<string, { groupNumber: number; groupCode: string; projectName: string } | null>>({});
  const [isApprovingId, setIsApprovingId] = useState<string | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // ── Loading ───────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);

  // ── Helpers: get auth token ───────────────────────────────────────────────
  const getToken = async () => {
    const { supabase: sb } = await import('../../lib/supabase');
    const { data } = await sb.auth.getSession();
    return data.session?.access_token ?? '';
  };

  // ── Load data ─────────────────────────────────────────────────────────────
  const reloadUsers = async () => {
    try {
      const token = await getToken();
      const fetchRole = async (role: string): Promise<ProfileUser[]> => {
        const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
        if (user?.activeRole) headers['X-Active-Role'] = user.activeRole;
        const res = await apiFetch(apiUrl(`/api/users?role=${encodeURIComponent(role)}`), { headers });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `Server error (${res.status})`);
        }
        return res.json();
      };
      const [s, sup, a] = await Promise.all([
        fetchRole('student'),
        fetchRole('supervisor'),
        fetchRole('admin'),
      ]);
      setUsers([...s, ...sup, ...a].map(profileToUser));
    } catch (err) {
      toast.error(`Failed to load users: ${err instanceof Error ? err.message : 'Server error'}`);
    }
  };

  const reloadGroups = async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      if (user?.activeRole) headers['X-Active-Role'] = user.activeRole;
      const res = await apiFetch(apiUrl('/api/groups'), { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error (${res.status})`);
      }
      const data: GroupData[] = await res.json();
      setGroups(data);
    } catch (err) {
      toast.error(`Failed to load groups: ${err instanceof Error ? err.message : 'Server error'}`);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      reloadUsers(),
      reloadGroups(),
      (async () => {
        try {
          const token = await getToken();
          const res = await apiFetch(apiUrl('/api/users?role=supervisor'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) setSupervisors(await res.json());
        } catch { /* non-fatal */ }
      })(),
      (async () => {
        try {
          const res = await apiFetch(apiUrl('/api/courses/active'));
          if (res.ok) setCourses(await res.json());
        } catch { /* non-fatal */ }
      })(),
      (async () => {
        try {
          const token = await getToken();
          const res = await apiFetch(apiUrl('/api/roles/coordinators'), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body = await res.json();
            const map: Record<string, string> = {};
            (body.coordinators ?? []).forEach((c: { userId: string; courseCode: string }) => {
              map[c.userId] = c.courseCode ?? 'Coordinator';
            });
            setCoordinatorMap(map);
          }
        } catch { /* non-fatal */ }
      })(),
    ]).finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = () => getPendingRegistrationsViaAPI(user?.activeRole).then(setPendingRegs);
    load();
    return subscribe(load);
  }, [user?.activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null;

  // ── Handlers: registrations ───────────────────────────────────────────────
  const handleApprove = async (reg: PendingRegistration) => {
    if (isApprovingId || isBulkProcessing) return;
    setIsApprovingId(reg.id);
    try {
      await approveRegistration(reg.id, user?.activeRole);
      toast.success(`${reg.name} approved — they can now log in`);
      setSelectedRegIds((prev) => { const n = new Set(prev); n.delete(reg.id); return n; });
      await Promise.all([reloadUsers(), reloadGroups()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setIsApprovingId(null);
    }
  };

  const handleReject = async (reg: PendingRegistration) => {
    try {
      await rejectRegistration(reg.id);
      toast.success(`${reg.name}'s registration rejected`);
      setSelectedRegIds((prev) => { const n = new Set(prev); n.delete(reg.id); return n; });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  const handleBulkApprove = async () => {
    if (isBulkProcessing || isApprovingId) return;
    const ids = [...selectedRegIds];
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    let approved = 0, failed = 0;
    for (const id of ids) {
      const reg = pendingRegs.find((r) => r.id === id);
      if (!reg) continue;
      try {
        await approveRegistration(id, user?.activeRole);
        approved++;
        setSelectedRegIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } catch {
        failed++;
      }
    }
    if (approved > 0) toast.success(`${approved} registration${approved > 1 ? 's' : ''} approved`);
    if (failed > 0) toast.error(`${failed} approval${failed > 1 ? 's' : ''} failed`);
    await Promise.all([reloadUsers(), reloadGroups()]);
    setIsBulkProcessing(false);
  };

  const handleBulkReject = async () => {
    if (isBulkProcessing || isApprovingId) return;
    const ids = [...selectedRegIds];
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    let rejected = 0, failed = 0;
    for (const id of ids) {
      const reg = pendingRegs.find((r) => r.id === id);
      if (!reg) continue;
      try {
        await rejectRegistration(id);
        rejected++;
        setSelectedRegIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      } catch {
        failed++;
      }
    }
    if (rejected > 0) toast.success(`${rejected} registration${rejected > 1 ? 's' : ''} rejected`);
    if (failed > 0) toast.error(`${failed} rejection${failed > 1 ? 's' : ''} failed`);
    setIsBulkProcessing(false);
  };

  const toggleExpanded = (id: string, reg: PendingRegistration) => {
    setExpandedRegIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) { n.delete(id); } else {
        n.add(id);
        if (reg.groupId && !(id in regGroupCache)) {
          getGroupById(reg.groupId).then((g) =>
            setRegGroupCache((c) => ({ ...c, [id]: g }))
          ).catch(() => setRegGroupCache((c) => ({ ...c, [id]: null })));
        }
      }
      return n;
    });
  };

  const toggleSelectReg = (id: string) => {
    setSelectedRegIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  // ── Handlers: assign coordinator ─────────────────────────────────────────
  const handleAssignCoordinator = async () => {
    if (!assigningCoordinatorUser || !selectedCoordinatorCourseId) return;
    setIsAssigningCoordinator(true);
    try {
      const token = await getToken();
      const res = await apiFetch(apiUrl('/api/roles/assign'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: assigningCoordinatorUser.id,
          roleName: 'coordinator',
          coordinatorCourseId: selectedCoordinatorCourseId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error (${res.status})`);
      }
      // Optimistically mark this supervisor as coordinator in the table
      const assignedCourse = courses.find((c) => c.id === selectedCoordinatorCourseId);
      const assignedUserId = assigningCoordinatorUser.id;
      setCoordinatorMap((prev) => ({
        ...prev,
        [assignedUserId]: assignedCourse?.code ?? 'Coordinator',
      }));
      toast.success(`${assigningCoordinatorUser.name} assigned as Coordinator`);
      setAssigningCoordinatorUser(null);
      setSelectedCoordinatorCourseId('');
      reloadUsers();
    } catch (err) {
      toast.error(`Failed to assign coordinator: ${err instanceof Error ? err.message : 'Server error'}`);
    } finally {
      setIsAssigningCoordinator(false);
    }
  };

  // ── Handlers: remove coordinator ─────────────────────────────────────────
  const handleRemoveCoordinator = async (u: User) => {
    try {
      const token = await getToken();
      const res = await apiFetch(apiUrl('/api/roles/revoke'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: u.id, roleName: 'coordinator' }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Server error (${res.status})`);
      }
      setCoordinatorMap((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      toast.success(`Coordinator role removed from ${u.name}`);
    } catch (err) {
      toast.error(`Failed to remove coordinator: ${err instanceof Error ? err.message : 'Server error'}`);
    }
  };

  // ── Handlers: delete user ─────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
      const token = session.data.session?.access_token;
      const res = await apiFetch(apiUrl(`/api/users/${deletingUser.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      let json: { error?: string } = {};
      try { json = JSON.parse(text); } catch { /* non-JSON response */ }
      if (!res.ok) throw new Error(json.error || `Server error (${res.status})`);

      const deletedId = deletingUser.id;
      toast.success(`${deletingUser.name} has been deleted`);
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      setUsers((prev) => prev.filter((u) => u.id !== deletedId));
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  // ── Handlers: delete group ────────────────────────────────────────────────
  const handleDeleteGroup = async () => {
    if (!deletingGroup) return;
    setIsDeletingGroup(true);
    try {
      await deleteGroup(deletingGroup.id);
      toast.success(`Group ${deletingGroup.groupCode} deleted`);
      setDeletingGroup(null);
      reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete group');
    } finally {
      setIsDeletingGroup(false);
    }
  };

  // ── Handlers: repair missing groups ──────────────────────────────────────
  const handleRepairGroups = async () => {
    setIsRepairingGroups(true);
    try {
      const token = await getToken();
      const res = await apiFetch(apiUrl('/api/auth/repair-groups'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Repair failed');
      const parts = [];
      if (body.created > 0) parts.push(`${body.created} group(s) created`);
      if (body.assigned > 0) parts.push(`${body.assigned} student(s) assigned to existing groups`);
      if (parts.length === 0) parts.push('No missing assignments found');
      toast.success(`Repair complete — ${parts.join(', ')}`);
      if (body.created > 0 || body.assigned > 0) reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Repair failed');
    } finally {
      setIsRepairingGroups(false);
    }
  };

  // ── Handlers: create group ────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!createGroupForm.projectName.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (!createGroupForm.gender) {
      toast.error('Gender is required');
      return;
    }
    setIsCreatingGroup(true);
    try {
      const token = await getToken();
      const res = await apiFetch(apiUrl('/api/groups'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Active-Role': user?.activeRole ?? 'admin',
        },
        body: JSON.stringify({
          projectName: createGroupForm.projectName.trim(),
          projectDescription: createGroupForm.projectDescription.trim(),
          courseId: createGroupForm.courseId || user?.coordinatorCourseId || undefined,
          department: createGroupForm.department || undefined,
          gender: createGroupForm.gender || undefined,
          sectionNumber: createGroupForm.sectionNumber ? parseInt(createGroupForm.sectionNumber, 10) : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to create group');
      toast.success(`Group "${body.group?.group_code}" created`);
      setIsCreateGroupOpen(false);
      setCreateGroupForm({ projectName: '', projectDescription: '', courseId: '', department: '', gender: '', sectionNumber: '' });
      reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // ── Handlers: edit group ──────────────────────────────────────────────────
  const handleSaveGroup = async () => {
    if (!editingGroup) return;
    setIsSavingGroup(true);
    try {
      await updateGroup(editingGroup.id, {
        projectName: editProjectName,
        removeMemberIds: removingMemberIds,
        addMemberIds: addingMemberIds,
        removeSupervisor,
      });
      toast.success('Group updated');

      // Optimistic update — reflect the changes instantly in the groups list
      setGroups((prev) => prev.map((g) => {
        if (g.id !== editingGroup.id) return g;
        const newMembers = g.members
          .filter((m) => !removingMemberIds.includes(m.id));
        return {
          ...g,
          projectName: editProjectName || g.projectName,
          supervisorId: removeSupervisor ? '' : g.supervisorId,
          supervisorName: removeSupervisor ? '' : g.supervisorName,
          members: newMembers,
          membersCount: newMembers.length,
        };
      }));

      setEditingGroup(null);
      setRemovingMemberIds([]);
      setAddingMemberIds([]);
      setRemoveSupervisor(false);
      reloadGroups(); // background refresh to pick up any server-side changes
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update group');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // ── Handlers: groups ──────────────────────────────────────────────────────
  const handleGroupStatus = async (groupId: string, status: 'approved' | 'rejected') => {
    try {
      await updateGroupStatus(groupId, status);
      toast.success(`Group ${status}`);
      setGroups((prev) => prev.map((g) => g.id === groupId ? { ...g, status } : g));
      reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update group');
    }
  };

  const toggleSelectGroup = (id: string) => {
    setSelectedGroupIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleExpandGroup = (id: string) => {
    setExpandedGroupIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleBulkGroupStatus = async (status: 'approved' | 'rejected') => {
    if (isBulkGroupProcessing) return;
    const ids = [...selectedGroupIds];
    if (ids.length === 0) return;
    setIsBulkGroupProcessing(true);
    let done = 0, failed = 0;
    for (const id of ids) {
      try {
        await updateGroupStatus(id, status);
        done++;
        setSelectedGroupIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
        setGroups((prev) => prev.map((g) => g.id === id ? { ...g, status } : g));
      } catch { failed++; }
    }
    if (done > 0) toast.success(`${done} group${done > 1 ? 's' : ''} ${status}`);
    if (failed > 0) toast.error(`${failed} failed`);
    setIsBulkGroupProcessing(false);
    reloadGroups();
  };

  const handleBulkDeleteGroups = async () => {
    if (isBulkGroupProcessing) return;
    const ids = [...selectedGroupIds];
    if (ids.length === 0) return;
    setIsBulkGroupProcessing(true);
    let done = 0, failed = 0;
    for (const id of ids) {
      try {
        await deleteGroup(id);
        done++;
        setSelectedGroupIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
        setGroups((prev) => prev.filter((g) => g.id !== id));
      } catch { failed++; }
    }
    if (done > 0) toast.success(`${done} group${done > 1 ? 's' : ''} deleted`);
    if (failed > 0) toast.error(`${failed} deletion${failed > 1 ? 's' : ''} failed`);
    setIsBulkGroupProcessing(false);
  };

  const handleAssignSupervisor = async () => {
    if (!assigningGroup || !selectedSupervisorId) return;
    try {
      await assignSupervisor(assigningGroup.id, selectedSupervisorId);
      toast.success('Supervisor assigned successfully');
      setAssigningGroup(null);
      setSelectedSupervisorId('');
      reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign supervisor');
    }
  };

  // ── Handler: quick-assign student to group ────────────────────────────────
  const handleQuickAssignStudent = async () => {
    if (!quickAssignStudent || !quickAssignGroupId) return;
    setIsQuickAssigning(true);
    try {
      await updateGroup(quickAssignGroupId, {
        projectName: groups.find((g) => g.id === quickAssignGroupId)?.projectName ?? '',
        removeMemberIds: [],
        addMemberIds: [quickAssignStudent.id],
        removeSupervisor: false,
      });
      toast.success(`${quickAssignStudent.name} assigned to group`);
      setQuickAssignStudent(null);
      setQuickAssignGroupId('');
      reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign student to group');
    } finally {
      setIsQuickAssigning(false);
    }
  };

  // ── Helpers ── extracted from group code {dept}_{section}_{courseNum}_{year}_{groupNum}_{genderCode}
  const getGroupDept     = (code: string) => code.split('_')[0] ?? '';
  const getGroupSemester = (code: string) => code.split('_')[1] ?? '';
  const getGroupCourse   = (code: string) => code.split('_')[2] ?? '';
  // Map studentId → semester / course via groups state
  const studentSemesterMap = new Map<string, string>();
  const studentCourseMap = new Map<string, string>();
  const groupedStudentIds = new Set<string>();
  groups.forEach((g) => {
    const sem = getGroupSemester(g.groupCode);
    const course = getGroupCourse(g.groupCode);
    g.members.forEach((m) => {
      studentSemesterMap.set(m.id, sem);
      studentCourseMap.set(m.id, course);
      groupedStudentIds.add(m.id);
    });
  });

  // ── Filtered data ─────────────────────────────────────────────────────────
  const debouncedSearchQuery = useDebounce(searchQuery, 200);
  const debouncedGroupSearch = useDebounce(groupSearch, 200);

  const filteredUsers = useMemo(() => users.filter((u) => {
    const q = debouncedSearchQuery.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.studentId ?? '').includes(q) ||
      (u.employeeNumber ?? '').includes(q);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesDept = filterDept === 'all' || (u.department ?? '') === filterDept;
    const matchesGender = filterGender === 'all' || (u.gender ?? '') === filterGender;
    const matchesSemester = filterSemester === 'all' || studentSemesterMap.get(u.id) === filterSemester;
    const matchesCourse = filterCourse === 'all' || studentCourseMap.get(u.id) === filterCourse;
    return matchesSearch && matchesRole && matchesDept && matchesGender && matchesSemester && matchesCourse;
  }), [users, debouncedSearchQuery, filterRole, filterDept, filterGender, filterSemester, filterCourse, studentSemesterMap, studentCourseMap]);

  const filteredGroups = useMemo(() => groups.filter((g) => {
    const q = debouncedGroupSearch.toLowerCase();
    const matchesSearch =
      (g.projectName ?? '').toLowerCase().includes(q) ||
      String(g.groupNumber ?? '').includes(q) ||
      (g.supervisorName ?? '').toLowerCase().includes(q) ||
      (g.groupCode ?? '').toLowerCase().includes(q);
    const matchesDept = groupFilterDept === 'all' || getGroupDept(g.groupCode) === groupFilterDept;
    const matchesStatus = groupFilterStatus === 'all' || g.status === groupFilterStatus;
    const matchesGender = groupFilterGender === 'all' || (g.gender ?? '') === groupFilterGender;
    const matchesSemester = groupFilterSemester === 'all' || getGroupSemester(g.groupCode) === groupFilterSemester;
    const matchesCourse = groupFilterCourse === 'all' || getGroupCourse(g.groupCode) === groupFilterCourse;
    return matchesSearch && matchesDept && matchesStatus && matchesGender && matchesSemester && matchesCourse;
  }), [groups, debouncedGroupSearch, groupFilterDept, groupFilterStatus, groupFilterGender, groupFilterSemester, groupFilterCourse]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getRoleBadge = (role: string) => ({
    student:    'bg-blue-50 text-blue-700 border border-blue-200',
    supervisor: 'bg-purple-50 text-purple-700 border border-purple-200',
    admin:      'bg-amber-50 text-amber-700 border border-amber-200',
  }[role] ?? 'bg-gray-50 text-gray-600 border border-gray-200');

  const getStatusBadge = (status: string) => ({
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }[status] ?? 'bg-gray-100 text-gray-700');

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const tabClass = (t: ActiveTab) =>
    `px-5 py-2.5 rounded-lg font-medium transition-colors border ${
      activeTab === t
        ? 'bg-[var(--color-primary-600)] text-white border-[var(--color-primary-600)]'
        : 'text-[var(--color-text-600)] hover:bg-[var(--color-surface-alt)] border-[var(--color-border)]'
    }`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout user={user} pageTitle="User Management">
      {isLocked && <LockedBanner />}
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="!bg-white rounded-lg border border-amber-200 p-4">
          <p className="text-amber-600 mb-1">Pending Approvals</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{pendingRegs.length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Total Users</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">
            {isLoading ? <span className="inline-block w-6 h-5 bg-gray-200 rounded animate-pulse" /> : users.length}
          </p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Students</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">
            {isLoading ? <span className="inline-block w-6 h-5 bg-gray-200 rounded animate-pulse" /> : users.filter(u => u.role === 'student').length}
          </p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Supervisors</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">
            {isLoading ? <span className="inline-block w-6 h-5 bg-gray-200 rounded animate-pulse" /> : users.filter(u => u.role === 'supervisor').length}
          </p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Total Groups</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">
            {isLoading ? <span className="inline-block w-6 h-5 bg-gray-200 rounded animate-pulse" /> : groups.length}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button className={tabClass('pending')} onClick={() => setActiveTab('pending')}>
          <span className="sm:hidden">Pending</span>
          <span className="hidden sm:inline">Pending Approvals</span>
          {pendingRegs.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-semibold">
              {pendingRegs.length}
            </span>
          )}
        </button>
        <button className={tabClass('users')} onClick={() => setActiveTab('users')}>
          <Users className="w-4 h-4 inline mr-1.5" />Users
        </button>
        <button className={tabClass('groups')} onClick={() => setActiveTab('groups')}>
          <UserCheck className="w-4 h-4 inline mr-1.5" />Groups
        </button>
      </div>

      {/* ── PENDING TAB ── */}
      {activeTab === 'pending' && (
        <>
          {pendingRegs.length === 0 ? (
            <div className="!bg-white rounded-xl border border-[var(--color-border)] p-12 text-center text-[var(--color-text-600)]">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No pending registrations</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* ── Bulk action toolbar ── */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-600)] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded accent-[var(--color-primary)]"
                    checked={selectedRegIds.size === pendingRegs.length && pendingRegs.length > 0}
                    onChange={(e) =>
                      setSelectedRegIds(e.target.checked ? new Set(pendingRegs.map((r) => r.id)) : new Set())
                    }
                  />
                  Select all
                </label>
                {selectedRegIds.size > 0 && (
                  <>
                    <span className="text-sm text-[var(--color-text-600)]">{selectedRegIds.size} selected</span>
                    <Button size="sm" variant="primary" disabled={isLocked || isBulkProcessing || !!isApprovingId} onClick={handleBulkApprove}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />
                      {isBulkProcessing ? 'Processing…' : 'Approve Selected'}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={isLocked || isBulkProcessing || !!isApprovingId} onClick={handleBulkReject}>
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      {isBulkProcessing ? 'Processing…' : 'Reject Selected'}
                    </Button>
                  </>
                )}
              </div>

              {/* ── Registration rows ── */}
              {pendingRegs.map((reg) => {
                const isExpanded = expandedRegIds.has(reg.id);
                const isSelected = selectedRegIds.has(reg.id);
                const cachedGroup = regGroupCache[reg.id];
                const hasExtra = reg.accountType === 'student' && (reg.projectName || reg.projectIdea || reg.groupId);
                return (
                  <div key={reg.id} className={`!bg-white rounded-xl border shadow-sm transition-colors ${isSelected ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20' : 'border-amber-200'}`}>
                    {/* ── Collapsed row ── */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded flex-shrink-0 accent-[var(--color-primary)] cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectReg(reg.id)}
                        />
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-[var(--color-text-900)] truncate">{reg.name}</h3>
                          <p className="text-sm text-[var(--color-text-600)] truncate">{reg.email}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs capitalize ${getRoleBadge(reg.accountType)}`}>
                              {reg.accountType}
                            </span>
                            {reg.department && <span className="text-xs text-[var(--color-text-600)]">{reg.department}</span>}
                            <span className="text-xs text-[var(--color-text-600)]">{formatDate(reg.submittedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button size="sm" variant="primary" onClick={() => handleApprove(reg)} disabled={isLocked || !!isApprovingId || isBulkProcessing}>
                          <CheckCircle className="w-4 h-4 mr-1" />{isApprovingId === reg.id ? 'Approving…' : 'Approve'}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleReject(reg)} disabled={isLocked || isBulkProcessing}>
                          <XCircle className="w-4 h-4 mr-1" />Reject
                        </Button>
                        {hasExtra && (
                          <button
                            onClick={() => toggleExpanded(reg.id, reg)}
                            className="p-1.5 rounded-lg text-[var(--color-text-600)] hover:bg-[var(--color-surface-alt)] transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Expanded details ── */}
                    {isExpanded && hasExtra && (
                      <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3">
                        {reg.groupId ? (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-[var(--color-text-600)] uppercase tracking-wide">Group Assignment</p>
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                              Joining an existing group — assigned automatically on approval.
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="p-2.5 bg-[var(--color-surface-alt)] rounded-lg">
                                <p className="text-xs text-[var(--color-text-600)]">Group Code</p>
                                <p className="text-sm font-medium text-[var(--color-text-900)]">
                                  {cachedGroup === undefined ? '…' : cachedGroup ? (cachedGroup.groupCode || `Group ${cachedGroup.groupNumber}`) : '—'}
                                </p>
                              </div>
                              <div className="p-2.5 bg-[var(--color-surface-alt)] rounded-lg">
                                <p className="text-xs text-[var(--color-text-600)]">Project</p>
                                <p className="text-sm font-medium text-[var(--color-text-900)]">
                                  {cachedGroup === undefined ? '…' : cachedGroup?.projectName || '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-[var(--color-text-600)] uppercase tracking-wide">Project Information</p>
                            {reg.projectName && (
                              <div className="p-2.5 bg-[var(--color-surface-alt)] rounded-lg">
                                <p className="text-xs text-[var(--color-text-600)]">Project Name</p>
                                <p className="text-sm text-[var(--color-text-900)]">{reg.projectName}</p>
                              </div>
                            )}
                            {reg.projectIdea && (
                              <div className="p-2.5 bg-[var(--color-surface-alt)] rounded-lg">
                                <p className="text-xs text-[var(--color-text-600)]">Project Idea</p>
                                <p className="text-sm text-[var(--color-text-900)]">{reg.projectIdea}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <>
          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px] max-w-[260px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-600)]" />
              <Input
                placeholder="Search name, email, ID…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm rounded-lg"
              />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-9 w-[136px] text-sm rounded-lg">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="supervisor">Supervisors</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="h-9 w-[136px] text-sm rounded-lg">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="IS">IS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="h-9 w-[120px] text-sm rounded-lg">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterSemester} onValueChange={setFilterSemester}>
              <SelectTrigger className="h-9 w-[148px] text-sm rounded-lg">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                <SelectItem value="01">First Semester</SelectItem>
                <SelectItem value="02">Second Semester</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="h-9 w-[120px] text-sm rounded-lg">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                <SelectItem value="498">GP 498</SelectItem>
                <SelectItem value="499">GP 499</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="!bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            {/* Desktop header */}
            <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
              <div className="col-span-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)]">Full Name</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)]">Email</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)]">Department</div>
              <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)]">Role</div>
              <div className="col-span-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)]">Status</div>
              <div className="col-span-2" />
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                <div className="py-12 text-center text-sm text-[var(--color-text-600)]">Loading users…</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-sm text-[var(--color-text-600)]">No users match your filters</div>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id}>
                    {/* Mobile card */}
                    <div className="sm:hidden px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text-900)] truncate">{u.name}</p>
                          <p className="text-xs text-[var(--color-text-600)] truncate">{u.email}</p>
                          <p className="text-xs text-[var(--color-text-600)] tabular-nums">{u.role === 'student' ? u.studentId : u.employeeNumber}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getRoleBadge(u.role)}`}>{u.role}</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{u.status}</span>
                          {u.role === 'student' && !groupedStudentIds.has(u.id) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">No Group</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {u.department && <span className="text-xs text-[var(--color-text-600)] bg-[var(--color-surface-alt)] px-2 py-0.5 rounded">{u.department}</span>}
                        {coordinatorMap[u.id] && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700">Coordinator · {coordinatorMap[u.id]}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {u.role === 'student' && !groupedStudentIds.has(u.id) && (
                          <button className="text-xs px-2 py-1 border border-blue-300 text-blue-700 hover:bg-blue-50 rounded" onClick={() => { setQuickAssignStudent(u); setQuickAssignGroupId(''); }} disabled={isLocked}>Assign Group</button>
                        )}
                        {u.role === 'supervisor' && (coordinatorMap[u.id] ? (
                          <button className="text-xs px-2 py-1 border border-orange-400 text-orange-600 hover:bg-orange-50 rounded" onClick={() => handleRemoveCoordinator(u)}>Remove Coordinator</button>
                        ) : (
                          <button className="text-xs px-2 py-1 border border-purple-300 text-purple-700 hover:bg-purple-50 rounded" onClick={() => { setAssigningCoordinatorUser(u); setSelectedCoordinatorCourseId(''); }}>Assign Coordinator</button>
                        ))}
                        {u.id !== user?.id && !(user?.activeRole === 'coordinator' && u.role === 'admin') && (
                          <button className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50" onClick={() => { setDeletingUser(u); setIsDeleteDialogOpen(true); }} disabled={isLocked}>
                            <Trash2 className="w-3 h-3" />Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3.5 items-center hover:bg-[var(--color-surface-alt)] transition-colors">
                      <div className="col-span-3 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-900)] truncate">{u.name}</p>
                        <p className="text-xs text-[var(--color-text-600)] mt-0.5 tabular-nums">{u.role === 'student' ? u.studentId : u.employeeNumber}</p>
                      </div>
                      <div className="col-span-2 min-w-0"><p className="text-sm text-[var(--color-text-700)] truncate">{u.email}</p></div>
                      <div className="col-span-2">
                        <p className="text-sm text-[var(--color-text-700)]">{u.department || '—'}</p>
                        {u.gender && <p className="text-xs text-[var(--color-text-600)] capitalize mt-0.5">{u.gender}</p>}
                      </div>
                      <div className="col-span-2 flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize w-fit ${getRoleBadge(u.role)}`}>{u.role}</span>
                        {coordinatorMap[u.id] && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block dark:bg-teal-400" />Coordinator · {coordinatorMap[u.id]}</span>}
                      </div>
                      <div className="col-span-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-50 text-gray-500 border border-gray-200'}`}>{u.status}</span>
                        {u.role === 'student' && !groupedStudentIds.has(u.id) && <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">No Group</span>}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        {u.role === 'student' && !groupedStudentIds.has(u.id) && <button className="text-xs px-2 py-1 border border-blue-300 text-blue-700 hover:bg-blue-50 transition-colors rounded whitespace-nowrap" onClick={() => { setQuickAssignStudent(u); setQuickAssignGroupId(''); }} disabled={isLocked}>Assign Group</button>}
                        {u.role === 'supervisor' && (coordinatorMap[u.id] ? (
                          <button className="text-xs px-2 py-1 border border-orange-400 text-orange-600 hover:bg-orange-50 transition-colors whitespace-nowrap rounded-lg" onClick={() => handleRemoveCoordinator(u)}>Remove Coordinator</button>
                        ) : (
                          <button className="text-xs px-2 py-1 border border-purple-300 text-purple-700 hover:bg-purple-50 transition-colors whitespace-nowrap rounded-lg" onClick={() => { setAssigningCoordinatorUser(u); setSelectedCoordinatorCourseId(''); }}>Assign Coordinator</button>
                        ))}
                        {u.id !== user?.id && !(user?.activeRole === 'coordinator' && u.role === 'admin') && (
                          <button className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => { setDeletingUser(u); setIsDeleteDialogOpen(true); }} disabled={isLocked}>
                            <Trash2 className="w-3.5 h-3.5" />Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ── GROUPS TAB ── */}
      {activeTab === 'groups' && (
        <>
          {/* Action buttons */}
          <div className="mb-4 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRepairGroups}
              disabled={isRepairingGroups}
              title="Creates missing groups for previously-approved students who don't have a group yet"
            >
              {isRepairingGroups ? 'Repairing…' : 'Repair Missing Groups'}
            </Button>
            <Button size="sm" onClick={() => setIsCreateGroupOpen(true)}>
              + Create Group
            </Button>
          </div>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-600)]" />
              <Input placeholder="Search group, project, supervisor…" value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={groupFilterDept} onValueChange={setGroupFilterDept}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="IS">IS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilterStatus} onValueChange={setGroupFilterStatus}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilterGender} onValueChange={setGroupFilterGender}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilterSemester} onValueChange={setGroupFilterSemester}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Semester" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                <SelectItem value="01">First Semester</SelectItem>
                <SelectItem value="02">Second Semester</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilterCourse} onValueChange={setGroupFilterCourse}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                <SelectItem value="498">GP 498</SelectItem>
                <SelectItem value="499">GP 499</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Select-all / bulk toolbar ── */}
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-[var(--color-text-600)] cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-[var(--color-primary)]"
                checked={selectedGroupIds.size === filteredGroups.length && filteredGroups.length > 0}
                onChange={(e) =>
                  setSelectedGroupIds(e.target.checked ? new Set(filteredGroups.map((g) => g.id)) : new Set())
                }
              />
              Select all
            </label>
            {selectedGroupIds.size > 0 && (
              <>
                <span className="text-sm text-[var(--color-text-600)]">{selectedGroupIds.size} selected</span>
                {filteredGroups.filter((g) => selectedGroupIds.has(g.id) && g.status === 'pending').length > 0 && (
                  <>
                    <Button size="sm" variant="primary" disabled={isLocked || isBulkGroupProcessing} onClick={() => handleBulkGroupStatus('approved')}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />{isBulkGroupProcessing ? 'Processing…' : 'Approve Selected'}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={isLocked || isBulkGroupProcessing} onClick={() => handleBulkGroupStatus('rejected')}>
                      <XCircle className="w-3.5 h-3.5 mr-1" />{isBulkGroupProcessing ? 'Processing…' : 'Reject Selected'}
                    </Button>
                  </>
                )}
                <button
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLocked || isBulkGroupProcessing}
                  onClick={handleBulkDeleteGroups}
                >
                  <Trash2 className="w-3.5 h-3.5" />{isBulkGroupProcessing ? 'Processing…' : 'Delete Selected'}
                </button>
              </>
            )}
          </div>

          {/* ── Group cards ── */}
          {isLoading ? (
            <div className="!bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-text-600)]">Loading groups…</div>
          ) : filteredGroups.length === 0 ? (
            <div className="!bg-white rounded-xl border border-[var(--color-border)] p-8 text-center text-[var(--color-text-600)]">No groups found</div>
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((g) => {
                const isSelected = selectedGroupIds.has(g.id);
                const isExpanded = expandedGroupIds.has(g.id);
                return (
                  <div key={g.id} className={`!bg-white rounded-xl border shadow-sm transition-colors ${isSelected ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/20' : 'border-[var(--color-border)]'}`}>
                    {/* ── Collapsed row ── */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded flex-shrink-0 accent-[var(--color-primary)] cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectGroup(g.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-sm text-[var(--color-text-900)] font-mono">{g.groupCode || '—'}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs capitalize ${getStatusBadge(g.status)}`}>{g.status}</span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${g.membersCount >= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{g.membersCount}/3</span>
                            {getGroupDept(g.groupCode) && <span className="text-xs text-[var(--color-text-600)]">{getGroupDept(g.groupCode)}</span>}
                          </div>
                          <p className="text-sm text-[var(--color-text-600)] mt-0.5 truncate">{g.projectName || 'No project name'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                        {g.status === 'pending' && (
                          <>
                            <Button size="sm" variant="primary" onClick={() => handleGroupStatus(g.id, 'approved')} disabled={isLocked || isBulkGroupProcessing}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleGroupStatus(g.id, 'rejected')} disabled={isLocked || isBulkGroupProcessing}>
                              <XCircle className="w-3.5 h-3.5 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        <button
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-yellow-400 text-yellow-900 hover:bg-yellow-500 transition-colors disabled:opacity-50"
                          onClick={() => { setEditingGroup(g); setEditProjectName(g.projectName || ''); setRemovingMemberIds([]); setAddingMemberIds([]); }}
                          disabled={isLocked}
                        >
                          <Pencil className="w-3.5 h-3.5" />Edit
                        </button>
                        <button
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                          onClick={() => setDeletingGroup(g)}
                          disabled={isLocked}
                        >
                          <Trash2 className="w-3.5 h-3.5" />Delete
                        </button>
                        <button
                          onClick={() => toggleExpandGroup(g.id)}
                          className="p-1.5 rounded-lg text-[var(--color-text-600)] hover:bg-[var(--color-surface-alt)] transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* ── Expanded details ── */}
                    {isExpanded && (
                      <div className="border-t border-[var(--color-border)] px-4 pb-4 pt-3 grid sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-600)] uppercase tracking-wide mb-2">Members</p>
                          {g.members.length > 0 ? (
                            <div className="space-y-1.5">
                              {g.members.map((m) => (
                                <div key={m.id} className="flex items-center justify-between p-2 bg-[var(--color-surface-alt)] rounded-lg">
                                  <div>
                                    <p className="text-sm font-medium text-[var(--color-text-900)]">{m.name || '—'}</p>
                                    {m.studentId && <p className="text-xs text-[var(--color-text-600)]">{m.studentId}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-[var(--color-text-400)]">No members</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-[var(--color-text-600)] uppercase tracking-wide mb-2">Supervisor</p>
                          {g.supervisorName ? (
                            <div className="flex items-center justify-between p-2 bg-[var(--color-surface-alt)] rounded-lg">
                              <p className="text-sm font-medium text-[var(--color-text-900)]">{g.supervisorName}</p>
                              <button className="text-xs text-[var(--color-primary-600)] hover:underline" onClick={() => { setAssigningGroup(g); setSelectedSupervisorId(''); }}>Change</button>
                            </div>
                          ) : (
                            <button className="text-sm text-[var(--color-primary-600)] hover:underline" onClick={() => { setAssigningGroup(g); setSelectedSupervisorId(''); }}>+ Assign supervisor</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Quick Assign Student to Group Dialog ── */}
      <Dialog open={!!quickAssignStudent} onOpenChange={(open) => { if (!open) { setQuickAssignStudent(null); setQuickAssignGroupId(''); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Assign Student to Group</DialogTitle>
            <DialogDescription>
              {quickAssignStudent?.name} has no group. Select a group to assign them to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Group</Label>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setIsGroupDropdownOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-white)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <span className={quickAssignGroupId ? 'text-[var(--color-text-900)]' : 'text-[var(--color-text-600)]'}>
                  {quickAssignGroupId
                    ? (() => { const g = groups.find((g) => g.id === quickAssignGroupId); return g ? `${g.groupCode} — ${g.projectName || 'No project name'} (${g.membersCount}/3 members)` : 'Choose a group…'; })()
                    : 'Choose a group…'}
                </span>
                <ChevronDown className={`size-4 text-[var(--color-text-600)] transition-transform ${isGroupDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isGroupDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsGroupDropdownOpen(false)} />
                  <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-white)] shadow-lg">
                    {groups.filter((g) => g.membersCount < 3).map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => { setQuickAssignGroupId(g.id); setIsGroupDropdownOpen(false); }}
                        className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-alt)] ${quickAssignGroupId === g.id ? 'text-[var(--color-primary-600)] font-medium' : 'text-[var(--color-text-900)]'}`}
                      >
                        {g.groupCode} — {g.projectName || 'No project name'} ({g.membersCount}/3 members)
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {groups.filter((g) => g.membersCount < 3).length === 0 && (
              <p className="text-sm text-[var(--color-text-600)] mt-2">All groups are full (3/3 members). Create a new group first.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setQuickAssignStudent(null); setQuickAssignGroupId(''); }}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!quickAssignGroupId || isQuickAssigning || isLocked}
              onClick={handleQuickAssignStudent}
            >
              {isQuickAssigning ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* ── Assign Supervisor Dialog ── */}
      <Dialog open={!!assigningGroup} onOpenChange={(open) => { if (!open) { setAssigningGroup(null); setSelectedSupervisorId(''); } }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Assign Supervisor</DialogTitle>
            <DialogDescription>
              Assign a supervisor to Group {assigningGroup?.groupNumber} — {assigningGroup?.projectName || 'No project name'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Supervisor</Label>
            <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Choose a supervisor…" />
              </SelectTrigger>
              <SelectContent>
                {supervisors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningGroup(null)}>Cancel</Button>
            <Button variant="primary" disabled={!selectedSupervisorId} onClick={handleAssignSupervisor}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Group Confirmation Dialog ── */}
      <Dialog open={!!deletingGroup} onOpenChange={(open) => { if (!open) setDeletingGroup(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>This will permanently delete the group and remove all its members. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {deletingGroup && (
            <div className="py-4">
              <p className="text-[var(--color-text-900)]">
                Delete <strong>{deletingGroup.groupCode}</strong>?
              </p>
              <p className="text-sm text-[var(--color-text-600)] mt-1">
                {deletingGroup.projectName || 'No project name'} · {deletingGroup.membersCount} member{deletingGroup.membersCount !== 1 ? 's' : ''}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingGroup(null)}>Cancel</Button>
            <Button variant="destructive" disabled={isLocked || isDeletingGroup} onClick={handleDeleteGroup}>
              {isDeletingGroup ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Group Dialog ── */}
      <Dialog open={!!editingGroup} onOpenChange={(open) => { if (!open) { setEditingGroup(null); setAddingMemberIds([]); setRemovingMemberIds([]); setRemoveSupervisor(false); } }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>{editingGroup?.groupCode}</DialogDescription>
          </DialogHeader>
          {editingGroup && (
            <div className="py-4 space-y-4">
              <div>
                <Label>Project Name</Label>
                <Input
                  className="mt-1"
                  value={editProjectName}
                  onChange={(e) => setEditProjectName(e.target.value)}
                />
              </div>

              {/* Supervisor */}
              {(editingGroup.supervisorName || editingGroup.supervisorId) && (
                <div>
                  <Label>Supervisor</Label>
                  <div className="mt-2 flex items-center justify-between p-2 bg-[var(--color-surface-alt)] rounded-lg">
                    <div>
                      <p className={`text-sm font-medium ${removeSupervisor ? 'line-through text-[var(--color-text-400)]' : 'text-[var(--color-text-900)]'}`}>
                        {editingGroup.supervisorName || '—'}
                      </p>
                    </div>
                    <button
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        removeSupervisor
                          ? 'bg-red-100 text-red-700'
                          : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                      }`}
                      onClick={() => setRemoveSupervisor((v) => !v)}
                    >
                      {removeSupervisor ? 'Undo' : 'Remove'}
                    </button>
                  </div>
                  {removeSupervisor && (
                    <p className="text-xs text-red-600 mt-1">Supervisor will be unassigned</p>
                  )}
                </div>
              )}

              {editingGroup.members.length > 0 && (
                <div>
                  <Label>Members</Label>
                  <div className="mt-2 space-y-2">
                    {editingGroup.members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 bg-[var(--color-surface-alt)] rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-900)]">{m.name}</p>
                          {m.studentId && <p className="text-xs text-[var(--color-text-600)]">{m.studentId}</p>}
                        </div>
                        <button
                          title="Remove member"
                          className={`p-1 rounded transition-colors text-xs px-2 py-1 ${
                            removingMemberIds.includes(m.id)
                              ? 'bg-red-100 text-red-700 line-through'
                              : 'hover:bg-red-50 text-gray-400 hover:text-red-600'
                          }`}
                          onClick={() =>
                            setRemovingMemberIds((prev) =>
                              prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                            )
                          }
                        >
                          {removingMemberIds.includes(m.id) ? 'Undo' : 'Remove'}
                        </button>
                      </div>
                    ))}
                  </div>
                  {removingMemberIds.length > 0 && (
                    <p className="text-xs text-red-600 mt-1">{removingMemberIds.length} member{removingMemberIds.length > 1 ? 's' : ''} will be removed</p>
                  )}
                </div>
              )}

              {/* Add student section */}
              {(() => {
                const currentIds = new Set([
                  ...(editingGroup?.members.map((m) => m.id) ?? []),
                  ...addingMemberIds,
                ]);
                const availableStudents = users.filter(
                  (u) => u.role === 'student' && !currentIds.has(u.id) && !groupedStudentIds.has(u.id)
                );
                return availableStudents.length > 0 ? (
                  <div>
                    <Label>Add Student</Label>
                    <Select
                      value=""
                      onValueChange={(id) => setAddingMemberIds((prev) => [...prev, id])}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a student to add…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStudents.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} {s.studentId ? `(${s.studentId})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {addingMemberIds.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {addingMemberIds.map((id) => {
                          const s = users.find((u) => u.id === id);
                          return s ? (
                            <div key={id} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-sm text-green-800">{s.name}</p>
                              <button
                                className="text-xs text-gray-400 hover:text-red-600"
                                onClick={() => setAddingMemberIds((prev) => prev.filter((i) => i !== id))}
                              >
                                Remove
                              </button>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>Cancel</Button>
            <Button variant="primary" disabled={isLocked || isSavingGroup} onClick={handleSaveGroup}>
              {isSavingGroup ? 'Saving…' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Coordinator Dialog ── */}
      <Dialog open={!!assigningCoordinatorUser} onOpenChange={(open) => { if (!open) { setAssigningCoordinatorUser(null); setSelectedCoordinatorCourseId(''); } }}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Assign Coordinator Role</DialogTitle>
            <DialogDescription>
              Select a course to assign <strong>{assigningCoordinatorUser?.name}</strong> as its coordinator.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Select Course</Label>
            <div className="relative mt-2">
              <button
                type="button"
                onClick={() => setIsCoordDropdownOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-white)] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
              >
                <span className={selectedCoordinatorCourseId ? 'text-[var(--color-text-900)]' : 'text-[var(--color-text-600)]'}>
                  {selectedCoordinatorCourseId
                    ? (() => { const c = courses.find((c) => c.id === selectedCoordinatorCourseId); return c ? `${c.code} — ${c.name}` : 'Choose a course…'; })()
                    : 'Choose a course…'}
                </span>
                <ChevronDown className={`size-4 text-[var(--color-text-600)] transition-transform ${isCoordDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {isCoordDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsCoordDropdownOpen(false)} />
                  <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-white)] shadow-lg">
                    {courses.length === 0 ? (
                      <p className="px-3 py-2.5 text-sm text-[var(--color-text-600)]">No courses available</p>
                    ) : (
                      courses.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setSelectedCoordinatorCourseId(c.id); setIsCoordDropdownOpen(false); }}
                          className={`w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-alt)] ${selectedCoordinatorCourseId === c.id ? 'text-[var(--color-primary-600)] font-medium' : 'text-[var(--color-text-900)]'}`}
                        >
                          {c.code} — {c.name}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningCoordinatorUser(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!selectedCoordinatorCourseId || selectedCoordinatorCourseId === '__none' || isAssigningCoordinator}
              onClick={handleAssignCoordinator}
            >
              {isAssigningCoordinator ? 'Assigning…' : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete User Confirmation Dialog ── */}
      {/* ── Create Group Dialog ─────────────────────────────────────────── */}
      <Dialog open={isCreateGroupOpen} onOpenChange={(open) => { setIsCreateGroupOpen(open); if (!open) setCreateGroupForm({ projectName: '', projectDescription: '', courseId: '', department: '', gender: '', sectionNumber: '' }); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>Manually create a new project group.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Project Name <span className="text-red-500">*</span></Label>
              <Input
                value={createGroupForm.projectName}
                onChange={(e) => setCreateGroupForm((f) => ({ ...f, projectName: e.target.value }))}
                placeholder="e.g. Smart Campus App"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Project Description</Label>
              <Input
                value={createGroupForm.projectDescription}
                onChange={(e) => setCreateGroupForm((f) => ({ ...f, projectDescription: e.target.value }))}
                placeholder="Brief description (optional)"
                className="mt-1"
              />
            </div>
            {/* Course — hidden for coordinator (auto-assigned) */}
            {user?.activeRole !== 'coordinator' && (
              <div>
                <Label>Course</Label>
                <Select value={createGroupForm.courseId} onValueChange={(v) => setCreateGroupForm((f) => ({ ...f, courseId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select course" /></SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.code.replace('_', '-')} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Department</Label>
                <Select value={createGroupForm.department} onValueChange={(v) => setCreateGroupForm((f) => ({ ...f, department: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="IS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CS">CS</SelectItem>
                    <SelectItem value="IS">IS</SelectItem>
                    <SelectItem value="IT">IT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={createGroupForm.gender} onValueChange={(v) => setCreateGroupForm((f) => ({ ...f, gender: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Section No.</Label>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={createGroupForm.sectionNumber}
                  onChange={(e) => setCreateGroupForm((f) => ({ ...f, sectionNumber: e.target.value }))}
                  placeholder="e.g. 13"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Group name preview */}
            {(createGroupForm.department || createGroupForm.gender || createGroupForm.sectionNumber) && (
              <div className="rounded-lg bg-[var(--color-surface-alt)] border border-[var(--color-border)] px-4 py-2.5 text-sm">
                <span className="text-[var(--color-text-600)] text-xs font-medium uppercase tracking-wide">Name preview</span>
                <p className="font-mono text-[var(--color-text-900)] mt-0.5 text-base tracking-wide">
                  {(createGroupForm.department || 'IS').toUpperCase()}
                  _
                  {String(createGroupForm.sectionNumber || '1').padStart(2, '0')}
                  _
                  <span className="text-[var(--color-text-600)]">XXX</span>
                  _
                  {new Date().getFullYear()}
                  _
                  <span className="text-[var(--color-text-600)]">XX</span>
                  _
                  {createGroupForm.gender === 'male' ? 'M' : createGroupForm.gender === 'female' ? 'F' : 'U'}
                </p>
                <p className="text-[var(--color-text-600)] text-xs mt-1">XXX = course number, XX = auto-assigned group number</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateGroupOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateGroup} disabled={isCreatingGroup || !createGroupForm.projectName.trim()}>
              {isCreatingGroup ? 'Creating…' : 'Create Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { setIsDeleteDialogOpen(open); if (!open) setDeletingUser(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deletingUser && (
            <div className="py-4">
              <p className="text-[var(--color-text-900)]">
                Are you sure you want to delete <strong>{deletingUser.name}</strong>?
              </p>
              <p className="text-sm text-[var(--color-text-600)] mt-1">
                {deletingUser.email} · <span className="capitalize">{deletingUser.role}</span>
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDeleteDialogOpen(false); setDeletingUser(null); }}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={isLocked || deleting} onClick={handleDeleteUser}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
