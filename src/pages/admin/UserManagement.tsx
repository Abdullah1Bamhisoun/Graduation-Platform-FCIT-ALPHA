import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search, CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import { getPendingRegistrations, approveRegistration, rejectRegistration, subscribe, type PendingRegistration } from '../../lib/pending-registrations';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'supervisor' | 'admin';
  employeeNumber?: string;
  studentId?: string;
  status: 'active' | 'inactive';
}

const mockUsersList: User[] = [
  {
    id: '1',
    name: 'Abdullah Bamhisoun',
    email: 'abdullah.b@stu.kau.edu.sa',
    role: 'student',
    studentId: '2236500',
    status: 'active',
  },
  {
    id: '2',
    name: 'Abdulrahman Solymani',
    email: 'abdulrahman.s@stu.kau.edu.sa',
    role: 'student',
    studentId: '2236501',
    status: 'active',
  },
  {
    id: '3',
    name: 'Dr. Mohammed Al-Ahmed',
    email: 'mohammed.a@kau.edu.sa',
    role: 'supervisor',
    employeeNumber: 'EMP-2023-001',
    status: 'active',
  },
  {
    id: '4',
    name: 'Admin User',
    email: 'admin@kau.edu.sa',
    role: 'admin',
    employeeNumber: 'EMP-2020-100',
    status: 'active',
  },
];

export function AdminUserManagement() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>(mockUsersList);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'student' as User['role'],
    employeeNumber: '',
    studentId: '',
  });

  // Pending registrations state
  const [pendingRegs, setPendingRegs] = useState<PendingRegistration[]>([]);
  const [viewingReg, setViewingReg] = useState<PendingRegistration | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Load pending registrations and subscribe to changes
  useEffect(() => {
    getPendingRegistrations().then(setPendingRegs);
    return subscribe(() => {
      getPendingRegistrations().then(setPendingRegs);
    });
  }, []);

  if (!user) return null;

  const handleApprove = (reg: PendingRegistration) => {
    const approved = approveRegistration(reg.id);
    if (!approved) return;

    // Add to active users list
    const newUser: User = {
      id: `approved-${reg.id}`,
      name: reg.name,
      email: reg.email,
      role: reg.accountType,
      studentId: reg.accountType === 'student' ? reg.studentId : undefined,
      employeeNumber: reg.accountType === 'supervisor' ? reg.employeeNumber : undefined,
      status: 'active',
    };
    setUsers((prev) => [...prev, newUser]);

    toast.success(`${reg.name} has been approved and can now log in`);
    setIsViewDialogOpen(false);
    setViewingReg(null);
  };

  const handleReject = (reg: PendingRegistration) => {
    rejectRegistration(reg.id);
    toast.success(`${reg.name}'s registration has been rejected`);
    setIsViewDialogOpen(false);
    setViewingReg(null);
  };

  const handleAddUser = () => {
    if (!formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.role !== 'student' && !formData.employeeNumber) {
      toast.error('Employee number is required for supervisors and admins');
      return;
    }

    if (formData.role === 'student' && !formData.studentId) {
      toast.error('Student ID is required for students');
      return;
    }

    const newUser: User = {
      id: Date.now().toString(),
      name: formData.name,
      email: formData.email,
      role: formData.role,
      employeeNumber: formData.role !== 'student' ? formData.employeeNumber : undefined,
      studentId: formData.role === 'student' ? formData.studentId : undefined,
      status: 'active',
    };

    setUsers([...users, newUser]);
    toast.success('User added successfully');
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEditUser = () => {
    if (!editingUser) return;

    setUsers(users.map(u =>
      u.id === editingUser.id
        ? { ...u, ...formData }
        : u
    ));
    toast.success('User updated successfully');
    setIsDialogOpen(false);
    setEditingUser(null);
    resetForm();
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      setUsers(users.filter(u => u.id !== userId));
      toast.success('User deleted successfully');
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      employeeNumber: user.employeeNumber || '',
      studentId: user.studentId || '',
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'student',
      employeeNumber: '',
      studentId: '',
    });
    setEditingUser(null);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (user.studentId && user.studentId.includes(searchQuery)) ||
                         (user.employeeNumber && user.employeeNumber.includes(searchQuery));
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: string) => {
    const badges = {
      student: '!bg-white text-blue-600 border-[1.5px] border-blue-500',
      supervisor: '!bg-white text-purple-600 border-[1.5px] border-purple-500',
      admin: '!bg-white text-amber-600 border-[1.5px] border-amber-500',
    };
    return badges[role as keyof typeof badges];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Layout user={user} pageTitle="User Management">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          Manage system users, roles, and permissions
        </p>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
              <DialogDescription>
                {editingUser ? 'Update user information' : 'Create a new user account'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="userName">Full Name *</Label>
                <Input
                  id="userName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter full name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="userEmail">Email *</Label>
                <Input
                  id="userEmail"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@kau.edu.sa"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="userRole">Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({ ...formData, role: value as User['role'] })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.role === 'student' ? (
                <div>
                  <Label htmlFor="studentId">Student ID *</Label>
                  <Input
                    id="studentId"
                    value={formData.studentId}
                    onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                    placeholder="e.g., 2236500"
                    className="mt-1.5"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="employeeNumber">Employee Number *</Label>
                  <Input
                    id="employeeNumber"
                    value={formData.employeeNumber}
                    onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                    placeholder="e.g., EMP-2023-001"
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={editingUser ? handleEditUser : handleAddUser}>
                {editingUser ? 'Update User' : 'Add User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Approvals Section */}
      {pendingRegs.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-900)]">Pending Approvals</h2>
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-sm font-semibold">
              {pendingRegs.length}
            </span>
          </div>

          <div className="space-y-3">
            {pendingRegs.map((reg) => (
              <div
                key={reg.id}
                className="!bg-white rounded-xl border border-amber-200 shadow-sm p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-[var(--color-text-900)] font-medium truncate">{reg.name}</h3>
                    <p className="text-sm text-[var(--color-text-600)] truncate">{reg.email}</p>
                  </div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full capitalize text-sm ${getRoleBadge(reg.accountType)}`}>
                    {reg.accountType}
                  </span>
                  <span className="text-sm text-[var(--color-text-600)]">{reg.department}</span>
                  <span className="text-sm text-[var(--color-text-600)]">{formatDate(reg.submittedAt)}</span>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewingReg(reg);
                      setIsViewDialogOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApprove(reg)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(reg)}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Registration Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={(open) => {
        setIsViewDialogOpen(open);
        if (!open) setViewingReg(null);
      }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Registration Details</DialogTitle>
            <DialogDescription>
              Review all information submitted during registration
            </DialogDescription>
          </DialogHeader>
          {viewingReg && (
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-600)]">Full Name</p>
                    <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.name}</p>
                  </div>
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-600)]">Email</p>
                    <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.email}</p>
                  </div>
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-600)]">Account Type</p>
                    <p className="text-sm font-medium text-[var(--color-text-900)] capitalize">{viewingReg.accountType}</p>
                  </div>
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-600)]">Department</p>
                    <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.department}</p>
                  </div>
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-600)]">{viewingReg.accountType === 'student' ? 'Student ID' : 'Employee Number'}</p>
                    <p className="text-sm font-medium text-[var(--color-text-900)]">
                      {viewingReg.accountType === 'student' ? viewingReg.studentId : viewingReg.employeeNumber}
                    </p>
                  </div>
                  <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                    <p className="text-xs text-[var(--color-text-600)]">Submitted At</p>
                    <p className="text-sm font-medium text-[var(--color-text-900)]">{formatDate(viewingReg.submittedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Student Academic Info */}
              {viewingReg.accountType === 'student' && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-3">Academic Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-600)]">Course</p>
                      <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.course || '—'}</p>
                    </div>
                    <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                      <p className="text-xs text-[var(--color-text-600)]">Term</p>
                      <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.term || '—'}</p>
                    </div>
                    <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg col-span-2">
                      <p className="text-xs text-[var(--color-text-600)]">Group ID</p>
                      <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.groupId || '—'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Project Info */}
              {viewingReg.accountType === 'student' && (
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-3">Project Information</h4>
                  {viewingReg.teammateSubmittedIdea ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">Teammate has already submitted the project idea</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                        <p className="text-xs text-[var(--color-text-600)]">Project Name</p>
                        <p className="text-sm font-medium text-[var(--color-text-900)]">{viewingReg.projectName || '—'}</p>
                      </div>
                      <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                        <p className="text-xs text-[var(--color-text-600)]">Project Idea</p>
                        <p className="text-sm text-[var(--color-text-900)]">{viewingReg.projectIdea || '—'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsViewDialogOpen(false);
              setViewingReg(null);
            }}>
              Close
            </Button>
            {viewingReg && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(viewingReg)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  variant="primary"
                  onClick={() => handleApprove(viewingReg)}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-600)]" />
          <Input
            type="text"
            placeholder="Search by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="student">Students</SelectItem>
            <SelectItem value="supervisor">Supervisors</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="!bg-white rounded-xl border border-[var(--color-border)] shadow-sm">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--color-border)] text-[var(--color-text-600)]">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2">ID / Employee #</div>
          <div className="col-span-2">Actions</div>
        </div>

        <div className="divide-y divide-[var(--color-border)]">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-[var(--color-text-600)]">
              No users found matching your search criteria
            </div>
          ) : (
            filteredUsers.map((usr) => (
              <div
                key={usr.id}
                className="grid grid-cols-12 gap-4 p-4 hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                <div className="col-span-3 flex items-center">
                  <h3 className="text-[var(--color-text-900)]">{usr.name}</h3>
                </div>
                <div className="col-span-3 flex items-center">
                  <p className="text-[var(--color-text-600)]">{usr.email}</p>
                </div>
                <div className="col-span-2 flex items-center">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full capitalize ${getRoleBadge(usr.role)}`}>
                    {usr.role}
                  </span>
                </div>
                <div className="col-span-2 flex items-center">
                  <p className="text-[var(--color-text-900)]">
                    {usr.role === 'student' ? usr.studentId : usr.employeeNumber}
                  </p>
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(usr)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeleteUser(usr.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-5 gap-4">
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
          <p className="text-[var(--color-text-600)] mb-1">Admins</p>
          <p className="text-[var(--color-text-900)] text-xl font-semibold">{users.filter(u => u.role === 'admin').length}</p>
        </div>
      </div>
    </Layout>
  );
}
