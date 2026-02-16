import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Separator } from '../../components/ui/separator';
import { Bell, Lock, User as UserIcon, Mail, Building } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { getGroupForStudent, type GroupData } from '../../services/groups';

export function Settings() {
  const { user } = useAuth();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [group, setGroup] = useState<GroupData | null>(null);

  useEffect(() => {
    if (user?.role === 'student') {
      getGroupForStudent(user.id).then(setGroup);
    }
  }, [user]);

  const handleSaveProfile = () => {
    toast.success('Profile settings saved successfully');
  };

  const handleSaveNotifications = () => {
    toast.success('Notification preferences updated');
  };

  const handleChangePassword = () => {
    toast.success('Password change email sent to your address');
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
                defaultValue={user.email}
                className="mt-1.5"
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

            <Separator />

            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5">
                <Label>Push Notifications</Label>
                <p className="text-[var(--color-text-600)]">
                  Receive push notifications in your browser
                </p>
              </div>
              <Switch
                checked={pushNotifications}
                onCheckedChange={setPushNotifications}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5">
                <Label>Weekly Digest</Label>
                <p className="text-[var(--color-text-600)]">
                  Receive a weekly summary of your activity
                </p>
              </div>
              <Switch
                checked={weeklyDigest}
                onCheckedChange={setWeeklyDigest}
              />
            </div>

            <div className="pt-2">
              <Button onClick={handleSaveNotifications}>
                Save Preferences
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
              <Button variant="outline" onClick={handleChangePassword}>
                Change Password
              </Button>
            </div>

            <Separator className="my-6" />

            <div>
              <Label>Two-Factor Authentication</Label>
              <p className="text-[var(--color-text-600)] mt-1.5 mb-3">
                Add an extra layer of security to your account
              </p>
              <Button variant="outline" disabled>
                Enable 2FA (Coming Soon)
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
                  value={group?.courseNumber ? `CPCS-${group.courseNumber}` : ''}
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
      </div>
    </Layout>
  );
}
