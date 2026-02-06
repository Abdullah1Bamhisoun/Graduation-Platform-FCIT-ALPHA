import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { mockUsers } from '../../lib/mock-data';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';

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
  const user = mockUsers.admin;
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
      <div className="mt-6 grid grid-cols-4 gap-4">
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Total Users</p>
          <p className="text-[var(--color-text-900)]">{users.length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Students</p>
          <p className="text-[var(--color-text-900)]">{users.filter(u => u.role === 'student').length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Supervisors</p>
          <p className="text-[var(--color-text-900)]">{users.filter(u => u.role === 'supervisor').length}</p>
        </div>
        <div className="!bg-white rounded-lg border border-[var(--color-border)] p-4">
          <p className="text-[var(--color-text-600)] mb-1">Admins</p>
          <p className="text-[var(--color-text-900)]">{users.filter(u => u.role === 'admin').length}</p>
        </div>
      </div>
    </Layout>
  );
}
