import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAuditLog } from '../../services/audit';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { Download, FileText, BarChart3, Activity, X, ClipboardList, Calendar, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditLogEntry } from '../../types';

export function AdminExportsAudit() {
  const { user } = useAuth();
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'grades' | 'submissions' | 'activity' | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [filterAction, setFilterAction] = useState('All Actions');

  useEffect(() => {
    getAuditLog().then(setAuditLog);
  }, []);

  if (!user) return null;

  const handleExport = () => {
    toast.success('Export started. Download will be ready shortly.');
    setShowExportModal(false);
    setExportType(null);
  };

  const openExportModal = (type: 'grades' | 'submissions' | 'activity') => {
    setExportType(type);
    setShowExportModal(true);
  };

  // Derived audit stats
  const today = new Date().toDateString();
  const todayEntries = auditLog.filter(e => new Date(e.timestamp).toDateString() === today).length;
  const uniqueActors = new Set(auditLog.map(e => e.actor)).size;

  const filteredLog = auditLog.filter(entry =>
    filterAction === 'All Actions' || entry.action === filterAction
  );

  return (
    <Layout user={user} pageTitle="Exports & Audit">
      <Tabs defaultValue="exports" className="w-full">
        <TabsList className="grid w-fit grid-cols-2 mb-6 h-11 border border-gray-300 rounded-lg bg-gray-100 p-1">
          <TabsTrigger
            value="exports"
            className="rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:shadow-sm"
          >
            Export Center
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="rounded-md font-semibold data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-gray-300 data-[state=active]:shadow-sm"
          >
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ── Export Center ──────────────────────────────────────────── */}
        <TabsContent value="exports">
          {/* Export type cards */}
          <DashboardCard title="Export Data" icon={Download} className="mb-6">
            <div className="grid grid-cols-3 gap-6">
              {/* Grades */}
              <div className="rounded-xl border border-[var(--color-border)] p-5">
                <div className="w-12 h-12 rounded-lg bg-white border border-green-500 flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-[var(--color-text-900)] mb-2">Grades Report</h3>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Export student grades, rubric scores, and evaluation summaries
                </p>
                <Button variant="outline" className="w-full justify-start" onClick={() => openExportModal('grades')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Grades
                </Button>
              </div>

              {/* Submissions */}
              <div className="rounded-xl border border-[var(--color-border)] p-5">
                <div className="w-12 h-12 rounded-lg bg-white border border-blue-500 flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-[var(--color-text-900)] mb-2">Submissions Report</h3>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Export submission history, versions, and status information
                </p>
                <Button variant="outline" className="w-full justify-start" onClick={() => openExportModal('submissions')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Submissions
                </Button>
              </div>

              {/* Activity */}
              <div className="rounded-xl border border-[var(--color-border)] p-5">
                <div className="w-12 h-12 rounded-lg bg-white border border-purple-500 flex items-center justify-center mb-4">
                  <Activity className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-[var(--color-text-900)] mb-2">Activity Log</h3>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Export system activity and user actions for auditing
                </p>
                <Button variant="outline" className="w-full justify-start" onClick={() => openExportModal('activity')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Activity
                </Button>
              </div>
            </div>
          </DashboardCard>

          {/* Recent Exports */}
          <DashboardCard title="Recent Exports" icon={ClipboardList}>
            <div className="py-10 text-center text-[var(--color-text-600)]">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No recent exports</p>
              <p className="text-sm mt-1">Your exported files will appear here</p>
            </div>
          </DashboardCard>
        </TabsContent>

        {/* ── Audit Log ──────────────────────────────────────────────── */}
        <TabsContent value="audit">
          {/* Metric row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <MetricCard label="Total Entries" value={auditLog.length} icon={ClipboardList} color="primary" />
            <MetricCard label="Today's Activity" value={todayEntries} icon={Calendar} color="success" />
            <MetricCard label="Unique Actors" value={uniqueActors} icon={Users} color="info" />
          </div>

          {/* Filters + Table */}
          <DashboardCard
            title="Activity Log"
            icon={Activity}
            actions={
              <div className="flex gap-2 items-center">
                <select
                  className="px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]"
                  value={filterAction}
                  onChange={e => setFilterAction(e.target.value)}
                >
                  <option>All Actions</option>
                  <option>Submitted</option>
                  <option>Reviewed</option>
                  <option>Published</option>
                  <option>Updated</option>
                </select>
                <Input type="date" className="w-36 h-8 text-sm" />
                <Input type="date" className="w-36 h-8 text-sm" />
              </div>
            }
          >
            {filteredLog.length === 0 ? (
              <div className="py-12 text-center text-[var(--color-text-600)]">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No activity recorded</p>
                <p className="text-sm mt-1">System events and user actions will appear here</p>
              </div>
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] text-xs font-medium uppercase tracking-wide text-[var(--color-text-600)]">
                  <div className="col-span-3">Date & Time</div>
                  <div className="col-span-2">Actor</div>
                  <div className="col-span-2">Action</div>
                  <div className="col-span-3">Entity</div>
                  <div className="col-span-2">Context</div>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {filteredLog.map((entry) => (
                    <div
                      key={entry.id}
                      className="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[var(--color-surface-alt)] transition-colors"
                    >
                      <div className="col-span-3 flex items-center">
                        <p className="text-sm text-[var(--color-text-900)]">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <p className="text-sm text-[var(--color-text-900)]">{entry.actor.split('(')[0].trim()}</p>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <span className="px-2.5 py-1 text-xs rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                          {entry.action}
                        </span>
                      </div>
                      <div className="col-span-3 flex items-center">
                        <p className="text-sm text-[var(--color-text-900)]">{entry.entity}</p>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <p className="text-sm text-[var(--color-text-600)] truncate">{entry.context}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </DashboardCard>
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      {showExportModal && exportType && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowExportModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-[var(--color-text-900)]">
                  Export {exportType.charAt(0).toUpperCase() + exportType.slice(1)} Report
                </h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="from">From Date</Label>
                    <Input
                      id="from"
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="to">To Date</Label>
                    <Input
                      id="to"
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div>
                  <Label>Course</Label>
                  <select className="w-full mt-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]">
                    <option>All Courses</option>
                    <option>CPIS-498</option>
                    <option>CPIS-499</option>
                  </select>
                </div>

                <div>
                  <Label>Format</Label>
                  <select className="w-full mt-2 px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]">
                    <option>Excel (.xlsx)</option>
                    <option>CSV (.csv)</option>
                    <option>PDF (.pdf)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowExportModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
