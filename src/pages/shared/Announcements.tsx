import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAnnouncementsForRole, createAnnouncement, deleteAnnouncement } from '../../services/announcements';
import { useUnreadAnnouncements } from '../../hooks/useUnreadAnnouncements';
import { Bell, Calendar as CalendarIcon, Clock, Plus, Trash2 } from 'lucide-react';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import type { Announcement, UserRole } from '../../types';
import { getSupervisorGroupsMine } from '../../services/groups';

interface SupervisorGroup {
  id: string;
  name: string;
}

export function Announcements() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const { markAllRead } = useUnreadAnnouncements(user);

  const isSupervisor = user?.activeRole === 'supervisor';

  // Supervisor group state
  const [supervisorGroups, setSupervisorGroups] = useState<SupervisorGroup[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', content: '', groupId: '', scheduledDate: '', scheduledTime: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    getAnnouncementsForRole(user.activeRole as UserRole, user.activeRole)
      .then(setAnnouncements)
      .finally(() => setLoading(false));
  }, [user?.id, user?.activeRole]);

  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  useEffect(() => {
    if (!isSupervisor) return;
    getSupervisorGroupsMine().then(setSupervisorGroups).catch(() => {});
  }, [isSupervisor]);

  const handlePost = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Please fill in title and content');
      return;
    }
    if (!formData.groupId) {
      toast.error('Please select a group');
      return;
    }
    setSaving(true);
    try {
      const scheduledFor = formData.scheduledDate
        ? new Date(`${formData.scheduledDate}T${formData.scheduledTime || '00:00'}`).toISOString()
        : undefined;

      await createAnnouncement({
        title:       formData.title,
        content:     formData.content,
        authorId:    user!.id,
        targetRoles: ['student'],
        groupId:     formData.groupId,
        scheduledFor,
      });
      const groupName = supervisorGroups.find((g) => g.id === formData.groupId)?.name;
      const baseMsg   = groupName ? `Announcement posted to ${groupName}` : 'Announcement posted';
      toast.success(scheduledFor
        ? `${baseMsg} — scheduled for ${new Date(scheduledFor).toLocaleString()}`
        : baseMsg,
      );
      setIsDialogOpen(false);
      setFormData({ title: '', content: '', groupId: '', scheduledDate: '', scheduledTime: '' });
      // Refresh list
      getAnnouncementsForRole(user!.activeRole as UserRole, user!.activeRole).then(setAnnouncements);
    } catch {
      toast.error('Failed to post announcement');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      toast.success('Announcement deleted');
    } catch {
      toast.error('Failed to delete announcement');
    }
  };

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Announcements"><div className="p-6">Loading announcements...</div></Layout>;

  return (
    <Layout user={user} pageTitle="Announcements">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          Stay updated with the latest announcements and important information
        </p>
        {isSupervisor && supervisorGroups.length > 0 && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                Post Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px]">
              <DialogHeader>
                <DialogTitle>Post Announcement</DialogTitle>
                <DialogDescription>
                  Select a group and write an announcement for its students.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="annGroup">Group *</Label>
                  <Select
                    value={formData.groupId}
                    onValueChange={(v) => setFormData({ ...formData, groupId: v })}
                  >
                    <SelectTrigger className="mt-1.5" id="annGroup">
                      <SelectValue placeholder="Select a group" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisorGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="annTitle">Title *</Label>
                  <Input
                    id="annTitle"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Announcement title"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="annContent">Content *</Label>
                  <Textarea
                    id="annContent"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Write your announcement here..."
                    rows={5}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Schedule for (optional)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <div className="flex-1">
                      <DatePicker
                        value={formData.scheduledDate}
                        onChange={(d) => setFormData({ ...formData, scheduledDate: d })}
                        placeholder="Date"
                        minDate={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="flex-1">
                      <TimePicker
                        value={formData.scheduledTime}
                        onChange={(t) => setFormData({ ...formData, scheduledTime: t })}
                        placeholder="Time"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-(--color-text-500) mt-1">
                    Leave empty to post immediately.
                  </p>
                </div>
                <p className="text-xs text-[var(--color-text-500)]">
                  This announcement will be visible only to students of the selected group.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handlePost} disabled={saving}>
                  {saving ? 'Posting...' : 'Post'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map((announcement) => (
            <Card key={announcement.id} className={`p-6 ${announcement.isScheduled ? 'border-dashed opacity-80' : ''}`}>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--color-primary-100)] rounded-lg flex-shrink-0">
                  <Bell className="w-6 h-6 text-[var(--color-primary-700)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-(--color-text-900)">{announcement.title}</h2>
                      {announcement.isScheduled && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3" />
                          Scheduled
                        </span>
                      )}
                    </div>
                    {isSupervisor && announcement.authorId === user.id && (
                      <button
                        onClick={() => handleDelete(announcement.id)}
                        className="flex-shrink-0 p-1 rounded hover:bg-red-100 text-red-400 hover:text-red-600 transition-colors"
                        title="Delete announcement"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[var(--color-text-700)] mb-4 whitespace-pre-line">
                    {announcement.content}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--color-text-600)]">
                    <div className="flex items-center gap-2">
                      {announcement.isScheduled ? <Clock className="w-4 h-4" /> : <CalendarIcon className="w-4 h-4" />}
                      <span>
                        {announcement.isScheduled ? 'Publishes ' : ''}
                        {new Date(announcement.publishedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span>•</span>
                    <span>Posted by {announcement.author}</span>
                    {announcement.courseName && (
                      <>
                        <span>•</span>
                        <span className="font-medium text-[var(--color-primary-700)]">
                          {announcement.courseName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <Bell className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-400)]" />
              <h3 className="text-[var(--color-text-900)] mb-2">No announcements</h3>
              <p className="text-[var(--color-text-600)]">
                There are no announcements at this time. Check back later for updates.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
