import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../components/ui/popover';
import { Input } from '../../components/ui/input';
import { mockUsers } from '../../lib/mock-data';
import {
  Calendar,
  Clock,
  MapPin,
  Plus,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface AvailabilityBlock {
  id: string;
  day: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu';
  startTime: string;
  endTime: string;
}

interface AssignedSession {
  id: string;
  day: 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu';
  date: string;
  time: string;
  room: string;
  projectName: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'] as const;
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '13:00', '14:00', '15:00', '16:00', '17:00'
];

const mockAssignedSessions: AssignedSession[] = [
  {
    id: '1',
    day: 'Mon',
    date: 'Dec 2, 2024',
    time: '09:00 - 09:30',
    room: 'Room A-101',
    projectName: 'Graduation Project Platform',
  },
];

export function SupervisorMyAvailability() {
  const user = mockUsers.supervisor;
  
  const [term, setTerm] = useState('2026-01');
  const [course, setCourse] = useState<'498' | '499' | 'both'>('both');
  const [sessionDuration] = useState(30);
  const [bufferDuration] = useState(10);
  const [maxSessionsPerDay, setMaxSessionsPerDay] = useState(4);
  const [allowBackToBack, setAllowBackToBack] = useState(false);
  
  const [availabilityBlocks, setAvailabilityBlocks] = useState<AvailabilityBlock[]>([
    {
      id: 'block1',
      day: 'Mon',
      startTime: '09:00',
      endTime: '11:00',
    },
    {
      id: 'block2',
      day: 'Mon',
      startTime: '14:00',
      endTime: '16:00',
    },
    {
      id: 'block3',
      day: 'Tue',
      startTime: '10:00',
      endTime: '12:00',
    },
  ]);
  
  const [assignedSessions] = useState<AssignedSession[]>(mockAssignedSessions);
  const [editingBlock, setEditingBlock] = useState<AvailabilityBlock | null>(null);
  const [showEditPopover, setShowEditPopover] = useState(false);

  // Calculate slots per day
  const getSlotsForDay = (day: typeof DAYS[number]) => {
    const blocks = availabilityBlocks.filter(b => b.day === day);
    let totalSlots = 0;
    blocks.forEach(block => {
      const start = timeToMinutes(block.startTime);
      const end = timeToMinutes(block.endTime);
      const duration = end - start;
      const slots = Math.floor(duration / (sessionDuration + bufferDuration));
      totalSlots += slots;
    });
    return totalSlots;
  };

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const getTotalSlots = () => {
    return DAYS.reduce((sum, day) => sum + getSlotsForDay(day), 0);
  };

  const handleCreateBlock = (day: typeof DAYS[number], startTime: string) => {
    const newBlock: AvailabilityBlock = {
      id: `block-${Date.now()}`,
      day,
      startTime,
      endTime: minutesToTime(timeToMinutes(startTime) + 60), // 1 hour default
    };
    setEditingBlock(newBlock);
    setShowEditPopover(true);
  };

  const handleEditBlock = (block: AvailabilityBlock) => {
    setEditingBlock({ ...block });
    setShowEditPopover(true);
  };

  const handleSaveBlock = () => {
    if (!editingBlock) return;

    // Validation
    if (timeToMinutes(editingBlock.endTime) <= timeToMinutes(editingBlock.startTime)) {
      toast.error('End time must be after start time');
      return;
    }

    // Check if creating new or editing existing
    const existingIndex = availabilityBlocks.findIndex(b => b.id === editingBlock.id);
    if (existingIndex >= 0) {
      // Update existing
      const newBlocks = [...availabilityBlocks];
      newBlocks[existingIndex] = editingBlock;
      setAvailabilityBlocks(newBlocks);
      toast.success('Availability updated');
    } else {
      // Create new
      setAvailabilityBlocks([...availabilityBlocks, editingBlock]);
      toast.success('Availability added');
    }

    setShowEditPopover(false);
    setEditingBlock(null);
  };

  const handleDeleteBlock = (blockId: string) => {
    setAvailabilityBlocks(availabilityBlocks.filter(b => b.id !== blockId));
    toast.success('Availability removed');
    setShowEditPopover(false);
    setEditingBlock(null);
  };

  const handleSaveAvailability = () => {
    toast.success('Availability saved successfully');
  };

  const getBlocksForDayTime = (day: typeof DAYS[number], time: string) => {
    const timeInMinutes = timeToMinutes(time);
    return availabilityBlocks.filter(block => {
      if (block.day !== day) return false;
      const startMinutes = timeToMinutes(block.startTime);
      const endMinutes = timeToMinutes(block.endTime);
      return timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
    });
  };

  const isTimeInBlock = (day: typeof DAYS[number], time: string) => {
    return getBlocksForDayTime(day, time).length > 0;
  };

  // Check conflicts
  const getConflictsForDay = (day: typeof DAYS[number]) => {
    const slots = getSlotsForDay(day);
    if (slots > maxSessionsPerDay) {
      return `Exceeds max ${maxSessionsPerDay} sessions/day`;
    }
    return null;
  };

  return (
    <Layout user={user} pageTitle="My Availability – Presentation Week">
      {/* Header Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Select value={term} onValueChange={setTerm}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2026-01">Term 1, 2026</SelectItem>
            <SelectItem value="2026-02">Term 2, 2026</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex rounded-lg border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setCourse('498')}
            className={`px-4 py-2 text-sm transition-colors ${
              course === '498' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
            }`}
          >
            CPIS-498
          </button>
          <button
            onClick={() => setCourse('both')}
            className={`px-4 py-2 text-sm border-x border-[var(--color-border)] transition-colors ${
              course === 'both' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setCourse('499')}
            className={`px-4 py-2 text-sm transition-colors ${
              course === '499' ? 'bg-[var(--color-primary-600)] text-white' : 'bg-white text-[var(--color-text-600)] hover:bg-gray-50'
            }`}
          >
            CPIS-499
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-900 mb-1">
            Set your availability for presentation week. Click or drag on the calendar to create time blocks.
          </p>
          <p className="text-xs text-blue-800">
            Session duration: {sessionDuration} min • Buffer: {bufferDuration} min • Max {maxSessionsPerDay} sessions/day
          </p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Main Calendar */}
        <div className="flex-1">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Availability Calendar</h3>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-[var(--color-border)] p-2 bg-[var(--color-surface-alt)] w-24 text-xs text-[var(--color-text-600)]">
                      Time
                    </th>
                    {DAYS.map((day) => {
                      const conflict = getConflictsForDay(day);
                      return (
                        <th key={day} className="border border-[var(--color-border)] p-2 bg-[var(--color-surface-alt)] min-w-[140px]">
                          <div className="text-sm text-[var(--color-text-900)]">{day}</div>
                          <div className="text-xs text-[var(--color-text-600)]">
                            {getSlotsForDay(day)} slots
                          </div>
                          {conflict && (
                            <div className="text-xs text-red-600 mt-1">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              Exceeds max
                            </div>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((time) => (
                    <tr key={time}>
                      <td className="border border-[var(--color-border)] p-2 text-xs text-[var(--color-text-600)] text-center bg-[var(--color-surface-alt)]">
                        {time}
                      </td>
                      {DAYS.map((day) => {
                        const blocks = getBlocksForDayTime(day, time);
                        const inBlock = blocks.length > 0;
                        
                        return (
                          <td
                            key={day}
                            className="border border-[var(--color-border)] p-1 align-top"
                          >
                            {inBlock ? (
                              <div
                                onClick={() => handleEditBlock(blocks[0])}
                                className="p-2 rounded cursor-pointer bg-green-50 border border-green-300 hover:bg-green-100 transition-colors"
                              >
                                <div className="text-xs text-green-900">
                                  Available
                                </div>
                                <div className="text-xs text-green-700 mt-1">
                                  {blocks[0].startTime} - {blocks[0].endTime}
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleCreateBlock(day, time)}
                                className="w-full h-full min-h-[60px] flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition-colors rounded"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Assigned Sessions (Read-only) */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Assigned Sessions (Read-Only)</h3>
            {assignedSessions.length > 0 ? (
              <div className="space-y-3">
                {assignedSessions.map((session) => (
                  <div key={session.id} className="p-4 border border-[var(--color-border)] rounded-lg bg-blue-50">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[var(--color-text-900)] mb-2">{session.projectName}</div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-text-600)]">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>{session.date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>{session.time}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{session.room}</span>
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 border border-green-200">
                        Confirmed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No sessions assigned yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-[320px] flex-shrink-0">
          <div className="space-y-6 sticky top-6">
            {/* Offered Slots Summary */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <h3 className="text-[var(--color-text-900)] mb-4">Offered Slots Summary</h3>
              
              <div className="space-y-3 mb-6">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-600)]">{day}</span>
                    <span className="px-2 py-1 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">
                      {getSlotsForDay(day)} slots
                    </span>
                  </div>
                ))}
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-900)]">Total</span>
                  <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {getTotalSlots()} slots
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="max-sessions" className="text-sm mb-2 block">Max Sessions Per Day</Label>
                  <Input
                    id="max-sessions"
                    type="number"
                    value={maxSessionsPerDay}
                    onChange={(e) => setMaxSessionsPerDay(parseInt(e.target.value) || 0)}
                    min={1}
                    max={10}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="back-to-back" className="text-sm">Allow back-to-back</Label>
                  <Switch
                    id="back-to-back"
                    checked={allowBackToBack}
                    onCheckedChange={setAllowBackToBack}
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveAvailability}
                className="w-full mt-6 bg-green-600 hover:bg-green-700 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Availability
              </Button>
            </div>

            {/* Guidance */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
              <h4 className="text-sm text-[var(--color-text-900)] mb-3">Guidance</h4>
              <ul className="space-y-2 text-xs text-[var(--color-text-600)]">
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Click any empty cell to add availability</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Click green blocks to edit or remove</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Students will only see project names</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-600">•</span>
                  <span>Save before the admin schedules presentations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Block Popover */}
      <Dialog open={showEditPopover} onOpenChange={setShowEditPopover}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingBlock && availabilityBlocks.find(b => b.id === editingBlock.id) ? 'Edit' : 'Create'} Availability</DialogTitle>
            <DialogDescription>
              Set your available time block
            </DialogDescription>
          </DialogHeader>

          {editingBlock && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Day</Label>
                <Select
                  value={editingBlock.day}
                  onValueChange={(value) => setEditingBlock({ ...editingBlock, day: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day) => (
                      <SelectItem key={day} value={day}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={editingBlock.startTime}
                    onChange={(e) => setEditingBlock({ ...editingBlock, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={editingBlock.endTime}
                    onChange={(e) => setEditingBlock({ ...editingBlock, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
                This block will create approximately{' '}
                <strong>
                  {Math.floor((timeToMinutes(editingBlock.endTime) - timeToMinutes(editingBlock.startTime)) / (sessionDuration + bufferDuration))}
                </strong>{' '}
                presentation slots
              </div>
            </div>
          )}

          <DialogFooter>
            {editingBlock && availabilityBlocks.find(b => b.id === editingBlock.id) && (
              <Button
                variant="outline"
                onClick={() => handleDeleteBlock(editingBlock.id)}
                className="mr-auto text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => setShowEditPopover(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveBlock} className="bg-[var(--color-primary-600)] hover:bg-[var(--color-primary-700)] text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
