import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Search, CheckCircle, XCircle, Eye, Clock, Users, UserCheck, Trash2 } from 'lucide-react';
import { getPendingRegistrations, approveRegistration, rejectRegistration, subscribe, type PendingRegistration } from '../../lib/pending-registrations';
import { getProfilesByRole } from '../../services/profiles';
import { getAllGroups, assignSupervisor, updateGroupStatus, type GroupData } from '../../services/groups';
import type { User as ProfileUser } from '../../types';

// ── Local types ───────────────────────────────────────────────────────────────
interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'supervisor' | 'admin';
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

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('pending');

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterGender, setFilterGender] = useState('all');

  // ── Groups ────────────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [supervisors, setSupervisors] = useState<ProfileUser[]>([]);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupFilterDept, setGroupFilterDept] = useState('all');
  const [groupFilterStatus, setGroupFilterStatus] = useState('all');
  const [groupFilterGender, setGroupFilterGender] = useState('all');
  const [assigningGroup, setAssigningGroup] = useState<GroupData | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  // ── Delete User ───────────────────────────────────────────────────────────
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Pending Registrations ─────────────────────────────────────────────────
  const [pendingRegs, setPendingRegs] = useState<PendingRegistration[]>([]);
  const [viewingReg, setViewingReg] = useState<PendingRegistration | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // ── Load data ─────────────────────────────────────────────────────────────
  const reloadUsers = () => {
    Promise.all([
      getProfilesByRole('student'),
      getProfilesByRole('supervisor'),
      getProfilesByRole('admin'),
    ]).then(([s, sup, a]) => {
      setUsers([...s, ...sup, ...a].map(profileToUser));
    });
  };

  const reloadGroups = () => {
    getAllGroups().then(setGroups);
  };

  useEffect(() => {
    reloadUsers();
    reloadGroups();
    getProfilesByRole('supervisor').then(setSupervisors);
  }, []);

  useEffect(() => {
    getPendingRegistrations().then(setPendingRegs);
    return subscribe(() => getPendingRegistrations().then(setPendingRegs));
  }, []);

  if (!user) return null;

  // ── Handlers: registrations ───────────────────────────────────────────────
  const handleApprove = async (reg: PendingRegistration) => {
    try {
      await approveRegistration(reg.id);
      toast.success(`${reg.name} approved — they can now log in`);
      setIsViewDialogOpen(false);
      setViewingReg(null);
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  const handleReject = async (reg: PendingRegistration) => {
    try {
      await rejectRegistration(reg.id);
      toast.success(`${reg.name}'s registration rejected`);
      setIsViewDialogOpen(false);
      setViewingReg(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reject');
    }
  };

  // ── Handlers: delete user ─────────────────────────────────────────────────
  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
      const token = session.data.session?.access_token;
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete user');
      toast.success(`${deletingUser.name} has been deleted`);
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
      reloadUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  // ── Handlers: groups ──────────────────────────────────────────────────────
  const handleGroupStatus = async (groupId: string, status: 'approved' | 'rejected') => {
    try {
      await updateGroupStatus(groupId, status);
      toast.success(`Group ${status}`);
      reloadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update group');
    }
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

  // ── Filtered data ─────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.studentId ?? '').includes(q) ||
      (u.employeeNumber ?? '').includes(q);
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesDept = filterDept === 'all' || (u.department ?? '') === filterDept;
    const matchesGender = filterGender === 'all' || (u.gender ?? '') === filterGender;
    return matchesSearch && matchesRole && matchesDept && matchesGender;
  });

  const filteredGroups = groups.filter((g) => {
    const q = groupSearch.toLowerCase();
    const matchesSearch =
      (g.projectName ?? '').toLowerCase().includes(q) ||
      String(g.groupNumber ?? '').includes(q) ||
      (g.supervisorName ?? '').toLowerCase().includes(q) ||
      (g.groupCode ?? '').toLowerCase().includes(q);
    const matchesDept = groupFilterDept === 'all' || g.department === groupFilterDept;
    const matchesStatus = groupFilterStatus === 'all' || g.status === groupFilterStatus;
    const matchesGender = groupFilterGender === 'all' || (g.gender ?? '') === groupFilterGender;
    return matchesSearch && matchesDept && matchesStatus && matchesGender;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getRoleBadge = (role: string) => ({
    student:    '!bg-white text-blue-600 border-[1.5px] border-blue-500',
    supervisor: '!bg-white text-purple-600 border-[1.5px] border-purple-500',
    admin:      '!bg-white text-amber-600 border-[1.5px] border-amber-500',
  }[role] ?? '');

  const getStatusBadge = (status: string) => ({
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }[status] ?? 'bg-gray-100 text-gray-700');

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const tabClass = (t: ActiveTab) =>
    `px-5 py-2.5 rounded-lg font-medium transition-colors ${
      activeTab === t
        ? 'bg-[var(--color-primary-600)] text-white'
        : 'text-[var(--color-text-600)] hover:bg-[var(--color-surface-alt)]'
    }`;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout user={user} pageTitle="User Management">
      {/* Stats row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="!bg-white rounded-lg border border-amber-200 p-4">
          <p className="text-amber-600 mb-1">Pending Approvals</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{pendingRegs.length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Total Users</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{users.length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Students</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{users.filter(u => u.role === 'student').length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Supervisors</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{users.filter(u => u.role === 'supervisor').length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Total Groups</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{groups.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-[var(--color-surface-alt)] rounded-xl w-fit">
        <button className={tabClass('pending')} onClick={() => setActiveTab('pending')}>
          Pending Approvals
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
              {pendingRegs.map((reg) => (
                <div key={reg.id} className="!bg-white rounded-xl border border-amber-200 shadow-sm p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-[var(--color-text-900)] truncate">{reg.name}</h3>
                      <p className="text-sm text-[var(--color-text-600)] truncate">{reg.email}</p>
                    </div>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm capitalize ${getRoleBadge(reg.accountType)}`}>
                      {reg.accountType}
                    </span>
                    <span className="text-sm text-[var(--color-text-600)]">{reg.department}</span>
                    <span className="text-sm text-[var(--color-text-600)]">{formatDate(reg.submittedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button size="sm" variant="outline" onClick={() => { setViewingReg(reg); setIsViewDialogOpen(true); }}>
                      <Eye className="w-4 h-4 mr-1" />Details
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => handleApprove(reg)}>
                      <CheckCircle className="w-4 h-4 mr-1" />Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReject(reg)}>
                      <XCircle className="w-4 h-4 mr-1" />Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === 'users' && (
        <>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-600)]" />
              <Input placeholder="Search name, email, ID…" value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="supervisor">Supervisors</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                <SelectItem value="CS">CS</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="IS">IS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Gender" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="!bg-white rounded-xl border border-[var(--color-border)] shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 p-4 border-b border-[var(--color-border)] text-sm font-medium text-[var(--color-text-600)]">
              <div className="col-span-3">Full Name</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Department</div>
              <div className="col-span-1">Gender</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-1"></div>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-600)]">No users match your filters</div>
              ) : (
                filteredUsers.map((u) => (
                  <div key={u.id} className="grid grid-cols-12 gap-3 p-4 hover:bg-[var(--color-surface-alt)] transition-colors items-center">
                    <div className="col-span-3">
                      <p className="font-medium text-[var(--color-text-900)]">{u.name}</p>
                      <p className="text-xs text-[var(--color-text-600)]">
                        {u.role === 'student' ? u.studentId : u.employeeNumber}
                      </p>
                    </div>
                    <div className="col-span-3 text-sm text-[var(--color-text-600)] truncate">{u.email}</div>
                    <div className="col-span-2 text-sm text-[var(--color-text-600)]">{u.department || '—'}</div>
                    <div className="col-span-1 text-sm text-[var(--color-text-600)] capitalize">{u.gender || '—'}</div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm capitalize ${getRoleBadge(u.role)}`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="col-span-1">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs capitalize ${
                        u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.status}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {u.id !== user?.id && (
                        <button
                          title="Delete user"
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          onClick={() => { setDeletingUser(u); setIsDeleteDialogOpen(true); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
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
          </div>

          <div className="!bg-white rounded-xl border border-[var(--color-border)] shadow-sm">
            {/* Header */}
            <div className="grid grid-cols-12 gap-3 p-4 border-b border-[var(--color-border)] text-sm font-medium text-[var(--color-text-600)]">
              <div className="col-span-1">#</div>
              <div className="col-span-1">Dept</div>
              <div className="col-span-1">Gender</div>
              <div className="col-span-3">Project Name</div>
              <div className="col-span-1">Members</div>
              <div className="col-span-2">Supervisor</div>
              <div className="col-span-1">Status</div>
              <div className="col-span-2">Actions</div>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {filteredGroups.length === 0 ? (
                <div className="p-8 text-center text-[var(--color-text-600)]">No groups found</div>
              ) : (
                filteredGroups.map((g) => (
                  <div key={g.id} className="grid grid-cols-12 gap-3 p-4 hover:bg-[var(--color-surface-alt)] transition-colors items-center">
                    <div className="col-span-1 font-semibold text-[var(--color-text-900)]">
                      {g.groupNumber ?? '—'}
                    </div>
                    <div className="col-span-1 text-sm text-[var(--color-text-600)]">{g.department || '—'}</div>
                    <div className="col-span-1 text-sm text-[var(--color-text-600)] capitalize">{g.gender || '—'}</div>
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-[var(--color-text-900)] truncate">{g.projectName || '—'}</p>
                    </div>
                    <div className="col-span-1 text-sm text-center">
                      <span className={`inline-flex items-center justify-center px-2 py-1 rounded-full text-xs font-medium ${
                        g.membersCount >= 3 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {g.membersCount}/3
                      </span>
                    </div>
                    <div className="col-span-2 text-sm">
                      {g.supervisorName ? (
                        <span className="text-[var(--color-text-900)]">{g.supervisorName}</span>
                      ) : g.status === 'approved' ? (
                        <button
                          className="text-[var(--color-primary-600)] hover:underline text-xs"
                          onClick={() => { setAssigningGroup(g); setSelectedSupervisorId(''); }}
                        >
                          + Assign Supervisor
                        </button>
                      ) : (
                        <span className="text-[var(--color-text-600)]">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs capitalize ${getStatusBadge(g.status)}`}>
                        {g.status}
                      </span>
                    </div>
                    <div className="col-span-2 flex gap-1.5">
                      {g.status === 'pending' && (
                        <>
                          <Button size="sm" variant="primary" onClick={() => handleGroupStatus(g.id, 'approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleGroupStatus(g.id, 'rejected')}>
                            Reject
                          </Button>
                        </>
                      )}
                      {g.status === 'approved' && g.supervisorName && (
                        <button
                          className="text-xs text-[var(--color-text-600)] hover:text-[var(--color-primary-600)] hover:underline"
                          onClick={() => { setAssigningGroup(g); setSelectedSupervisorId(''); }}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Registration Details Dialog ── */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => { setIsViewDialogOpen(open); if (!open) setViewingReg(null); }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>Review all information submitted during registration</DialogDescription>
          </DialogHeader>
          {viewingReg && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Full Name', viewingReg.name],
                    ['Email', viewingReg.email],
                    ['Account Type', viewingReg.accountType],
                    ['Department', viewingReg.department],
                    [viewingReg.accountType === 'student' ? 'Student ID' : 'Employee Number',
                      viewingReg.accountType === 'student' ? viewingReg.studentId : viewingReg.employeeNumber],
                    ['Submitted At', formatDate(viewingReg.submittedAt)],
                  ].map(([label, val]) => (
                    <div key={label} className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-600)]">{label}</p>
                      <p className="text-sm font-medium text-[var(--color-text-900)] capitalize">{val || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
              {viewingReg.accountType === 'student' && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-3">Project Information</h4>
                  {viewingReg.teammateSubmittedIdea ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                      Teammate has already submitted the project idea
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[['Project Name', viewingReg.projectName], ['Project Idea', viewingReg.projectIdea]].map(([l, v]) => (
                        <div key={l} className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                          <p className="text-xs text-[var(--color-text-600)]">{l}</p>
                          <p className="text-sm text-[var(--color-text-900)]">{v || '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsViewDialogOpen(false); setViewingReg(null); }}>Close</Button>
            {viewingReg && (
              <>
                <Button variant="destructive" onClick={() => handleReject(viewingReg)}>
                  <XCircle className="w-4 h-4 mr-1" />Reject
                </Button>
                <Button variant="primary" onClick={() => handleApprove(viewingReg)}>
                  <CheckCircle className="w-4 h-4 mr-1" />Approve
                </Button>
              </>
            )}
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

      {/* ── Delete User Confirmation Dialog ── */}
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
            <Button variant="destructive" disabled={deleting} onClick={handleDeleteUser}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
