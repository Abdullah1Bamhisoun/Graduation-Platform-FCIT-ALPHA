import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getPresentationSchedules, getStudentPresentationSelections } from '../../services/presentations';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { StudentPresentationSelection, PresentationSchedule } from '../../types';
import { Calendar, CheckCircle, XCircle, Plus, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// Mock supervisor list
const availableSupervisors = [
  'Dr. Wafi Bedwai',
  'Dr. Sultan Al-Qarni',
  'Dr. Fouad Alallah',
  'Dr. Mohammed Al-Rasheed',
  'Dr. Khalid Abdullah',
  'Dr. Fahad Al-Bakr',
  'Dr. Omar Al-Zahrani',
];

export function AdminPresentationAndCommittee() {
  const { user } = useAuth();
  const [selections, setSelections] = useState<StudentPresentationSelection[]>([]);
  const [schedules, setSchedules] = useState<PresentationSchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('all');
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<string | null>(null);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('');

  useEffect(() => {
    Promise.all([
      getPresentationSchedules(),
      getStudentPresentationSelections(),
    ]).then(([scheds, sels]) => {
      setSchedules(scheds);
      setSelections(sels);
    });
  }, []);

  if (!user) return null;

  const pendingSelections = selections.filter(s => s.selectedDay);
  const notSelectedYet = selections.filter(s => !s.selectedDay);

  // Get unique days from schedules
  const availableDays = ['all', ...Array.from(new Set(schedules.map(s => s.day)))];

  // Combine confirmed schedules and student selections
  const allTimeSlots = [
    ...schedules,
    ...selections
      .filter(s => s.selectedDay && s.selectedTimeSlot)
      .map(s => ({
        groupId: s.groupId,
        groupName: s.groupName,
        students: s.students,
        day: s.selectedDay!,
        timeSlot: s.selectedTimeSlot!,
        projectName: s.projectName,
        projectDescription: s.projectDescription,
        committeeMembers: [] as string[],
      }))
  ];

  // Filter schedules by day
  const filteredSchedules = allTimeSlots.filter(schedule => {
    const matchesDay = selectedDay === 'all' || schedule.day === selectedDay;
    return matchesDay;
  });

  const handleAddMember = (groupId: string) => {
    const schedule = schedules.find(s => s.groupId === groupId);
    if (!schedule) return;

    if (schedule.committeeMembers.length >= 2) {
      toast.error('Committee is full (maximum 2 members)');
      return;
    }

    setSelectedSchedule(groupId);
    setShowAddMemberDialog(true);
  };

  const handleConfirmAddMember = () => {
    if (!selectedSupervisor || !selectedSchedule) return;

    const updatedSchedules = schedules.map(s => {
      if (s.groupId === selectedSchedule) {
        if (s.committeeMembers.includes(selectedSupervisor)) {
          toast.error('This supervisor is already a committee member');
          return s;
        }
        toast.success('Committee member added successfully');
        return {
          ...s,
          committeeMembers: [...s.committeeMembers, selectedSupervisor],
        };
      }
      return s;
    });

    setSchedules(updatedSchedules);
    setShowAddMemberDialog(false);
    setSelectedSchedule(null);
    setSelectedSupervisor('');
  };

  const handleRemoveMember = (groupId: string, member: string) => {
    const schedule = schedules.find(s => s.groupId === groupId);
    if (!schedule) return;

    if (schedule.committeeMembers.length <= 2) {
      toast.error('Cannot remove member - minimum 2 committee members required');
      return;
    }

    const updatedSchedules = schedules.map(s => {
      if (s.groupId === groupId) {
        return {
          ...s,
          committeeMembers: s.committeeMembers.filter(m => m !== member),
        };
      }
      return s;
    });

    setSchedules(updatedSchedules);
    toast.success('Committee member removed successfully');
  };

  const getCommitteeStatus = (members: string[]) => {
    if (members.length < 2) {
      return { color: 'text-red-600 bg-red-50 border-red-200', text: 'Incomplete', icon: AlertCircle };
    } else {
      return { color: 'text-green-600 bg-green-50 border-green-200', text: 'Complete', icon: null };
    }
  };

  return (
    <Layout user={user} pageTitle="Presentation & Committee Management">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Manage presentation scheduling and evaluation committee assignments
        </p>
      </div>

      <Tabs defaultValue="scheduling" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="scheduling">Presentation Scheduling</TabsTrigger>
          <TabsTrigger value="committee">Committee Management</TabsTrigger>
        </TabsList>

        {/* Presentation Scheduling Tab */}
        <TabsContent value="scheduling" className="mt-6">
          <div className="space-y-6">
            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <div className="text-2xl text-[var(--color-text-900)]">{pendingSelections.length}</div>
                    <div className="text-[var(--color-text-600)]">Selected</div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="flex items-center gap-3">
                  <XCircle className="w-8 h-8 text-orange-600" />
                  <div>
                    <div className="text-2xl text-[var(--color-text-900)]">{notSelectedYet.length}</div>
                    <div className="text-[var(--color-text-600)]">Pending Selection</div>
                  </div>
                </div>
              </div>
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
                <div className="flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-blue-600" />
                  <div>
                    <div className="text-2xl text-[var(--color-text-900)]">{selections.length}</div>
                    <div className="text-[var(--color-text-600)]">Total Groups</div>
                  </div>
                </div>
              </div>
            </div>

            {/* All Presentations Table */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h3 className="text-[var(--color-text-900)]">All Presentation Time Selections</h3>
                <p className="text-[var(--color-text-600)] mt-1">
                  Student-selected presentation schedules
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--color-surface-alt)]">
                    <tr>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Group Name</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Student Name(s)</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">University ID(s)</th>
                      <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">Day</th>
                      <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">Time Slot</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Project Name</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Project Description</th>
                      <th className="p-4 text-center text-[var(--color-text-900)]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {selections.map((selection) => (
                      selection.students.map((student, idx) => (
                        <tr
                          key={`${selection.groupId}-${student.id}`}
                          className={selection.selectedDay ? 'bg-green-50' : 'bg-orange-50'}
                        >
                          {idx === 0 ? (
                            <>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                                <span className="text-[var(--color-text-900)]">{selection.groupName}</span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-900)]">{student.name}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-600)]">{student.id}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                                <span className="text-[var(--color-text-900)]">
                                  {selection.selectedDay || (
                                    <span className="text-orange-600">Not Selected</span>
                                  )}
                                </span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                                <span className="text-[var(--color-text-900)]">
                                  {selection.selectedTimeSlot || (
                                    <span className="text-orange-600">Not Selected</span>
                                  )}
                                </span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                                <span className="text-[var(--color-text-900)]">{selection.projectName}</span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={selection.students.length}>
                                <span className="text-[var(--color-text-600)]">{selection.projectDescription}</span>
                              </td>
                              <td className="p-4 text-center" rowSpan={selection.students.length}>
                                {selection.selectedDay ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <span className="text-green-600">Selected</span>
                                    {selection.selectedAt && (
                                      <span className="text-[var(--color-text-600)]">
                                        {new Date(selection.selectedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1">
                                    <XCircle className="w-5 h-5 text-orange-600" />
                                    <span className="text-orange-600">Pending</span>
                                  </div>
                                )}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-900)]">{student.name}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-600)]">{student.id}</span>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Committee Management Tab */}
        <TabsContent value="committee" className="mt-6">
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-[var(--color-text-900)]">
                <strong>Requirements:</strong> Each presentation must have exactly 2 committee members. Click + to add members or X to remove them.
              </p>
            </div>

            {/* Day Filter */}
            <div className="mb-4">
              <Label htmlFor="day-filter" className="mb-2 block text-[var(--color-text-900)]">Filter by Day</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger id="day-filter" className="max-w-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableDays.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day === 'all' ? 'All Days' : day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Committee Management Table */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h3 className="text-[var(--color-text-900)]">Presentation Committee Assignments</h3>
                <p className="text-[var(--color-text-600)] mt-1">
                  Assign and manage committee members for each presentation
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--color-surface-alt)]">
                    <tr>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Group Name</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Group ID</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Student Name(s)</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">University ID(s)</th>
                      <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">Day</th>
                      <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">Time Slot</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Project Name</th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">Status</th>
                      <th className="p-4 text-left text-[var(--color-text-900)]">Committee Members (2)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {filteredSchedules.map((schedule) => {
                      const status = getCommitteeStatus(schedule.committeeMembers);
                      const StatusIcon = status.icon;
                      
                      return schedule.students.map((student, idx) => (
                        <tr key={`${schedule.groupId}-${student.id}`}>
                          {idx === 0 ? (
                            <>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={schedule.students.length}>
                                <span className="text-[var(--color-text-900)]">{schedule.groupName}</span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={schedule.students.length}>
                                <span className="text-[var(--color-text-600)]">{schedule.groupId}</span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-900)]">{student.name}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-600)]">{student.id}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]" rowSpan={schedule.students.length}>
                                <span className="text-[var(--color-text-900)]">{schedule.day}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]" rowSpan={schedule.students.length}>
                                <span className="text-[var(--color-text-900)]">{schedule.timeSlot}</span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={schedule.students.length}>
                                <span className="text-[var(--color-text-900)]">{schedule.projectName}</span>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]" rowSpan={schedule.students.length}>
                                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs ${status.color}`}>
                                  {StatusIcon && <StatusIcon className="w-3 h-3" />}
                                  {status.text}
                                </div>
                              </td>
                              <td className="p-4" rowSpan={schedule.students.length}>
                                <div className="space-y-2">
                                  {schedule.committeeMembers.length > 0 ? (
                                    schedule.committeeMembers.map((member, i) => (
                                      <div key={i} className="flex items-center justify-between gap-2 bg-[var(--color-surface-alt)] px-3 py-2 rounded-lg">
                                        <span className="text-[var(--color-text-900)]">{member}</span>
                                        {schedule.committeeMembers.length > 2 && (
                                          <button
                                            onClick={() => handleRemoveMember(schedule.groupId, member)}
                                            className="text-red-600 hover:text-red-700"
                                            title="Remove member"
                                          >
                                            <X className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-[var(--color-text-600)] italic">No members yet</span>
                                  )}
                                  {schedule.committeeMembers.length < 2 && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleAddMember(schedule.groupId)}
                                      className="bg-[#10B981] text-white hover:bg-[#0ea572] w-full"
                                    >
                                      <Plus className="w-4 h-4 mr-2" />
                                      Add Member
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-900)]">{student.name}</span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-600)]">{student.id}</span>
                              </td>
                            </>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>

              {filteredSchedules.length === 0 && (
                <div className="p-12 text-center text-[var(--color-text-600)]">
                  <p>No presentations found for the selected day</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={setShowAddMemberDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Committee Member</DialogTitle>
            <DialogDescription>
              Select a supervisor to add as a committee member for this presentation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {selectedSchedule && (
              <>
                <div className="bg-[var(--color-surface-alt)] p-4 rounded-lg">
                  <Label className="text-[var(--color-text-600)]">Group</Label>
                  <div className="text-[var(--color-text-900)]">
                    {schedules.find(s => s.groupId === selectedSchedule)?.groupName}
                  </div>
                  <div className="text-[var(--color-text-600)] mt-1">
                    {schedules.find(s => s.groupId === selectedSchedule)?.projectName}
                  </div>
                </div>

                <div>
                  <Label htmlFor="supervisor-select" className="mb-2 block text-[var(--color-text-900)]">Select Supervisor *</Label>
                  <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                    <SelectTrigger id="supervisor-select">
                      <SelectValue placeholder="Choose a supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSupervisors.map((supervisor) => (
                        <SelectItem key={supervisor} value={supervisor}>
                          {supervisor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleConfirmAddMember}
                    className="bg-[#10B981] text-white hover:bg-[#0ea572]"
                    disabled={!selectedSupervisor}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
