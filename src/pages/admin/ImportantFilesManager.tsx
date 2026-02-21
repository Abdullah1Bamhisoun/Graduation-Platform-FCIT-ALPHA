import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { FileText, Download, File, Plus, Edit, Trash2 } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';

interface FileItem {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'pdf' | 'zip' | 'doc';
  fileUrl: string | null;
  uploadedAt: string;
}

interface FileForm {
  name: string;
  description: string;
  size: string;
  type: 'pdf' | 'zip' | 'doc';
  fileUrl: string;
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export function ImportantFilesManager() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('important_files');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FileForm>({
    name: '',
    description: '',
    size: '',
    type: 'pdf',
    fileUrl: '',
  });

  useEffect(() => {
    fetch('/api/important-files')
      .then((r) => r.json())
      .then((data) => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'zip':
        return <File className="w-8 h-8 text-blue-500" />;
      case 'doc':
        return <FileText className="w-8 h-8 text-blue-600" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const handleOpenDialog = (fileId?: string) => {
    if (fileId) {
      const file = files.find(f => f.id === fileId);
      if (file) {
        setEditingId(fileId);
        setFormData({
          name: file.name,
          description: file.description,
          size: file.size,
          type: file.type,
          fileUrl: file.fileUrl ?? '',
        });
      }
    } else {
      setEditingId(null);
      setFormData({ name: '', description: '', size: '', type: 'pdf', fileUrl: '' });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
    setFormData({ name: '', description: '', size: '', type: 'pdf', fileUrl: '' });
  };

  const handleSaveFile = async () => {
    if (!formData.name || !formData.description) {
      toast.error('Please fill in name and description');
      return;
    }

    setSaving(true);
    try {
      const token = await getToken();
      const payload = {
        name: formData.name,
        description: formData.description,
        size: formData.size,
        type: formData.type,
        fileUrl: formData.fileUrl || null,
      };

      if (editingId) {
        const res = await fetch(`/api/important-files/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update file');
        setFiles(files.map(f => f.id === editingId ? { ...f, ...payload, fileUrl: payload.fileUrl } : f));
        toast.success('File updated successfully');
      } else {
        const res = await fetch('/api/important-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create file');
        const created: FileItem = await res.json();
        setFiles([created, ...files]);
        toast.success('File added successfully');
      }
      handleCloseDialog();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      const token = await getToken();
      const res = await fetch(`/api/important-files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete file');
      setFiles(files.filter(f => f.id !== id));
      toast.success('File deleted successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete file');
    }
  };

  const handleDownload = (file: FileItem) => {
    if (file.fileUrl) {
      window.open(file.fileUrl, '_blank');
    } else {
      toast.info('No download URL set for this file');
    }
  };

  return (
    <Layout user={user} pageTitle="Important Files Manager">
      {isLocked && <LockedBanner />}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          Manage essential documents, templates, and resources for graduation projects
        </p>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="primary" onClick={() => handleOpenDialog()} disabled={isLocked}>
              <Plus className="w-4 h-4 mr-2" />
              Add File
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit File Information' : 'Add New File'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update the file information below.' : 'Add a new file to the important files repository.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="fileName">File Name *</Label>
                <Input
                  id="fileName"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter file name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="fileDescription">Description *</Label>
                <Textarea
                  id="fileDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter file description"
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fileSize">File Size</Label>
                  <Input
                    id="fileSize"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="e.g., 2.4 MB"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="fileType">File Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as 'pdf' | 'zip' | 'doc' })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select file type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="zip">ZIP</SelectItem>
                      <SelectItem value="doc">DOC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="fileUrl">Download URL</Label>
                <Input
                  id="fileUrl"
                  value={formData.fileUrl}
                  onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
                  placeholder="https://... (leave empty if not yet available)"
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveFile} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Add File'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card className="p-12">
            <div className="text-center text-[var(--color-text-600)]">Loading files...</div>
          </Card>
        ) : files.length > 0 ? (
          files.map((file) => (
            <Card key={file.id} className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-lg">
                  {getFileIcon(file.type)}
                </div>
                <div className="flex-1">
                  <h2 className="text-[var(--color-text-900)] mb-2">{file.name}</h2>
                  <p className="text-[var(--color-text-600)] mb-4">{file.description}</p>
                  <div className="flex items-center gap-4 text-[var(--color-text-600)]">
                    <span className="uppercase">{file.type}</span>
                    {file.size && <><span>•</span><span>{file.size}</span></>}
                    <span>•</span>
                    <span>
                      Added {new Date(file.uploadedAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleDownload(file)} disabled={!file.fileUrl}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(file.id)} disabled={isLocked}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteFile(file.id)} disabled={isLocked}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <File className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-400)]" />
              <h3 className="text-[var(--color-text-900)] mb-2">No files available</h3>
              <p className="text-[var(--color-text-600)] mb-4">Add your first file to the repository.</p>
              <Button variant="primary" onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add File
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
