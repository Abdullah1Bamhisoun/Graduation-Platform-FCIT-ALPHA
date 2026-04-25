import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, CalendarPlus } from 'lucide-react';
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
import { supabase } from '../../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';

interface SupervisorGroup {
  id: string;
  name: string;
}

function parseEventDates(event: CalendarEvent): { start: Date; end: Date; allDay: boolean } {
  const [year, month, day] = event.date.split('-').map(Number);
  if (event.time) {
    const m12 = event.time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    const m24 = event.time.trim().match(/^(\d{1,2}):(\d{2})$/);
    let h = -1, min = 0;
    if (m12) {
      h = parseInt(m12[1]); min = parseInt(m12[2]);
      if (m12[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (m12[3].toUpperCase() === 'AM' && h === 12) h = 0;
    } else if (m24) {
      h = parseInt(m24[1]); min = parseInt(m24[2]);
    }
    if (h >= 0) {
      const start = new Date(Date.UTC(year, month - 1, day, h, min));
      return { start, end: new Date(start.getTime() + 60 * 60 * 1000), allDay: false };
    }
  }
  const start = new Date(Date.UTC(year, month - 1, day));
  return { start, end: new Date(Date.UTC(year, month - 1, day + 1)), allDay: true };
}

function buildGoogleCalUrl(event: CalendarEvent): string {
  const ymd    = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const ymdhms = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const { start, end, allDay } = parseEventDates(event);
  const dates = allDay ? `${ymd(start)}/${ymd(end)}` : `${ymdhms(start)}/${ymdhms(end)}`;
  const params = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates });
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params}`;
}

function exportAllToIcs(events: CalendarEvent[]) {
  const ymd    = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const ymdhms = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const vevents = events.map((e) => {
    const { start, end, allDay } = parseEventDates(e);
    const dtStart = allDay
      ? `DTSTART;VALUE=DATE:${ymd(start)}`
      : `DTSTART:${ymdhms(start)}`;
    const dtEnd = allDay
      ? `DTEND;VALUE=DATE:${ymd(end)}`
      : `DTEND:${ymdhms(end)}`;
    const lines = [
      'BEGIN:VEVENT',
      `UID:${e.id}@fcit-platform`,
      dtStart,
      dtEnd,
      `SUMMARY:${e.title.replace(/,/g, '\\,')}`,
      e.location ? `LOCATION:${e.location.replace(/,/g, '\\,')}` : null,
      `CATEGORIES:${e.type.toUpperCase()}`,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n');
    return lines;
  }).join('\r\n');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FCIT Graduation Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    vevents,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'fcit-events.ics';
  a.click();
  URL.revokeObjectURL(url);
}

export function Calendar() {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [supervisorGroups, setSupervisorGroups] = useState<SupervisorGroup[]>([]);

  const isSupervisor = user?.activeRole === 'supervisor';
  const isCoordinatorOrAdmin = user?.role === 'admin' || user?.activeRole === 'coordinator';
  const canCreate = isCoordinatorOrAdmin || isSupervisor;

  useEffect(() => {
    getCalendarEvents().then((events) => {
      const seen = new Set<string>();
      setCalendarEvents(events.filter((e) => {
        const key = `${e.title}|${e.date}|${e.time ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    });
  }, []);

  useEffect(() => {
    if (!isSupervisor) return;
    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token ?? '';
      return apiFetch(apiUrl('/api/groups/mine'), {
        headers: { Authorization: `Bearer ${token}` },
      });
    })
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setSupervisorGroups(data))
      .catch(() => {});
  }, [isSupervisor]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    type: 'deadline' as CalendarEvent['type'],
    time: '',
    location: '',
    groupId: '',
  });

  const eventTypeColors = {
    deadline:     '!bg-white text-red-700 border-red-500 border-[1.5px]',
    demo:         '!bg-white text-blue-700 border-blue-500 border-[1.5px]',
    presentation: '!bg-white text-purple-700 border-purple-500 border-[1.5px]',
    meeting:      '!bg-white text-green-700 border-green-500 border-[1.5px]',
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

  const canDeleteEvent = (event: CalendarEvent) => {
    if (user?.role === 'admin') return true;
    if (user?.activeRole === 'coordinator' && event.courseId === user.coordinatorCourseId) return true;
    if (isSupervisor && event.groupId && supervisorGroups.some((g) => g.id === event.groupId)) return true;
    return false;
  };

  const handleAddEvent = async () => {
    if (!formData.title || !formData.date) {
      toast.error('Please fill in title and date');
      return;
    }
    if (isSupervisor && !formData.groupId) {
      toast.error('Please select a group');
      return;
    }

    try {
      const id = await createCalendarEvent({
        title:    formData.title,
        date:     formData.date,
        type:     formData.type,
        time:     formData.time || undefined,
        location: formData.location || undefined,
        groupId:  formData.groupId || undefined,
      });
      const groupName = supervisorGroups.find((g) => g.id === formData.groupId)?.name;
      setCalendarEvents((prev) => [
        ...prev,
        {
          id,
          title:    formData.title,
          date:     formData.date,
          type:     formData.type,
          time:     formData.time || undefined,
          location: formData.location || undefined,
          courseId: user?.role === 'admin' ? undefined : user?.coordinatorCourseId,
          groupId:  formData.groupId || undefined,
        },
      ]);
      toast.success(groupName ? `Event added for ${groupName}` : 'Event added successfully');
      setIsDialogOpen(false);
      setFormData({ title: '', date: '', type: 'deadline', time: '', location: '', groupId: '' });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add event');
    }
  };

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  if (!user) return null;

  const dialogDescription = user.role === 'admin'
    ? 'Create a new calendar event for all users'
    : isSupervisor
      ? 'Create a calendar event for one of your groups'
      : 'Create a new calendar event for your assigned course';

  return (
    <Layout user={user} pageTitle="Calendar">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[var(--color-text-600)]">
          View important dates, deadlines, and events
        </p>
        {canCreate && (
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
                <DialogDescription>{dialogDescription}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Group selector — supervisors only */}
                {isSupervisor && (
                  <div>
                    <Label htmlFor="eventGroup">Group *</Label>
                    <Select
                      value={formData.groupId}
                      onValueChange={(value) => setFormData({ ...formData, groupId: value })}
                    >
                      <SelectTrigger className="mt-1.5" id="eventGroup">
                        <SelectValue placeholder="Select a group" />
                      </SelectTrigger>
                      <SelectContent>
                        {supervisorGroups.map((g) => (
                          <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
                <Button onClick={handleAddEvent}>
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
                    className={`min-h-20 sm:min-h-26 border border-(--color-border) rounded-lg p-1.5 sm:p-2 overflow-hidden ${
                      isToday ? 'bg-[var(--color-primary-100)] border-[var(--color-primary-600)]' : 'bg-[var(--color-surface-white)]'
                    }`}
                  >
                    <div className={`text-sm sm:text-base mb-1 font-semibold text-center ${isToday ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-900)]'}`}>
                      {day}
                    </div>
                    {dayEvents.slice(0, 2).map((event, idx) => {
                      const isPast = event.date < new Date().toISOString().slice(0, 10);
                      return (
                        <a
                          key={idx}
                          href={buildGoogleCalUrl(event)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`block w-full text-[11px] leading-snug px-1 py-0.5 rounded mb-0.5 wrap-break-word line-clamp-2 font-medium ${isPast ? 'bg-gray-100! text-gray-400! border-gray-300! border' : eventTypeColors[event.type]}`}
                          title={`${event.title} — Add to Google Calendar`}
                        >
                          {event.title}
                        </a>
                      );
                    })}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] font-medium text-(--color-text-500) px-1">
                        +{dayEvents.length - 2} more
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
              {(() => {
                const monthStart = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-01`;
                const monthEnd   = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()).padStart(2, '0')}`;
                const today      = new Date().toISOString().slice(0, 10);
                const isCurrentMonth = currentMonth.getFullYear() === new Date().getFullYear() && currentMonth.getMonth() === new Date().getMonth();
                const upcoming = calendarEvents.filter((e) =>
                  e.date >= (isCurrentMonth ? today : monthStart) && e.date <= monthEnd
                );
                return (
                  <>
                    {upcoming.length > 0 && (
                      <button
                        onClick={() => exportAllToIcs(upcoming)}
                        className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-[#4285f4] hover:bg-[#3367d6] text-white text-sm font-semibold rounded-lg transition-colors"
                      >
                        <CalendarPlus className="w-4 h-4" />
                        Add All to Google Calendar
                      </button>
                    )}
                    {upcoming.map((event) => (
                      <div key={event.id} className={`p-4 border rounded-lg ${eventTypeColors[event.type]}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="mb-1">{event.title}</h3>
                          {canDeleteEvent(event) && (
                            <button
                              onClick={() => handleDeleteEvent(event.id)}
                              className="shrink-0 p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
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
                    {upcoming.length === 0 && (
                      <p className="text-sm text-(--color-text-500) text-center py-4">No upcoming events this month.</p>
                    )}
                  </>
                );
              })()}
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
