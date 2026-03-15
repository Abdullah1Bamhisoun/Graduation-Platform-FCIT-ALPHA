import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAllAnnouncements, deleteAnnouncement } from '../../services/announcements';
import { Bell, Plus, Edit, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { UserRole, Announcement } from '../../types';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';

interface AnnouncementForm {
  title: string;
  content: string;
  targetRoles: UserRole[];
}

export function AnnouncementsManager() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('announcements');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnnouncementForm>({
    title: '',
    content: '',
    targetRoles: ['student'],
  });

  useEffect(() => {
    getAllAnnouncements().then(setAnnouncements);
  }, []);

  if (!user) return null;

  const handleOpenDialog = (announcementId?: string) => {
    if (announcementId) {
      const announcement = announcements.find(a => a.id === announcementId);
      if (announcement) {
        setEditingId(announcementId);
        setFormData({
          title: announcement.title,
          content: announcement.content,
          targetRoles: announcement.targetRoles,
        });
      }
    } else {
      setEditingId(null);
      setFormData({
        title: '',
        content: '',
        targetRoles: ['student'],
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({
      title: '',
      content: '',
      targetRoles: ['student'],
    });
  };

  const handleSaveAnnouncement = () => {
    if (!formData.title || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.targetRoles.length === 0) {
      toast.error('Please select at least one target role');
      return;
    }

    if (editingId) {
      // Update existing announcement
      setAnnouncements(announcements.map(a =>
        a.id === editingId
          ? {
              ...a,
              title: formData.title,
              content: formData.content,
              targetRoles: formData.targetRoles,
            }
          : a
      ));
      toast.success('Announcement updated successfully');
    } else {
      // Create new announcement
      const newAnnouncement = {
        id: `ann${announcements.length + 1}`,
        title: formData.title,
        content: formData.content,
        author: user.name,
        publishedAt: new Date().toISOString(),
        targetRoles: formData.targetRoles,
      };
      setAnnouncements([newAnnouncement, ...announcements]);
      toast.success('Announcement published successfully');
    }

    handleCloseDialog();
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      try {
        await deleteAnnouncement(id);
        setAnnouncements(announcements.filter(a => a.id !== id));
        toast.success('Announcement deleted successfully');
      } catch (error) {
        toast.error('Failed to delete announcement');
      }
    }
  };

  const handleToggleRole = (role: UserRole) => {
    setFormData(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role],
    }));
  };

  return (
    <Layout user={user} pageTitle="Announcements Manager">
      {isLocked && <LockedBanner />}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-[var(--color-text-600)]">
          Create and manage announcements for students and supervisors
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="primary"
              onClick={() => handleOpenDialog()}
              disabled={isLocked}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingId ? 'Edit Announcement' : 'Create New Announcement'}
              </DialogTitle>
              <DialogDescription>
                {editingId
                  ? 'Update the announcement details below.'
                  : 'Create a new announcement to share important information.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter announcement title"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter announcement content"
                  rows={5}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="mb-3 block">Target Audience *</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="student"
                      checked={formData.targetRoles.includes('student')}
                      onCheckedChange={() => handleToggleRole('student')}
                    />
                    <label
                      htmlFor="student"
                      className="text-[var(--color-text-900)] cursor-pointer"
                    >
                      Students
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="supervisor"
                      checked={formData.targetRoles.includes('supervisor')}
                      onCheckedChange={() => handleToggleRole('supervisor')}
                    />
                    <label
                      htmlFor="supervisor"
                      className="text-[var(--color-text-900)] cursor-pointer"
                    >
                      Supervisors
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="admin"
                      checked={formData.targetRoles.includes('admin')}
                      onCheckedChange={() => handleToggleRole('admin')}
                    />
                    <label
                      htmlFor="admin"
                      className="text-[var(--color-text-900)] cursor-pointer"
                    >
                      Admins
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveAnnouncement}
              >
                {editingId ? 'Update' : 'Publish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {announcements.length > 0 ? (
          announcements.map((announcement) => (
            <Card key={announcement.id} className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-[var(--color-primary-100)] rounded-lg flex-shrink-0">
                  <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-primary-700)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-[var(--color-text-900)] text-base sm:text-lg leading-snug">
                      {announcement.title}
                    </h2>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(announcement.id)}
                        disabled={isLocked}
                        className="text-yellow-500 border-yellow-500 hover:bg-yellow-50 rounded-full h-7 px-2 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        disabled={isLocked}
                        className="text-white bg-red-600 hover:bg-red-700 rounded-full h-7 px-2 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:mr-1" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                  <p className="text-[var(--color-text-700)] mb-3 text-sm whitespace-pre-line">
                    {announcement.content}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-600)]">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5" />
                      <span>
                        {new Date(announcement.publishedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <span>•</span>
                    <span>By {announcement.author}</span>
                    <span>•</span>
                    <span className="capitalize">{announcement.targetRoles.join(', ')}</span>
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
              <p className="text-[var(--color-text-600)] mb-4">
                Create your first announcement to share important information.
              </p>
              <Button
                variant="primary"
                onClick={() => handleOpenDialog()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Announcement
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
