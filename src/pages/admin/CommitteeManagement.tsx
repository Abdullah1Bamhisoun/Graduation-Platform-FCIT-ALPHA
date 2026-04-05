import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getPresentationSchedules, getStudentPresentationSelections } from '../../services/presentations';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { PresentationSchedule, StudentPresentationSelection } from '../../types';
import { Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';


export function AdminCommitteeManagement() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<PresentationSchedule[]>([]);
  const [selections, setSelections] = useState<StudentPresentationSelection[]>([]);
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

  // Get unique days from schedules
  const availableDays = ['all', ...Array.from(new Set(schedules.map(s => s.day)))];

  // Get unique supervisors already assigned across all schedules
  const availableSupervisors = Array.from(new Set(schedules.flatMap(s => s.committeeMembers)));

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

  // Check if a supervisor has a time conflict with the selected schedule
  const getSupervisorConflict = (supervisor: string, forGroupId: string): string | null => {
    const targetSchedule = schedules.find(s => s.groupId === forGroupId);
    if (!targetSchedule) return null;

    const conflictingGroup = schedules.find(s =>
      s.groupId !== forGroupId &&
      s.day === targetSchedule.day &&
      s.timeSlot === targetSchedule.timeSlot &&
      s.committeeMembers.includes(supervisor)
    );

    if (conflictingGroup) {
      return `Already assigned to "${conflictingGroup.groupName}" at the same time (${targetSchedule.day} – ${targetSchedule.timeSlot})`;
    }
    return null;
  };

  const selectedSupervisorConflict =
    selectedSupervisor && selectedSchedule
      ? getSupervisorConflict(selectedSupervisor, selectedSchedule)
      : null;

  const handleConfirmAddMember = () => {
    if (!selectedSupervisor || !selectedSchedule) return;
    if (selectedSupervisorConflict) return;

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
    <Layout user={user} pageTitle="Committee Management">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Manage evaluation committee assignments for final presentations
        </p>
        
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
                  {(() => {
                    const groupSupervisorName = schedules.find(s => s.groupId === selectedSchedule)?.supervisorName?.trim().toLowerCase();
                    const filteredSupervisors = availableSupervisors.filter(
                      s => !groupSupervisorName || s.trim().toLowerCase() !== groupSupervisorName
                    );
                    const groupSupervisorDisplay = schedules.find(s => s.groupId === selectedSchedule)?.supervisorName;
                    return (
                      <>
                        {groupSupervisorDisplay && (
                          <div className="mb-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-700">
                              <strong>{groupSupervisorDisplay}</strong> is this group's supervisor and cannot be assigned as a committee member.
                            </p>
                          </div>
                        )}
                        <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                          <SelectTrigger id="supervisor-select">
                            <SelectValue placeholder="Choose a supervisor" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredSupervisors.map((supervisor) => {
                              const conflict = selectedSchedule ? getSupervisorConflict(supervisor, selectedSchedule) : null;
                              return (
                                <SelectItem key={supervisor} value={supervisor}>
                                  <div className="flex items-center justify-between gap-3 w-full">
                                    <span>{supervisor}</span>
                                    {conflict ? (
                                      <span className="text-xs text-red-500 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> Busy
                                      </span>
                                    ) : (
                                      <span className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" /> Available
                                      </span>
                                    )}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>

                        {/* Time conflict warning */}
                        {selectedSupervisorConflict && (
                          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-700">{selectedSupervisorConflict}</p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowAddMemberDialog(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmAddMember}
                    className="bg-[#10B981] text-white hover:bg-[#0ea572]"
                    disabled={!selectedSupervisor || !!selectedSupervisorConflict}
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
