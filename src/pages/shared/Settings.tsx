import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Bell, Lock, User as UserIcon, Mail, Building, CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { getGroupForStudent, type GroupData } from '../../services/groups';

// ── Term constants ─────────────────────────────────────────────────────────────
const TERM_SEQUENCE = [
  { term: 'First Semester',  term_code: '01' },
  { term: 'Second Semester', term_code: '02' },
  { term: 'Summer',          term_code: '03' },
] as const;

interface CurrentTerm {
  term: string;
  year: number;
  term_code: string;
}

export function Settings() {
  const { user } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notifSaving, setNotifSaving]               = useState(false);
  const [group, setGroup] = useState<GroupData | null>(null);

  // ── Change Password dialog ────────────────────────────────────────────────
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword]               = useState('');
  const [confirmPassword, setConfirmPassword]       = useState('');
  const [showNew, setShowNew]                       = useState(false);
  const [showConfirm, setShowConfirm]               = useState(false);
  const [passwordLoading, setPasswordLoading]       = useState(false);

  // ── Term management (admin only) ─────────────────────────────────────────
  const [currentTerm, setCurrentTerm] = useState<CurrentTerm | null>(null);
  const [termLoading, setTermLoading] = useState(false);
  const [pendingTerm, setPendingTerm] = useState<CurrentTerm | null>(null);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);

  const isAdmin = user?.activeRole === 'admin';

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }, []);

  const fetchCurrentTerm = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/current-term');
      if (res.ok) setCurrentTerm(await res.json());
    } catch (_) {}
  }, []);

  // Load saved notification preferences from user metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      const meta = authUser?.user_metadata ?? {};
      if (meta.email_notifications !== undefined) setEmailNotifications(meta.email_notifications);
    });
  }, []);

  useEffect(() => {
    if (user?.role === 'student') {
      getGroupForStudent(user.id).then(setGroup);
    }
  }, [user]);

  useEffect(() => {
    if (user?.activeRole === 'admin' || user?.activeRole === 'coordinator') {
      fetchCurrentTerm();
    }
  }, [user?.activeRole, fetchCurrentTerm]);

  const computeAdjacentTerm = (direction: 'prev' | 'next'): CurrentTerm => {
    const base = currentTerm ?? { term: 'Second Semester', year: 2026, term_code: '02' };
    const idx = TERM_SEQUENCE.findIndex((t) => t.term === base.term);
    if (direction === 'next') {
      const nextIdx = (idx + 1) % TERM_SEQUENCE.length;
      const nextYear = nextIdx === 0 ? base.year + 1 : base.year;
      return { term: TERM_SEQUENCE[nextIdx].term, year: nextYear, term_code: TERM_SEQUENCE[nextIdx].term_code };
    } else {
      const prevIdx = (idx - 1 + TERM_SEQUENCE.length) % TERM_SEQUENCE.length;
      const prevYear = idx === 0 ? base.year - 1 : base.year;
      return { term: TERM_SEQUENCE[prevIdx].term, year: prevYear, term_code: TERM_SEQUENCE[prevIdx].term_code };
    }
  };

  const applyTermChange = async (term: CurrentTerm) => {
    setTermLoading(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/settings/current-term', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(term),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? `Error ${res.status}`);
      setCurrentTerm(term);
      if ((body as { migratedGroups?: number }).migratedGroups) {
        toast.success(`Term updated. ${(body as any).migratedGroups} group(s) migrated from CPIS-498 → CPIS-499.`);
      } else {
        toast.success(`Term changed to ${term.term} ${term.year}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change term');
    } finally {
      setTermLoading(false);
    }
  };

  const handleChangeTerm = (direction: 'prev' | 'next') => {
    const next = computeAdjacentTerm(direction);
    if (direction === 'next' && next.term_code === '02') {
      setPendingTerm(next);
      setShowMigrationDialog(true);
    } else {
      applyTermChange(next);
    }
  };

  const confirmMigration = async () => {
    setShowMigrationDialog(false);
    if (pendingTerm) {
      await applyTermChange(pendingTerm);
      setPendingTerm(null);
    }
  };

  const handleSaveProfile = () => {
    toast.success('Profile settings saved successfully');
  };

  const handleSaveNotifications = async () => {
    setNotifSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { email_notifications: emailNotifications },
      });
      if (error) throw error;
      toast.success('Notification preferences saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save preferences');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password changed successfully');
      setShowPasswordDialog(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="Settings" unreadCount={0}>
      <div className="space-y-6">
        {/* Profile Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <UserIcon className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-[var(--color-text-900)]">Profile Information</h2>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                defaultValue={user.name}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={user.email}
                disabled
                className="mt-1.5 bg-[var(--color-surface-alt)]"
              />
            </div>

            {user.role === 'student' && user.studentId && (
              <div>
                <Label htmlFor="studentId">Student ID</Label>
                <Input
                  id="studentId"
                  type="text"
                  value={user.studentId}
                  disabled
                  className="mt-1.5 bg-[var(--color-surface-alt)]"
                />
              </div>
            )}

            {(user.role === 'supervisor' || user.role === 'admin') && user.employeeNumber && (
              <div>
                <Label htmlFor="employeeNumber">Employee Number</Label>
                <Input
                  id="employeeNumber"
                  type="text"
                  value={user.employeeNumber}
                  disabled
                  className="mt-1.5 bg-[var(--color-surface-alt)]"
                />
              </div>
            )}

            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                type="text"
                defaultValue="Information Systems"
                disabled
                className="mt-1.5 bg-[var(--color-surface-alt)]"
              />
            </div>

            <div>
              <Label htmlFor="institution">Institution</Label>
              <Input
                id="institution"
                type="text"
                defaultValue="Faculty of Computing and Information Technology - King Abdulaziz University"
                disabled
                className="mt-1.5 bg-[var(--color-surface-alt)]"
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveProfile}>
                Save Changes
              </Button>
            </div>
          </div>
        </Card>

        {/* Notification Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-[var(--color-text-900)]">Notification Preferences</h2>
          </div>

          <div className="space-y-4 max-w-xl">
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5">
                <Label>Email Notifications</Label>
                <p className="text-[var(--color-text-600)]">
                  Receive email notifications for important updates
                </p>
              </div>
              <Switch
                checked={emailNotifications}
                onCheckedChange={setEmailNotifications}
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveNotifications} disabled={notifSaving}>
                {notifSaving ? 'Saving…' : 'Save Preferences'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Security Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-[var(--color-text-900)]">Security</h2>
          </div>

          <div className="space-y-4 max-w-xl">
            <div>
              <Label>Password</Label>
              <p className="text-[var(--color-text-600)] mt-1.5 mb-3">
                Change your password to keep your account secure
              </p>
              <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
                Change Password
              </Button>
            </div>
          </div>
        </Card>

        {/* Role-Specific Settings */}
        {user.role === 'student' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-[var(--color-text-900)]">Project Settings</h2>
            </div>

            <div className="space-y-4 max-w-xl">
              <div>
                <Label htmlFor="projectTitle">Project Title</Label>
                <Input
                  id="projectTitle"
                  type="text"
                  value={group?.projectName ?? ''}
                  disabled
                  className="mt-1.5 bg-[var(--color-surface-alt)]"
                  placeholder={group === null ? 'Loading...' : 'No project assigned'}
                />
              </div>

              <div>
                <Label htmlFor="supervisor">Supervisor</Label>
                <Input
                  id="supervisor"
                  type="text"
                  value={group?.supervisorName ?? ''}
                  disabled
                  className="mt-1.5 bg-[var(--color-surface-alt)]"
                  placeholder={group === null ? 'Loading...' : 'Not assigned yet'}
                />
              </div>

              <div>
                <Label htmlFor="course">Current Course</Label>
                <Input
                  id="course"
                  type="text"
                  value={group?.courseNumber ? `CPIS-${group.courseNumber}` : ''}
                  disabled
                  className="mt-1.5 bg-[var(--color-surface-alt)]"
                  placeholder={group === null ? 'Loading...' : '—'}
                />
              </div>
            </div>
          </Card>
        )}

        {user.role === 'supervisor' && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-[var(--color-text-900)]">Review Preferences</h2>
            </div>

            <div className="space-y-4 max-w-xl">
              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5">
                  <Label>Auto-notify students</Label>
                  <p className="text-[var(--color-text-600)]">
                    Automatically notify students when reviews are completed
                  </p>
                </div>
                <Switch defaultChecked={true} />
              </div>

              <Separator />

              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5">
                  <Label>Reminder for pending reviews</Label>
                  <p className="text-[var(--color-text-600)]">
                    Receive reminders for submissions awaiting review
                  </p>
                </div>
                <Switch defaultChecked={true} />
              </div>

              <div className="pt-2">
                <Button onClick={handleSaveNotifications}>
                  Save Preferences
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ── Term Management (admin / coordinator) ──────────────────────── */}
        {(user.activeRole === 'admin' || user.activeRole === 'coordinator') && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <CalendarDays className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-[var(--color-text-900)]">Term Management</h2>
            </div>
            <p className="text-[var(--color-text-600)] text-sm mb-5">
              {isAdmin
                ? 'Set the current academic term. Advancing to Second Semester automatically migrates all CPIS-498 groups to CPIS-499.'
                : 'The current academic term for the platform.'}
            </p>

            <div className="flex items-center gap-4 border border-[var(--color-border)] rounded-xl px-6 py-4 bg-[var(--color-surface-alt)] max-w-md">
              {isAdmin && (
                <button
                  onClick={() => handleChangeTerm('prev')}
                  disabled={termLoading}
                  className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-600)] hover:text-[var(--color-text-900)] disabled:opacity-40 transition-colors px-3 py-1.5 rounded-lg hover:bg-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
              )}

              <div className="flex-1 text-center">
                <p className="text-xs text-[var(--color-text-600)] uppercase tracking-widest font-medium">Current Term</p>
                {currentTerm ? (
                  <p className="text-xl font-bold text-[var(--color-text-900)] mt-0.5">
                    {currentTerm.term} {currentTerm.year}
                  </p>
                ) : (
                  <div className="h-7 w-44 bg-gray-200 rounded animate-pulse mt-0.5 mx-auto" />
                )}
              </div>

              {isAdmin && (
                <button
                  onClick={() => handleChangeTerm('next')}
                  disabled={termLoading}
                  className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-600)] hover:text-[var(--color-text-900)] disabled:opacity-40 transition-colors px-3 py-1.5 rounded-lg hover:bg-white"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </Card>
        )}

        {/* ── Change Password Dialog ─────────────────────────────────────── */}
        <Dialog open={showPasswordDialog} onOpenChange={(open) => {
          if (!open) { setShowPasswordDialog(false); setNewPassword(''); setConfirmPassword(''); }
        }}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>Enter and confirm your new password below.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-600)]"
                    tabIndex={-1}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-600)]"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordDialog(false)} disabled={passwordLoading}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword} disabled={passwordLoading}>
                {passwordLoading ? 'Saving…' : 'Change Password'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Migration Confirmation Dialog ──────────────────────────────── */}
        <Dialog open={showMigrationDialog} onOpenChange={(open) => { if (!open) { setShowMigrationDialog(false); setPendingTerm(null); } }}>
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Advance to Second Semester?</DialogTitle>
              <DialogDescription>
                Changing to <strong>{pendingTerm?.term} {pendingTerm?.year}</strong> will automatically migrate
                all existing CPIS-498 groups to CPIS-499. Their course, course number, and group codes will be updated.
                This cannot be automatically undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowMigrationDialog(false); setPendingTerm(null); }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirmMigration} disabled={termLoading}>
                {termLoading ? 'Applying…' : 'Confirm & Migrate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
