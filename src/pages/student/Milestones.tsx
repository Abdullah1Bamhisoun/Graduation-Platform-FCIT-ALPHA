import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../lib/AuthContext';
import { getMilestonesByStudentWithStatus } from '../../services/milestones';
import { getSubmissionByMilestoneAndGroup } from '../../services/submissions';
import { getGroupForStudent, GroupData } from '../../services/groups';
import { getSignedUrl } from '../../services/storage';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Calendar, FileText, X, Download, Eye, Loader2 } from 'lucide-react';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { Milestone, Submission } from '../../types';
import { toast } from 'sonner';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentMilestones() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLocked } = useLockStatus('submissions');
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null);
  const [drawerSubmission, setDrawerSubmission] = useState<Submission | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  // File viewer modal state
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewModalUrl, setViewModalUrl] = useState('');
  const [viewModalName, setViewModalName] = useState('');
  const [viewModalLoading, setViewModalLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMilestonesByStudentWithStatus(user.id),
      getGroupForStudent(user.id),
    ]).then(([ms, g]) => {
      setMilestones(ms);
      setGroup(g);
    }).finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedMilestone || !group) {
      setDrawerSubmission(null);
      return;
    }
    getSubmissionByMilestoneAndGroup(selectedMilestone.id, group.id)
      .then(s => setDrawerSubmission(s ?? null));
  }, [selectedMilestone, group]);

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const url = await getSignedUrl(filePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    } catch {
      toast.error('Failed to get download link');
    }
  };

  const handleViewFile = async (filePath: string, fileName: string) => {
    setViewModalName(fileName);
    setViewModalUrl('');
    setViewModalOpen(true);
    setViewModalLoading(true);
    try {
      const url = await getSignedUrl(filePath);
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      setViewModalUrl(
        ext === 'pdf'
          ? url
          : `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      );
    } catch {
      toast.error('Failed to open file');
      setViewModalOpen(false);
    } finally {
      setViewModalLoading(false);
    }
  };

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Chapter Submissions"><div className="p-6">Loading...</div></Layout>;

  // Filter out weekly reports - only show chapter submissions
  const chapterMilestones = milestones.filter(m => m.type !== 'weekly-report');

  return (
    <Layout user={user} pageTitle="Chapter Submissions">
      {isLocked && <LockedBanner />}

      <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">

        {/* ── Desktop table header (hidden on mobile) ── */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)]">
          <div className="col-span-4">Milestone</div>
          <div className="col-span-2">Course</div>
          <div className="col-span-3">Due Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1">Action</div>
        </div>

        {/* ── Rows ── */}
        <div className="divide-y divide-[var(--color-border)]">
          {chapterMilestones.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No chapter submissions yet</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">Milestones will appear here once configured by your coordinator.</p>
            </div>
          )}

          {chapterMilestones.map((milestone) => (
            <div
              key={milestone.id}
              className="cursor-pointer hover:bg-[var(--color-surface-alt)] transition-colors"
              onClick={() => setSelectedMilestone(milestone)}
            >
              {/* ── Mobile card layout ── */}
              <div className="sm:hidden p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--color-text-900)] leading-snug">{milestone.name}</h3>
                    {milestone.lastAction && (
                      <p className="text-xs text-[var(--color-text-600)] mt-0.5">{milestone.lastAction}</p>
                    )}
                  </div>
                  <StatusBadge status={milestone.status} />
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--color-text-600)]">
                  <span>{milestone.course}</span>
                  <span>Due: {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  {milestone.status === 'draft' || milestone.status === 'changes-requested' ? (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={isLocked}
                      onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                    >
                      Submit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>

              {/* ── Desktop table row ── */}
              <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-4 items-center">
                <div className="col-span-4">
                  <h3 className="text-sm font-medium text-[var(--color-text-900)]">{milestone.name}</h3>
                  {milestone.lastAction && (
                    <p className="text-xs text-[var(--color-text-600)] mt-0.5">{milestone.lastAction}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <span className="text-sm text-[var(--color-text-900)]">{milestone.course}</span>
                </div>
                <div className="col-span-3">
                  <p className="text-sm text-[var(--color-text-900)]">
                    {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-[var(--color-text-600)]">
                    Opens: {new Date(milestone.openDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div className="col-span-2">
                  <StatusBadge status={milestone.status} />
                </div>
                <div className="col-span-1" onClick={(e) => e.stopPropagation()}>
                  {milestone.status === 'draft' || milestone.status === 'changes-requested' ? (
                    <Button
                      size="sm"
                      disabled={isLocked}
                      onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                    >
                      Submit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── File Viewer Modal — full screen ── */}
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

      {/* ── Detail Drawer ── */}
      {selectedMilestone && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedMilestone(null)}
          />
          {/* Full-width on mobile, 600px on sm+ */}
          <div className="fixed right-0 top-0 h-full w-full sm:w-[520px] lg:w-[600px] bg-[var(--color-surface-white)] shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] px-4 sm:px-6 py-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--color-text-900)] pr-4 leading-snug">{selectedMilestone.name}</h2>
              <button
                onClick={() => setSelectedMilestone(null)}
                className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Status */}
              <div>
                <label className="text-[var(--color-text-600)] mb-2 block text-xs font-medium uppercase tracking-wide">Status</label>
                <StatusBadge status={selectedMilestone.status} />
              </div>

              {/* Timeline */}
              <div>
                <label className="text-[var(--color-text-600)] mb-2 block text-xs font-medium uppercase tracking-wide">Timeline</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[var(--color-text-600)] flex-shrink-0" />
                    <p className="text-sm text-[var(--color-text-900)]">Opens: {new Date(selectedMilestone.openDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-[var(--color-text-600)] flex-shrink-0" />
                    <p className="text-sm text-[var(--color-text-900)]">Due: {new Date(selectedMilestone.dueDate).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {selectedMilestone.description && (
                <div>
                  <label className="text-[var(--color-text-600)] mb-2 block text-xs font-medium uppercase tracking-wide">Description</label>
                  <p className="text-sm text-[var(--color-text-900)]">{selectedMilestone.description}</p>
                </div>
              )}

              {/* Rubric Preview */}
              {selectedMilestone.rubric && (
                <div>
                  <label className="text-[var(--color-text-600)] mb-2 block text-xs font-medium uppercase tracking-wide">Grading Rubric</label>
                  <div className="border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
                    {selectedMilestone.rubric.map((criterion) => (
                      <div key={criterion.id} className="px-4 py-3 flex justify-between items-center gap-3">
                        <span className="text-sm text-[var(--color-text-900)]">{criterion.name}</span>
                        <span className="text-sm text-[var(--color-text-600)] flex-shrink-0">{criterion.maxScore} pts</span>
                      </div>
                    ))}
                    <div className="px-4 py-3 flex justify-between items-center bg-[var(--color-surface-alt)]">
                      <span className="text-sm font-semibold text-[var(--color-text-900)]">Total</span>
                      <span className="text-sm font-semibold text-[var(--color-text-900)]">
                        {selectedMilestone.rubric.reduce((sum, c) => sum + c.maxScore, 0)} pts
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submitted Files */}
              {drawerSubmission && drawerSubmission.versions.length > 0 && (
                <div>
                  <label className="text-[var(--color-text-600)] mb-2 block text-xs font-medium uppercase tracking-wide">Submitted Files</label>
                  <div className="space-y-2">
                    {drawerSubmission.versions.map((v) => (
                      <div
                        key={v.version}
                        className="flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)]"
                      >
                        <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-text-900)] truncate">{v.fileName}</p>
                          <p className="text-xs text-[var(--color-text-600)]">
                            v{v.version} · {formatFileSize(v.fileSize)} · {new Date(v.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {v.filePath && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleViewFile(v.filePath!, v.fileName)}
                              className="p-1.5 hover:bg-[var(--color-border)] rounded transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4 text-[var(--color-text-600)]" />
                            </button>
                            <button
                              onClick={() => handleDownload(v.filePath!, v.fileName)}
                              className="p-1.5 hover:bg-[var(--color-border)] rounded transition-colors"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-[var(--color-text-600)]" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setSelectedMilestone(null);
                    navigate(`/student/submissions/${selectedMilestone.id}`);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {selectedMilestone.status === 'draft' ? 'Start Submission' : 'View Submission'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
