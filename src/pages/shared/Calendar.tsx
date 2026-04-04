import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { getCalendarEvents, createCalendarEvent, deleteCalendarEvent } from '../../services/calendarEvents';
import type { CalendarEvent } from '../../services/calendarEvents';

export function Calendar() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    getCalendarEvents().then(setCalendarEvents);
  }, []);
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

  const handleDeleteEvent = async (id: string) => {
    try {
      await deleteCalendarEvent(id);
      setCalendarEvents((prev) => prev.filter((e) => e.id !== id));
      toast.success('Event deleted');
    } catch {
      toast.error('Failed to delete event');
    }
  };

  const handleAddEvent = async () => {
    if (!formData.title || !formData.date) {
      toast.error('Please fill in title and date');
      return;
    }

    try {
      const id = await createCalendarEvent({
        title: formData.title,
        date: formData.date,
        type: formData.type,
        time: formData.time || undefined,
        location: formData.location || undefined,
      });
      setCalendarEvents((prev) => [
        ...prev,
        { id, title: formData.title, date: formData.date, type: formData.type, time: formData.time || undefined, location: formData.location || undefined, courseId: user?.role === 'admin' ? undefined : user?.coordinatorCourseId },
      ]);
      toast.success('Event added successfully');
      setIsDialogOpen(false);
      setFormData({ title: '', date: '', type: 'deadline', time: '', location: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add event');
    }
  };

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="Calendar">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          View important dates, deadlines, and events
        </p>
        {(user.role === 'admin' || user.activeRole === 'coordinator') && (
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
                  {user.role === 'admin'
                    ? 'Create a new calendar event for all users'
                    : 'Create a new calendar event for your assigned course'}
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
                  <Label>Date *</Label>
                  <div className="mt-1.5">
                    <DatePicker
                      value={formData.date}
                      onChange={(date) => setFormData({ ...formData, date })}
                      placeholder="Select event date"
                    />
                  </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="col-span-1 lg:col-span-2 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
          {/* Calendar Header */}
          <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
            <h2 className="text-[var(--color-text-900)]">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-1.5 sm:p-6">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-1 sm:mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-[var(--color-text-600)] py-1 text-xs sm:text-sm">
                  <span className="sm:hidden">{day.charAt(0)}</span>
                  <span className="hidden sm:inline">{day}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {Array.from({ length: firstDayOfMonth }, (_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const date = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEvents = calendarEvents.filter(e => e.date === date);
                const today = new Date();
                const isToday = day === today.getDate() && currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();

                return (
                  <div
                    key={day}
                    className={`min-h-[4rem] sm:min-h-[5rem] border border-[var(--color-border)] rounded-lg p-1.5 sm:p-2 overflow-hidden ${
                      isToday ? 'bg-[var(--color-primary-100)] border-[var(--color-primary-600)]' : 'bg-[var(--color-surface-white)]'
                    }`}
                  >
                    <div className={`text-sm sm:text-base mb-1 font-semibold text-center ${isToday ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-900)]'}`}>
                      {day}
                    </div>
                    {dayEvents.slice(0, 2).map((event, idx) => (
                      <div
                        key={idx}
                        className={`text-[10px] sm:text-xs px-1 py-0.5 rounded mb-0.5 border truncate ${eventTypeColors[event.type]}`}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-[var(--color-text-500)] px-1">
                        +{dayEvents.length - 2}
                      </div>
                    )}
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
              {calendarEvents.map((event) => (
                <div key={event.id} className={`p-4 border rounded-lg ${eventTypeColors[event.type]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="mb-1">{event.title}</h3>
                    {(user.role === 'admin' || (user.activeRole === 'coordinator' && event.courseId === user.coordinatorCourseId)) && (
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="flex-shrink-0 p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
                        title="Delete event"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
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
