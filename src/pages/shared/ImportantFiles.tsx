import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { FileText, Download, File } from 'lucide-react';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

interface FileItem {
  id: string;
  name: string;
  description: string;
  size: string;
  type: 'pdf' | 'zip' | 'doc';
  uploadedAt: string;
}

const importantFiles: FileItem[] = [
  {
    id: 'cpis-498-499-manual',
    name: 'CPIS-498 and CPIS-499 Manual',
    description: 'Complete manual and guidelines for CPIS-498 and CPIS-499 graduation projects',
    size: '2.4 MB',
    type: 'pdf',
    uploadedAt: '2025-09-01T10:00:00',
  },
  {
    id: 'report-template',
    name: 'CPIS498 Report Template LaTeX',
    description: 'LaTeX template for formatting your graduation project report',
    size: '156 KB',
    type: 'zip',
    uploadedAt: '2025-09-01T10:00:00',
  },
];

export function ImportantFiles() {
  const { user } = useAuth();

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

  const handleDownload = (file: FileItem) => {
    // In a real application, this would trigger the actual download
    console.log(`Downloading: ${file.name}`);
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
        {importantFiles.map((file) => (
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
                  <span>•</span>
                  <span>{file.size}</span>
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
              <Button
                onClick={() => handleDownload(file)}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-6 !bg-white border border-blue-500 border-[1.5px] rounded-lg">
        <h3 className="text-blue-900 mb-2">Need More Resources?</h3>
        <p className="text-blue-700">
          If you need additional documents or templates, please contact your supervisor or the department administrator.
        </p>
      </div>
    </Layout>
  );
}
