import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { getStudentPresentationSelections } from '../../services/presentations';
import { StudentPresentationSelection as StudentPresentationSelectionType } from '../../types';
import { Save, X, Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

const AVAILABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Sunday'];
const TIME_SLOTS = [
  '9:00 AM - 9:30 AM',
  '9:30 AM - 10:00 AM',
  '10:00 AM - 10:30 AM',
  '10:30 AM - 11:00 AM',
  '11:00 AM - 11:30 AM',
  '11:30 AM - 12:00 PM',
  '1:00 PM - 1:30 PM',
  '1:30 PM - 2:00 PM',
  '2:00 PM - 2:30 PM',
  '2:30 PM - 3:00 PM',
];

export function StudentPresentationSelection() {
  const { user } = useAuth();
  const [selections, setSelections] = useState<StudentPresentationSelectionType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStudentPresentationSelections()
      .then(setSelections)
      .finally(() => setLoading(false));
  }, []);
  const [showSelectionDialog, setShowSelectionDialog] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('');

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Presentation Time Selection"><div className="p-6">Loading...</div></Layout>;

  // Find student's group
  const myGroup = selections.find(s => s.students.some(st => st.id === user.id || st.id === user.studentId));

  const handleSelectSlot = () => {
    if (!selectedDay || !selectedTimeSlot) {
      toast.error('Please select both day and time slot');
      return;
    }

    const updatedSelections = selections.map(s => {
      if (s.groupId === myGroup?.groupId) {
        return {
          ...s,
          selectedDay,
          selectedTimeSlot,
          selectedAt: new Date().toISOString(),
        };
      }
      return s;
    });

    setSelections(updatedSelections);
    setShowSelectionDialog(false);
    setSelectedDay('');
    setSelectedTimeSlot('');
    toast.success('Presentation time slot selected successfully!');
  };

  return (
    <Layout user={user} pageTitle="Presentation Time Selection">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Select your preferred presentation time slot for the final evaluation
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-[var(--color-text-900)]">
            <strong>Note:</strong> Please coordinate with your group members before selecting a time slot. Once selected, the admin will review and confirm your presentation schedule.
          </p>
        </div>
      </div>

      {myGroup && (
        <div className="space-y-6">
          {/* Group Information */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Your Group Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[var(--color-text-600)]">Group Name</Label>
                <div className="text-[var(--color-text-900)]">{myGroup.groupName}</div>
              </div>
              <div>
                <Label className="text-[var(--color-text-600)]">Group ID</Label>
                <div className="text-[var(--color-text-900)]">{myGroup.groupId}</div>
              </div>
              <div>
                <Label className="text-[var(--color-text-600)]">Project Name</Label>
                <div className="text-[var(--color-text-900)]">{myGroup.projectName}</div>
              </div>
              <div>
                <Label className="text-[var(--color-text-600)]">Group Members</Label>
                <div className="text-[var(--color-text-900)]">
                  {myGroup.students.map(s => s.name).join(', ')}
                </div>
              </div>
            </div>
          </div>

          {/* Current Selection */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--color-text-900)]">Selected Time Slot</h3>
              <Button 
                onClick={() => setShowSelectionDialog(true)}
                className="bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]"
              >
                {myGroup.selectedDay ? 'Change Selection' : 'Select Time Slot'}
              </Button>
            </div>

            {myGroup.selectedDay && myGroup.selectedTimeSlot ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[var(--color-text-600)]" />
                    <div>
                      <Label className="text-[var(--color-text-600)]">Day</Label>
                      <div className="text-[var(--color-text-900)]">{myGroup.selectedDay}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[var(--color-text-600)]" />
                    <div>
                      <Label className="text-[var(--color-text-600)]">Time</Label>
                      <div className="text-[var(--color-text-900)]">{myGroup.selectedTimeSlot}</div>
                    </div>
                  </div>
                </div>
                {myGroup.selectedAt && (
                  <div className="text-[var(--color-text-600)]">
                    Selected on: {new Date(myGroup.selectedAt).toLocaleString()}
                  </div>
                )}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
                  ✓ Your time slot has been submitted and is pending admin confirmation
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <p>No time slot selected yet</p>
                <p className="mt-2">Click the button above to select your preferred presentation time</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selection Dialog */}
      <Dialog open={showSelectionDialog} onOpenChange={setShowSelectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Presentation Time Slot</DialogTitle>
            <DialogDescription>
              Choose your preferred day and time slot for your presentation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <Label htmlFor="day-select" className="text-[var(--color-text-900)]">Select Day *</Label>
              <Select value={selectedDay} onValueChange={setSelectedDay}>
                <SelectTrigger id="day-select" className="mt-2">
                  <SelectValue placeholder="Choose a day" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_DAYS.map((day) => (
                    <SelectItem key={day} value={day}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="time-select" className="text-[var(--color-text-900)]">Select Time Slot *</Label>
              <Select value={selectedTimeSlot} onValueChange={setSelectedTimeSlot}>
                <SelectTrigger id="time-select" className="mt-2">
                  <SelectValue placeholder="Choose a time slot" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800">
              <p>Please coordinate with all group members before selecting a time slot.</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowSelectionDialog(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSelectSlot} className="bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]">
                <Save className="w-4 h-4 mr-2" />
                Confirm Selection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
