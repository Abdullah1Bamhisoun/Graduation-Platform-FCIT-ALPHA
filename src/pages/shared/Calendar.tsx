import { Layout } from '../../components/layout/Layout';
import { mockUsers } from '../../lib/mock-data';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { useState } from 'react';

interface CalendarEvent {
  date: string;
  title: string;
  type: 'deadline' | 'demo' | 'presentation' | 'meeting';
  time?: string;
  location?: string;
}

const events: CalendarEvent[] = [
  { date: '2025-11-10', title: 'Final Report Due', type: 'deadline' },
  { date: '2025-11-15', title: 'Project Demos', type: 'demo', time: '10:00 AM', location: 'Building 51, Lab 201' },
  { date: '2025-11-20', title: 'Poster Presentations', type: 'presentation', time: '9:00 AM', location: 'Building 51, Hall A' },
  { date: '2025-11-25', title: 'Supervisor Meeting', type: 'meeting', time: '2:00 PM' },
];

interface CalendarProps {
  userRole: 'student' | 'supervisor' | 'admin';
}

export function Calendar({ userRole }: CalendarProps) {
  const user = mockUsers[userRole];
  const [currentMonth] = useState(new Date(2025, 10, 1)); // November 2025
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(events);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: 'deadline' as CalendarEvent['type'],
    time: '',
    location: '',
  });

  const eventTypeColors = {
    deadline: '!bg-white text-red-700 border-red-500 border-[1.5px]',
    demo: '!bg-white text-blue-700 border-blue-500 border-[1.5px]',
    presentation: '!bg-white text-purple-700 border-purple-500 border-[1.5px]',
    meeting: '!bg-white text-green-700 border-green-500 border-[1.5px]',
  };

  const handleAddEvent = () => {
    if (!formData.title || !formData.date) {
      toast.error('Please fill in title and date');
      return;
    }

    const newEvent: CalendarEvent = {
      title: formData.title,
      date: formData.date,
      type: formData.type,
      time: formData.time || undefined,
      location: formData.location || undefined,
    };

    setCalendarEvents([...calendarEvents, newEvent]);
    toast.success('Event added successfully');
    setIsDialogOpen(false);
    setFormData({ title: '', date: '', type: 'deadline', time: '', location: '' });
  };

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  return (
    <Layout user={user} pageTitle="Calendar">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          View important dates, deadlines, and events
        </p>
        {userRole === 'admin' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Event
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Event</DialogTitle>
                <DialogDescription>
                  Create a new calendar event for all users
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="eventTitle">Event Title *</Label>
                  <Input
                    id="eventTitle"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter event title"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="eventDate">Date *</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="eventType">Event Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as CalendarEvent['type'] })}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select event type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deadline">Deadline</SelectItem>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="presentation">Presentation</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="eventTime">Time (Optional)</Label>
                  <Input
                    id="eventTime"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    placeholder="e.g., 10:00 AM"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="eventLocation">Location (Optional)</Label>
                  <Input
                    id="eventLocation"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Building 51, Lab 201"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleAddEvent}
                >
                  Add Event
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="col-span-2 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
          {/* Calendar Header */}
          <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
            <h2 className="text-[var(--color-text-900)]">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-[var(--color-text-600)] py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: firstDayOfMonth }, (_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const date = `2025-11-${day.toString().padStart(2, '0')}`;
                const dayEvents = calendarEvents.filter(e => e.date === date);
                const isToday = day === 3; // Nov 3, 2025

                return (
                  <div
                    key={day}
                    className={`aspect-square border border-[var(--color-border)] rounded-lg p-2 ${
                      isToday ? 'bg-[var(--color-primary-100)] border-[var(--color-primary-600)]' : 'bg-[var(--color-surface-white)]'
                    }`}
                  >
                    <div className={`mb-1 ${isToday ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-900)]'}`}>
                      {day}
                    </div>
                    {dayEvents.map((event, idx) => (
                      <div
                        key={idx}
                        className={`text-xs px-1 py-0.5 rounded mb-1 border ${eventTypeColors[event.type]}`}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="space-y-6">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="p-6 border-b border-[var(--color-border)]">
              <h2 className="text-[var(--color-text-900)] flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Upcoming Events
              </h2>
            </div>
            <div className="p-6 space-y-4">
              {calendarEvents.map((event, index) => (
                <div key={index} className={`p-4 border rounded-lg ${eventTypeColors[event.type]}`}>
                  <h3 className="mb-1">{event.title}</h3>
                  <p className="mb-1">
                    {new Date(event.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {event.time && <p>{event.time}</p>}
                  {event.location && <p>{event.location}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Legend</h3>
            <div className="space-y-2">
              {Object.entries(eventTypeColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded border ${color}`}></div>
                  <span className="text-[var(--color-text-900)] capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
