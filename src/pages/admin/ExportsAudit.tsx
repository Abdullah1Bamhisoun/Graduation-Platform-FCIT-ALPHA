import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { mockUsers, mockAuditLog } from '../../lib/mock-data';
import { Download, FileText, BarChart3, Activity, X } from 'lucide-react';
import { toast } from 'sonner';

export function AdminExportsAudit() {
  const user = mockUsers.admin;
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'grades' | 'submissions' | 'activity' | null>(null);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const handleExport = () => {
    toast.success('Export started. Download will be ready shortly.');
    setShowExportModal(false);
    setExportType(null);
  };

  const openExportModal = (type: 'grades' | 'submissions' | 'activity') => {
    setExportType(type);
    setShowExportModal(true);
  };

  return (
    <Layout user={user} pageTitle="Exports & Audit">
      <Tabs defaultValue="exports" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="exports">Export Center</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="exports">
          <div className="mb-6">
            <p className="text-[var(--color-text-600)]">
              Export data for analysis and record keeping
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Grades Export */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <div className="w-12 h-12 rounded-lg bg-white border border-green-500 flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-green-600" />
              </div>
              <h2 className="text-[var(--color-text-900)] mb-2">Grades Report</h2>
              <p className="text-[var(--color-text-600)] mb-4">
                Export student grades, rubric scores, and evaluation summaries
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => openExportModal('grades')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Grades
                </Button>
              </div>
            </div>

            {/* Submissions Export */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <div className="w-12 h-12 rounded-lg bg-white border border-blue-500 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-[var(--color-text-900)] mb-2">Submissions Report</h2>
              <p className="text-[var(--color-text-600)] mb-4">
                Export submission history, versions, and status information
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => openExportModal('submissions')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Submissions
                </Button>
              </div>
            </div>

            {/* Activity Log Export */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <div className="w-12 h-12 rounded-lg bg-white border border-purple-500 flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-purple-600" />
              </div>
              <h2 className="text-[var(--color-text-900)] mb-2">Activity Log</h2>
              <p className="text-[var(--color-text-600)] mb-4">
                Export system activity and user actions for auditing
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => openExportModal('activity')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Activity
                </Button>
              </div>
            </div>
          </div>

          {/* Recent Exports */}
          <div className="mt-8 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
            <div className="p-6 border-b border-[var(--color-border)]">
              <h2 className="text-[var(--color-text-900)]">Recent Exports</h2>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {[
                { name: 'CPIS-498_Grades_Fall2025.xlsx', date: '2025-11-01', size: '245 KB', type: 'Grades' },
                { name: 'Submissions_Report_Oct2025.csv', date: '2025-10-28', size: '1.2 MB', type: 'Submissions' },
                { name: 'Activity_Log_Oct2025.xlsx', date: '2025-10-15', size: '856 KB', type: 'Activity' },
              ].map((file, index) => (
                <div key={index} className="p-6 flex items-center justify-between hover:bg-[var(--color-surface-alt)] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-primary-100)] flex items-center justify-center">
                      <FileText className="w-5 h-5 text-[var(--color-primary-600)]" />
                    </div>
                    <div>
                      <h3 className="text-[var(--color-text-900)] mb-1">{file.name}</h3>
                      <p className="text-[var(--color-text-600)]">
                        {file.type} • {file.size} • {new Date(file.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div className="mb-6">
            <p className="text-[var(--color-text-600)]">
              System activity and user action logs
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <Input type="date" placeholder="From" className="w-48" />
            <Input type="date" placeholder="To" className="w-48" />
            <select className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]">
              <option>All Actions</option>
              <option>Submitted</option>
              <option>Reviewed</option>
              <option>Published</option>
              <option>Updated</option>
            </select>
            <select className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]">
              <option>All Users</option>
              <option>Students</option>
              <option>Supervisors</option>
              <option>Admins</option>
            </select>
          </div>

          {/* Audit Log Table */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--color-border)] text-[var(--color-text-600)]">
              <div className="col-span-3">Date & Time</div>
              <div className="col-span-2">Actor</div>
              <div className="col-span-2">Action</div>
              <div className="col-span-3">Entity</div>
              <div className="col-span-2">Context</div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {mockAuditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-[var(--color-surface-alt)] transition-colors"
                >
                  <div className="col-span-3 flex items-center">
                    <p className="text-[var(--color-text-900)]">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <p className="text-[var(--color-text-900)]">{entry.actor.split('(')[0].trim()}</p>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
                      {entry.action}
                    </span>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <p className="text-[var(--color-text-900)]">{entry.entity}</p>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <p className="text-[var(--color-text-600)]">{entry.context}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Export Modal */}
      {showExportModal && exportType && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowExportModal(false)}
          />
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
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowExportModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleExport}
                  >
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
