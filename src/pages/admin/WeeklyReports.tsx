import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAllWeeklyReports } from '../../services/weekly-reports';
import { getProfilesByRole } from '../../services/profiles';
import { getAllGroups } from '../../services/groups';
import type { GroupData } from '../../services/groups';
import { Button } from '../../components/ui/button';
import { Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { WeeklyReport } from '../../types';
import type { User } from '../../types';

export function AdminWeeklyReports() {
  const { user } = useAuth();
  const [allReports, setAllReports] = useState<WeeklyReport[]>([]);
  const [supervisorProfiles, setSupervisorProfiles] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<GroupData[]>([]);
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);

  useEffect(() => {
    Promise.all([
      getAllWeeklyReports(),
      getProfilesByRole('supervisor'),
      getAllGroups(),
    ]).then(([reports, sups, groups]) => {
      setAllReports(reports);
      setSupervisorProfiles(sups);
      setAllGroups(groups);
    });
  }, []);

  if (!user) return null;

  // Generate 14 weeks
  const weeks = Array.from({ length: 14 }, (_, i) => i + 1);

  // Get reports for selected group
  const groupReports = selectedGroup ? allReports.filter(r => r.groupId === selectedGroup) : [];
  
  // Find report for each week
  const getReportForWeek = (weekNum: number) => {
    return groupReports.find(r => r.weekNumber === weekNum);
  };

  const toggleSupervisor = (supervisorId: string) => {
    const newExpanded = new Set(expandedSupervisors);
    if (newExpanded.has(supervisorId)) {
      newExpanded.delete(supervisorId);
    } else {
      newExpanded.add(supervisorId);
    }
    setExpandedSupervisors(newExpanded);
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'good':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'satisfactory':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'needs-improvement':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressStatusText = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'Excellent Progress';
      case 'good':
        return 'Good Progress';
      case 'satisfactory':
        return 'Satisfactory';
      case 'needs-improvement':
        return 'Needs Improvement';
      default:
        return status;
    }
  };

  // Build tree: each supervisor with their groups
  const supervisorTree = supervisorProfiles.map(sup => ({
    id: sup.id,
    name: sup.name,
    groups: allGroups.filter(g => g.supervisorId === sup.id),
  }));

  const currentGroup = allGroups.find(g => g.id === selectedGroup) ?? null;

  return (
    <Layout user={user} pageTitle="Weekly Reports - All Groups">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          View all weekly reports organized by supervisor
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar - Supervisors and Groups */}
        <div className="col-span-3">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="text-[var(--color-text-900)]">Supervisors & Groups</h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {supervisorTree.length === 0 && (
                <p className="p-4 text-[var(--color-text-600)] text-sm">No supervisors found</p>
              )}
              {supervisorTree.map((supervisor) => (
                <div key={supervisor.id}>
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--color-surface-alt)] transition-colors"
                    onClick={() => toggleSupervisor(supervisor.id)}
                  >
                    <span className="text-[var(--color-text-900)]">{supervisor.name}</span>
                    {expandedSupervisors.has(supervisor.id) ? (
                      <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--color-text-600)]" />
                    )}
                  </div>
                  {expandedSupervisors.has(supervisor.id) && (
                    <div className="bg-[var(--color-surface-alt)] divide-y divide-[var(--color-border)]">
                      {supervisor.groups.length === 0 && (
                        <p className="p-3 pl-8 text-[var(--color-text-600)] text-xs">No groups assigned</p>
                      )}
                      {supervisor.groups.map((group) => (
                        <div
                          key={group.id}
                          className={`p-3 pl-8 cursor-pointer hover:bg-[var(--color-border)] transition-colors ${
                            selectedGroup === group.id ? 'bg-[var(--color-primary-100)] border-l-4 border-[var(--color-primary-600)]' : ''
                          }`}
                          onClick={() => setSelectedGroup(group.id)}
                        >
                          <div className="text-[var(--color-text-900)]">{group.groupCode}</div>
                          <div className="text-[var(--color-text-600)] text-xs mt-1">{group.courseCode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Weekly Reports */}
        <div className="col-span-9">
          {selectedGroup ? (
            <>
              <div className="mb-4">
                <h2 className="text-[var(--color-text-900)] mb-1">{currentGroup ? `${currentGroup.groupCode} — ${currentGroup.projectName}` : ''}</h2>
                <p className="text-[var(--color-text-600)]">View weekly progress reports</p>
              </div>

              {/* Reports Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {weeks.map((weekNum) => {
                  const report = getReportForWeek(weekNum);
                  const isDisabled = weekNum > 9 && !report;
                  
                  return (
                    <div
                      key={weekNum}
                      className={`bg-[var(--color-surface-white)] rounded-xl border shadow-sm p-6 transition-all ${
                        isDisabled
                          ? 'border-gray-200 opacity-50 cursor-not-allowed'
                          : report
                          ? 'border-[var(--color-border)] hover:shadow-md cursor-pointer'
                          : 'border-[var(--color-border)]'
                      }`}
                      onClick={() => report && !isDisabled && setSelectedReport(report)}
                    >
                      <div className="text-center">
                        <div className={`text-4xl mb-2 ${isDisabled ? 'text-gray-400' : 'text-[var(--color-text-900)]'}`}>
                          {weekNum}
                        </div>
                        <div className={`mb-4 ${isDisabled ? 'text-gray-400' : 'text-[var(--color-text-600)]'}`}>
                          Week {weekNum}
                        </div>
                        
                        {report ? (
                          <>
                            <div className={`inline-block px-3 py-1 rounded-full border text-xs mb-3 ${getProgressStatusColor(report.progressStatus)}`}>
                              {getProgressStatusText(report.progressStatus)}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReport(report);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Report
                            </Button>
                          </>
                        ) : (
                          <div className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-[var(--color-text-600)]'}`}>
                            {isDisabled ? 'Not Available' : 'Not Submitted'}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
              <p className="text-[var(--color-text-600)]">
                Please select a group from the sidebar to view weekly reports
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedReport(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6">
                <h2 className="text-[var(--color-text-900)] mb-2">Week {selectedReport.weekNumber} Progress Report</h2>
                <p className="text-[var(--color-text-600)]">
                  Report details for {currentGroup ? `${currentGroup.groupCode} — ${currentGroup.projectName}` : ''}
                </p>
              </div>

              <div className="p-6">
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody className="divide-y divide-[var(--color-border)]">
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] w-1/3">Course</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.course}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Group ID</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.groupId}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Week#</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.weekNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Supervisor</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.supervisorName}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Did all group members attend the meeting?</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.allMembersAttended ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Absent student name</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.absentStudentName || '-'}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Progress status</td>
                        <td className="p-4">
                          <div className={`inline-block px-3 py-1 rounded-full border text-xs ${getProgressStatusColor(selectedReport.progressStatus)}`}>
                            {getProgressStatusText(selectedReport.progressStatus)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] align-top">Supervisor Comments</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.supervisorComments}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setSelectedReport(null)}>
                    Close
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
