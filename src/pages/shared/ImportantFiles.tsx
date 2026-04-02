import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { FileText, Download, File, Eye, Loader2, X } from 'lucide-react';
import { getSignedUrl } from '../../services/storage';
import { toast } from 'sonner';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '@/lib/api';

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

  // Popup viewer state
  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerLoading, setViewerLoading] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token ?? '';
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        if (user?.activeRole) headers['X-Active-Role'] = user.activeRole;
      }
      fetch(apiUrl('/api/important-files'), { headers })
        .then((r) => r.json())
        .then((d) => setFiles(Array.isArray(d) ? d : []))
        .catch(() => setFiles([]))
        .finally(() => setLoading(false));
    });
  }, [user?.activeRole]);

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
    setViewerFile(file);
    setViewerUrl('');
    setViewerLoading(true);
    try {
      const url = await getUrl(file.fileUrl);
      setViewerUrl(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`);
    } catch {
      toast.error('Failed to open file');
      setViewerFile(null);
    } finally {
      setViewerLoading(false);
    }
  };

  const handleCloseViewer = () => {
    setViewerFile(null);
    setViewerUrl('');
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

      {/* File list */}
      <div className="grid gap-4">
        {loading ? (
          <Card className="p-12">
            <div className="text-center text-[var(--color-text-600)]">Loading files...</div>
          </Card>
        ) : files.length > 0 ? (
          files.map((file) => (
            <Card key={file.id} className="p-4 sm:p-6">
              {/* ── DESKTOP (sm+): old layout — info left, buttons right ── */}
              <div className="hidden sm:flex items-start gap-4">
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
                {file.fileUrl && (
                  <div className="flex gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleView(file)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    <Button size="sm" onClick={() => handleDownload(file)}>
                      <Download className="w-4 h-4 mr-1" /> Download
                    </Button>
                  </div>
                )}
              </div>

              {/* ── MOBILE (< sm): new card — info top, action box below ── */}
              <div className="sm:hidden">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[var(--color-surface-alt)] rounded-lg flex items-center justify-center shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-[var(--color-text-900)] line-clamp-2 leading-snug mb-1">
                      {file.name}
                    </h2>
                    {file.description && (
                      <p className="text-xs text-[var(--color-text-600)] line-clamp-1 mb-1.5">
                        {file.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-400">
                      <span className="uppercase font-medium">{file.type}</span>
                      {file.size && <><span>•</span><span>{file.size}</span></>}
                      <span>•</span>
                      <span className="whitespace-nowrap">
                        {new Date(file.uploadedAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                {file.fileUrl && (
                  <div className="mt-3 border border-gray-200 rounded-lg bg-gray-50 p-2 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleView(file)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium border border-gray-300 bg-white hover:bg-gray-100 text-[var(--color-text-700)] transition-colors"
                    >
                      <Eye className="w-4 h-4" /> View
                    </button>
                    <button
                      onClick={() => handleDownload(file)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download
                    </button>
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

      {/* Portal popup viewer — rendered directly in document.body to avoid any CSS constraints */}
      {viewerFile && createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            background: '#fff',
          }}
        >
          {/* Modal box */}
          <div
            ref={viewerRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              background: '#fff',
              overflow: 'hidden',
            }}
          >
            {/* Toolbar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderBottom: '1px solid #e5e7eb',
              background: '#fff', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Eye size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {viewerFile.name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <Button size="sm" onClick={() => handleDownload(viewerFile)}>
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
                <Button variant="outline" size="sm" onClick={handleCloseViewer}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Viewer */}
            <div style={{ flex: 1, overflow: 'hidden', background: '#f3f4f6' }}>
              {viewerLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: '#6b7280' }}>
                  <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Loading file...
                </div>
              ) : (
                <iframe
                  src={viewerUrl}
                  title={viewerFile.name}
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                />
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="mt-8 p-6 !bg-white border-[1.5px] border-blue-500 rounded-lg">
        <h3 className="text-blue-900 mb-2">Need More Resources?</h3>
        <p className="text-blue-700">
          If you need additional documents or templates, please contact your supervisor or the department administrator.
        </p>
      </div>
    </Layout>
  );
}
