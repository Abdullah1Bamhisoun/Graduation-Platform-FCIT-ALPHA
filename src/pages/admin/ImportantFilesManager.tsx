import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { FileText, Download, File, Plus, Edit, Trash2, Upload, Eye } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { uploadImportantFile, getSignedUrl, deleteStorageFile } from '../../services/storage';

interface FileItem {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'pdf' | 'zip' | 'doc';
  fileUrl: string | null;
  courseId: string | null;
  courseCode: string | null;
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

function detectType(fileName: string): 'pdf' | 'zip' | 'doc' {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'zip' || ext === 'rar') return 'zip';
  return 'doc';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportantFilesManager() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('important_files');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FileForm>({
    name: '',
    description: '',
    size: '',
    type: 'pdf',
    fileUrl: '',
  });

  useEffect(() => {
    getToken().then((token) => {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        if (user?.activeRole) headers['X-Active-Role'] = user.activeRole;
      }
      fetch('/api/important-files', { headers })
        .then((r) => r.json())
        .then((data) => setFiles(Array.isArray(data) ? data : []))
        .catch(() => setFiles([]))
        .finally(() => setLoading(false));
    });
  }, [user?.activeRole]);

  if (!user) return null;

  const isCoordinator = user.activeRole === 'coordinator';

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':  return <FileText className="w-8 h-8 text-red-500" />;
      case 'zip':  return <File className="w-8 h-8 text-blue-500" />;
      case 'doc':  return <FileText className="w-8 h-8 text-blue-600" />;
      default:     return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const handleOpenDialog = (fileId?: string) => {
    setSelectedFile(null);
    if (fileId) {
      const file = files.find(f => f.id === fileId);
      if (file) {
        setEditingId(fileId);
        setFormData({ name: file.name, description: file.description, size: file.size, type: file.type, fileUrl: file.fileUrl ?? '' });
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
    setSelectedFile(null);
    setFormData({ name: '', description: '', size: '', type: 'pdf', fileUrl: '' });
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setFormData(prev => ({
      ...prev,
      name: prev.name || nameWithoutExt,
      size: formatBytes(file.size),
      type: detectType(file.name),
    }));
  };

  const handleViewFile = async (file: FileItem) => {
    if (!file.fileUrl) { toast.info('No file available'); return; }
    try {
      const isStoragePath = !file.fileUrl.startsWith('http');
      const url = isStoragePath ? await getSignedUrl(file.fileUrl) : file.fileUrl;
      window.open(url, '_blank');
    } catch {
      toast.error('Failed to open file');
    }
  };

  const handleSaveFile = async () => {
    if (!formData.name) {
      toast.error('Please fill in the file name');
      return;
    }
    if (!editingId && !selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setSaving(true);
    let storagePath = formData.fileUrl;

    try {
      if (selectedFile) {
        storagePath = await uploadImportantFile(selectedFile);
      }

      const token = await getToken();
      const payload = {
        name: formData.name,
        description: formData.description,
        size: formData.size,
        type: formData.type,
        fileUrl: storagePath || null,
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
      // Roll back the uploaded storage file if the DB step failed
      if (selectedFile && storagePath && storagePath !== formData.fileUrl) {
        deleteStorageFile(storagePath).catch(() => {});
      }
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

  const handleDownload = async (file: FileItem) => {
    if (!file.fileUrl) {
      toast.info('No file available for download');
      return;
    }
    try {
      // Storage path (no http prefix) → generate signed URL; full URL → use directly
      const isStoragePath = !file.fileUrl.startsWith('http');
      const url = isStoragePath ? await getSignedUrl(file.fileUrl) : file.fileUrl;
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download file');
    }
  };

  return (
    <Layout user={user} pageTitle="Important Files Manager">
      {isLocked && <LockedBanner />}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          {isCoordinator
            ? 'Manage essential documents and resources for your course'
            : 'Manage essential documents, templates, and resources for graduation projects'}
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
                {editingId ? 'Update the file details below.' : 'Upload a file and fill in the details below.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* ── File picker ── */}
              <div>
                <Label>File {!editingId && <span className="text-red-500">*</span>}</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                    e.target.value = '';
                  }}
                />
                {selectedFile ? (
                  <div className="mt-1.5 flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)]">
                    <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--color-text-900)] truncate text-sm">{selectedFile.name}</p>
                      <p className="text-[var(--color-text-600)] text-xs">{formatBytes(selectedFile.size)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div
                    className="mt-1.5 border-2 border-dashed border-[var(--color-border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--color-primary-600)] transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--color-text-400)]" />
                    <p className="text-[var(--color-text-600)] text-sm">
                      {editingId ? 'Click to replace the current file (optional)' : 'Click to browse and select a file'}
                    </p>
                  </div>
                )}
              </div>

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
                <Label htmlFor="fileDescription">Description</Label>
                <Textarea
                  id="fileDescription"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter file description (optional)"
                  rows={3}
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fileSize">File Size</Label>
                  <Input
                    id="fileSize"
                    value={formData.size}
                    onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                    placeholder="Auto-filled on upload"
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveFile} disabled={saving}>
                {saving ? 'Uploading...' : editingId ? 'Update' : 'Add File'}
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
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-[var(--color-text-900)]">{file.name}</h2>
                    {file.courseCode ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {file.courseCode}
                      </span>
                    ) : (
                      !isCoordinator && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          All Courses
                        </span>
                      )
                    )}
                  </div>
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
                  <Button variant="outline" size="sm" onClick={() => handleViewFile(file)} disabled={!file.fileUrl}>
                    <Eye className="w-4 h-4 mr-1" /> View
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownload(file)} disabled={!file.fileUrl}>
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                  <Button size="sm" onClick={() => handleOpenDialog(file.id)} disabled={isLocked} className="!bg-yellow-500 hover:!bg-yellow-600 !text-white !border-yellow-500">
                    <Edit className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button size="sm" onClick={() => handleDeleteFile(file.id)} disabled={isLocked} className="!bg-red-600 hover:!bg-red-700 !text-white !border-red-600">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
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
