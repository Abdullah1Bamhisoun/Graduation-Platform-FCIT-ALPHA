import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import { Video, ExternalLink, Calendar, Clock, Tag, Users, MessageSquare, Plus, X, MapPin, Link2 } from 'lucide-react';
import {
  listMeetings, createMeeting, statusLabel, statusColors,
  type Meeting, type CreateMeetingPayload,
} from '../../services/meetings';
import { getGroupForStudent } from '../../services/groups';
import { DiscussionTab } from '../../components/meetings/DiscussionTab';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const { bg, text, dot } = statusColors(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} ${status === 'live' ? 'animate-pulse' : ''}`} />
      {statusLabel(status)}
    </span>
  );
}

function CreatorLabel({ role, name }: { role: Meeting['creator_role']; name?: string }) {
  const label =
    role === 'coordinator' ? 'Coordinator' :
    role === 'student'     ? (name ?? 'Student') :
    (name ?? 'Supervisor');
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <Tag className="w-3 h-3" />
      {label}
    </span>
  );
}

// ─── Meeting Bar ──────────────────────────────────────────────────────────────

function JoinBar({ meeting }: { meeting: Meeting }) {
  const { status, meeting_url } = meeting;
  const isFinished = status === 'finished';

  return (
    <a
      href={isFinished ? undefined : meeting_url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between w-full px-4 py-3 rounded-xl border text-sm font-semibold transition-all
        ${status === 'live'
          ? 'bg-green-700 border-green-700 text-white hover:bg-green-800 shadow-md shadow-green-700/30'
          : isFinished
          ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-default pointer-events-none'
          : 'bg-white border-[var(--color-primary-300)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]'}`}
    >
      <span className="flex items-center gap-2.5">
        <Video className="w-4 h-4" />
        {status === 'live' ? '🔴 Join Live Meeting' : isFinished ? 'Meeting Finished' : 'Join Meeting'}
      </span>
      {!isFinished && <ExternalLink className="w-4 h-4 opacity-70" />}
    </a>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md
      ${meeting.status === 'live' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CreatorLabel role={meeting.creator_role} name={meeting.profiles?.name} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 leading-snug">{meeting.title}</h3>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-gray-400" />
          {new Date(meeting.date_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          {new Date(meeting.date_time).toLocaleTimeString('en-US', { timeStyle: 'short' })}
        </span>
        {meeting.groups && (
          <span className="flex items-center gap-1.5">
            <Users className="w-4 h-4 text-gray-400" />
            {meeting.groups.name}
          </span>
        )}
      </div>

      {meeting.notes && (
        <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          📝 {meeting.notes}
        </p>
      )}

      <JoinBar meeting={meeting} />
    </div>
  );
}

// ─── Create Meeting Dialog ────────────────────────────────────────────────────

type MeetingType = 'online' | 'on_campus';

interface CreateDialogProps {
  onClose: () => void;
  onCreated: (m: Meeting) => void;
}

function CreateMeetingDialog({ onClose, onCreated }: CreateDialogProps) {
  const [saving, setSaving] = useState(false);
  const [meetingType, setMeetingType] = useState<MeetingType>('online');
  const [form, setForm] = useState({
    title:       '',
    meeting_url: '',
    location:    '',
    date:        '',
    time:        '09:00',
    notes:       '',
  });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time) {
      toast.error('Please fill in title, date, and time');
      return;
    }
    setSaving(true);
    try {
      const payload: Omit<CreateMeetingPayload, 'group_id'> = {
        title:       form.title.trim(),
        meeting_url: meetingType === 'online'    ? (form.meeting_url.trim() || null) : null,
        location:    meetingType === 'on_campus' ? (form.location.trim()    || null) : null,
        date_time:   new Date(`${form.date}T${form.time}`).toISOString(),
        notes:       form.notes.trim() || undefined,
      };
      // group_id is omitted — backend resolves it from the student's group membership
      const created = await createMeeting(payload as CreateMeetingPayload, 'student');
      toast.success('Meeting request sent! Your supervisor has been notified.');
      onCreated(created);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Request a Meeting</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Progress check-in"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600)"
              required
            />
          </div>

          {/* Meeting Type toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Type</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setMeetingType('online')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors
                  ${meetingType === 'online' ? 'bg-(--color-primary-600) text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Link2 className="w-4 h-4" /> Online
              </button>
              <button
                type="button"
                onClick={() => setMeetingType('on_campus')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors border-l border-gray-300
                  ${meetingType === 'on_campus' ? 'bg-(--color-primary-600) text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <MapPin className="w-4 h-4" /> On Campus
              </button>
            </div>
          </div>

          {/* URL or Location */}
          {meetingType === 'online' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
              <input
                type="url"
                value={form.meeting_url}
                onChange={(e) => set('meeting_url', e.target.value)}
                placeholder="https://meet.google.com/..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600)"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="e.g. Building 6, Room 201"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600)"
              />
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => set('date', e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600)"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => set('time', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600)"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Agenda, topics to discuss…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600) resize-none"
            />
          </div>

          <p className="text-xs text-gray-500">
            Your supervisor will receive an invitation email when you submit this request.
          </p>

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-(--color-primary-600) rounded-lg hover:bg-(--color-primary-700) disabled:opacity-60"
            >
              {saving ? 'Sending…' : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'meetings' | 'discussion';

export function StudentMeetings() {
  const { user } = useAuth();
  const [meetings,      setMeetings]      = useState<Meeting[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState<Tab>('meetings');
  const [myGroups,      setMyGroups]      = useState<{ id: string; name: string }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showCreate,    setShowCreate]    = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listMeetings('student');
      setMeetings(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    getGroupForStudent(user.id).then((g) => {
      if (g) setMyGroups([{ id: g.id, name: g.projectName || g.groupCode || `Group ${g.groupNumber}` }]);
      setGroupsLoading(false);
    });
  }, [user]);

  const upcoming = meetings.filter((m) => m.status !== 'finished');
  const past     = meetings.filter((m) => m.status === 'finished');

  return (
    <Layout user={user!} pageTitle="Meetings & Discussions">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Video className="w-6 h-6 text-(--color-primary-600)" />
              Meetings & Discussions
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Meetings and group discussions for your graduation project
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-(--color-primary-600) text-white text-sm font-medium rounded-lg hover:bg-(--color-primary-700) transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Request Meeting
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('meetings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === 'meetings'
                ? 'border-[var(--color-primary-600)] text-[var(--color-primary-700)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Video className="w-4 h-4" />
            Meetings
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === 'discussion'
                ? 'border-[var(--color-primary-600)] text-[var(--color-primary-700)]'
                : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <MessageSquare className="w-4 h-4" />
            Discussion
          </button>
        </div>

        {/* Meetings Tab */}
        {activeTab === 'meetings' && (
          loading ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading meetings…
            </div>
          ) : meetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
              <Video className="w-10 h-10 opacity-30" />
              <p className="text-sm">No meetings scheduled for your group yet.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-sm text-(--color-primary-600) hover:underline"
              >
                Request one from your supervisor →
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {upcoming.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Upcoming Meetings ({upcoming.length})
                  </h2>
                  <div className="space-y-4">
                    {upcoming.map((m) => <MeetingCard key={m.id} meeting={m} />)}
                  </div>
                </section>
              )}
              {past.length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Past Meetings ({past.length})
                  </h2>
                  <div className="space-y-4">
                    {past.map((m) => <MeetingCard key={m.id} meeting={m} />)}
                  </div>
                </section>
              )}
            </div>
          )
        )}

        {/* Discussion Tab */}
        {activeTab === 'discussion' && (
          groupsLoading ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Loading discussion…
            </div>
          ) : (
            <DiscussionTab
              groups={myGroups}
              currentUserId={user?.id ?? ''}
              currentUserName={user?.name ?? 'Student'}
              currentUserRole="student"
            />
          )
        )}
      </div>

      {showCreate && (
        <CreateMeetingDialog
          onClose={() => setShowCreate(false)}
          onCreated={(m) => setMeetings((prev) => [...prev, m].sort(
            (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
          ))}
        />
      )}
    </Layout>
  );
}
