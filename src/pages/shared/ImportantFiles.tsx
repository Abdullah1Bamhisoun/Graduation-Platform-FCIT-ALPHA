import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { FileText, Download, File, Eye, Loader2 } from 'lucide-react';
import { getSignedUrl } from '../../services/storage';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useState, useEffect } from 'react';

interface FileItem {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'pdf' | 'zip' | 'doc';
  fileUrl: string | null;
  uploadedAt: string;
}

export function ImportantFiles() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);

  // File viewer modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalUrl, setViewModalUrl] = useState('');
  const [viewModalName, setViewModalName] = useState('');
  const [viewModalLoading, setViewModalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/important-files')
      .then((r) => r.json())
      .then((data) => setFiles(Array.isArray(data) ? data : []))
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, []);

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

  const getUrl = async (fileUrl: string): Promise<string> => {
    const isStoragePath = !fileUrl.startsWith('http');
    return isStoragePath ? await getSignedUrl(fileUrl) : fileUrl;
  };

  const handleView = async (file: FileItem) => {
    if (!file.fileUrl) return;
    setViewModalName(file.name);
    setViewModalUrl('');
    setViewModalOpen(true);
    setViewModalLoading(true);
    try {
      const url = await getUrl(file.fileUrl);
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const isPdf = ext === 'pdf' || file.type === 'pdf';
      setViewModalUrl(isPdf ? url : `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`);
    } catch {
      toast.error('Failed to open file');
      setViewModalOpen(false);
    } finally {
      setViewModalLoading(false);
    }
  };

  const handleDownload = async (file: FileItem) => {
    if (!file.fileUrl) return;
    try {
      const url = await getUrl(file.fileUrl);
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

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="Important Files">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Download essential documents, templates, and resources for your graduation project
        </p>
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
                  <h2 className="text-[var(--color-text-900)] mb-2">
                    {file.name}
                  </h2>
                  <p className="text-[var(--color-text-600)] mb-4">
                    {file.description}
                  </p>
                  <div className="flex items-center gap-4 text-[var(--color-text-600)]">
                    <span className="uppercase">{file.type}</span>
                    {file.size && (
                      <>
                        <span>•</span>
                        <span>{file.size}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>
                      Added {new Date(file.uploadedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                {file.fileUrl && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleView(file)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    <Button size="sm" onClick={() => handleDownload(file)}>
                      <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-12">
            <div className="text-center">
              <File className="w-16 h-16 mx-auto mb-4 text-[var(--color-text-400)]" />
              <h3 className="text-[var(--color-text-900)] mb-2">No files available</h3>
              <p className="text-[var(--color-text-600)]">
                Check back later or contact your supervisor for resources.
              </p>
            </div>
          </Card>
        )}
      </div>

      <div className="mt-8 p-6 !bg-white border border-blue-500 border-[1.5px] rounded-lg">
        <h3 className="text-blue-900 mb-2">Need More Resources?</h3>
        <p className="text-blue-700">
          If you need additional documents or templates, please contact your supervisor or the department administrator.
        </p>
      </div>

      {/* File Viewer Modal — full screen */}
      <Dialog open={viewModalOpen} onOpenChange={(open) => { if (!open) { setViewModalOpen(false); setViewModalUrl(''); } }}>
        <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !max-w-full !w-screen !h-screen !rounded-none flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-3 border-b border-gray-200 flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-blue-600" />
              {viewModalName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {viewModalLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading file...
              </div>
            ) : viewModalUrl ? (
              <iframe
                src={viewModalUrl}
                className="w-full h-full border-0"
                title={viewModalName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
