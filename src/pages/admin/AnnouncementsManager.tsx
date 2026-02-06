import { Layout } from '../../components/layout/Layout';
import { mockUsers, mockAnnouncements } from '../../lib/mock-data';
import { Bell, Plus, Edit, Trash2, Calendar as CalendarIcon } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { toast } from 'sonner';
import { UserRole } from '../../types';

interface AnnouncementForm {
  title: string;
  content: string;
  targetRoles: UserRole[];
}

export function AnnouncementsManager() {
  const user = mockUsers.admin;
  const [announcements, setAnnouncements] = useState(mockAnnouncements);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnnouncementForm>({
    title: '',
    content: '',
    targetRoles: ['student'],
  });

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

  const handleDeleteAnnouncement = (id: string) => {
    if (confirm('Are you sure you want to delete this announcement?')) {
      setAnnouncements(announcements.filter(a => a.id !== id));
      toast.success('Announcement deleted successfully');
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
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          Create and manage announcements for students and supervisors
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="primary"
              onClick={() => handleOpenDialog()}
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
            <Card key={announcement.id} className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--color-primary-100)] rounded-lg">
                  <Bell className="w-6 h-6 text-[var(--color-primary-700)]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[var(--color-text-900)] mb-2">
                    {announcement.title}
                  </h2>
                  <p className="text-[var(--color-text-700)] mb-4 whitespace-pre-line">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-4 text-[var(--color-text-600)]">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
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
                    <span>Posted by {announcement.author}</span>
                    <span>•</span>
                    <span className="capitalize">
                      {announcement.targetRoles.join(', ')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(announcement.id)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteAnnouncement(announcement.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
