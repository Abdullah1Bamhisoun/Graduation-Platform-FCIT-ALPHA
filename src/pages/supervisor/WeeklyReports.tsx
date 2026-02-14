import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForSupervisor } from '../../services/groups';
import { getWeeklyReportsByGroup } from '../../services/weekly-reports';
import { Plus, Eye, X } from 'lucide-react';
import { WeeklyReport } from '../../types';
import { toast } from 'sonner';
import { useEffect } from 'react';

export function SupervisorWeeklyReports() {
  const { user } = useAuth();
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [groups, setGroups] = useState<{ id: string; name: string; course: string; students: string[] }[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);

  useEffect(() => {
    if (!user) return;
    getGroupsForSupervisor(user.id).then((data) => {
      setGroups(data.map(g => ({
        id: g.id,
        name: `Group ${g.groupCode} - ${g.projectName}`,
        course: g.courseCode as 'CPIS-498' | 'CPIS-499',
        students: g.members.map(m => m.name),
      })));
    });
  }, [user]);

  useEffect(() => {
    if (!selectedGroup) { setReports([]); return; }
    getWeeklyReportsByGroup(selectedGroup).then(setReports);
  }, [selectedGroup]);
  const [formData, setFormData] = useState({
    weekNumber: '',
    course: 'CPIS-498' as 'CPIS-498' | 'CPIS-499',
    allMembersAttended: 'true',
    absentStudentName: '',
    progressStatus: 'good' as 'excellent' | 'good' | 'satisfactory' | 'needs-improvement',
    supervisorComments: '',
  });

  if (!user) return null;

  // Get current group
  const currentGroup = groups.find(g => g.id === selectedGroup);

  // Generate 14 weeks
  const weeks = Array.from({ length: 14 }, (_, i) => i + 1);

  // Get reports for selected group
  const groupReports = reports;
  
  // Find report for each week
  const getReportForWeek = (weekNum: number) => {
    return groupReports.find(r => r.weekNumber === weekNum);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) {
      toast.error('Please select a group first');
      return;
    }
    toast.success('Weekly report submitted successfully!');
    setShowNewForm(false);
    setFormData({
      weekNumber: '',
      course: 'CPIS-498',
      allMembersAttended: 'true',
      absentStudentName: '',
      progressStatus: 'good',
      supervisorComments: '',
    });
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

  return (
    <Layout user={user} pageTitle="Weekly Reports">
      <div className="mb-6">
        <div className="flex-1">
          <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger id="group-select" className="w-full max-w-md">
              <SelectValue placeholder="Choose a group to view/submit reports" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group.course})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentGroup && (
            <p className="text-[var(--color-text-600)] mt-2">
              Students: {currentGroup.students.join(', ')}
            </p>
          )}
        </div>
      </div>

      {selectedGroup ? (
        <>
          {/* Submit Button */}
          <div className="mb-6 flex justify-center">
            <Button
              onClick={() => setShowNewForm(true)}
              className="bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Submit Weekly Report
            </Button>
          </div>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {weeks.map((weekNum) => {
              const report = getReportForWeek(weekNum);
              const isDisabled = weekNum > 9 && !report;
              const canAddReport = weekNum <= 9 || weekNum === 9;
              
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
                    
                    {report && weekNum !== 9 ? (
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
                    ) : weekNum === 9 ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, weekNumber: weekNum.toString() });;
                          setShowNewForm(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Progress Feedback
                      </Button>
                    ) : canAddReport ? (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, weekNumber: weekNum.toString() });
                          setShowNewForm(true);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Report
                      </Button>
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
            Please select a group to view or submit weekly reports
          </p>
        </div>
      )}

      {/* New Report Form Modal */}
      {showNewForm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowNewForm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-[var(--color-text-900)]">Submit Weekly Report</h2>
                  <p className="text-[var(--color-text-600)] mt-1">{currentGroup?.name}</p>
                </div>
                <button
                  onClick={() => {
                    setShowNewForm(false);
                    setFormData({
                      weekNumber: '',
                      course: 'CPIS-498',
                      allMembersAttended: 'true',
                      absentStudentName: '',
                      progressStatus: 'good',
                      supervisorComments: '',
                    });
                  }}
                  className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="weekNumber">Week Number *</Label>
                    <Select 
                      value={formData.weekNumber} 
                      onValueChange={(value) => setFormData({ ...formData, weekNumber: value })}
                    >
                      <SelectTrigger id="weekNumber" className="mt-2">
                        <SelectValue placeholder="Select week" />
                      </SelectTrigger>
                      <SelectContent>
                        {weeks.filter(w => w <= 9).map((week) => (
                          <SelectItem key={week} value={week.toString()}>
                            Week {week}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="course">Course *</Label>
                    <Select 
                      value={formData.course} 
                      onValueChange={(value: 'CPIS-498' | 'CPIS-499') => setFormData({ ...formData, course: value })}
                    >
                      <SelectTrigger id="course" className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPIS-498">CPIS-498</SelectItem>
                        <SelectItem value="CPIS-499">CPIS-499</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="attendance">Did all group members attend the meeting? *</Label>
                  <Select 
                    value={formData.allMembersAttended} 
                    onValueChange={(value) => setFormData({ ...formData, allMembersAttended: value })}
                  >
                    <SelectTrigger id="attendance" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.allMembersAttended === 'false' && (
                  <div>
                    <Label htmlFor="absentStudent">Absent Student Name</Label>
                    <Input
                      id="absentStudent"
                      placeholder="Enter student name"
                      value={formData.absentStudentName}
                      onChange={(e) => setFormData({ ...formData, absentStudentName: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="progressStatus">Progress Status *</Label>
                  <Select 
                    value={formData.progressStatus} 
                    onValueChange={(value: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement') => 
                      setFormData({ ...formData, progressStatus: value })
                    }
                  >
                    <SelectTrigger id="progressStatus" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent Progress</SelectItem>
                      <SelectItem value="good">Good Progress</SelectItem>
                      <SelectItem value="satisfactory">Satisfactory</SelectItem>
                      <SelectItem value="needs-improvement">Needs Improvement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="supervisorComments">Supervisor Comments *</Label>
                  <Textarea
                    id="supervisorComments"
                    placeholder="Enter your comments about the group's progress..."
                    value={formData.supervisorComments}
                    onChange={(e) => setFormData({ ...formData, supervisorComments: e.target.value })}
                    required
                    className="mt-2 min-h-[120px]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowNewForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]"
                  >
                    Submit Report
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

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
                  Report details for {currentGroup?.name}
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
