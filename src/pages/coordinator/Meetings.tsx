import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import {
  Video, Plus, Pencil, Trash2, RefreshCw, ExternalLink,
  Calendar, Clock, Users, X, Link2, MapPin,
} from 'lucide-react';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import {
  listMeetings, createMeeting, updateMeeting, deleteMeeting, resendInvitation,
  statusLabel, statusColors, detectMeetingProvider,
  type Meeting, type CreateMeetingPayload, type UpdateMeetingPayload,
} from '../../services/meetings';
import { supabase } from '../../lib/supabase';
// ─── Types ─────────────────────────────────────────────────────────────────────

interface Group { id: string; name: string; }

type MeetingType = 'online' | 'on_campus';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Meeting['status'] }) {
  const { bg, text, dot } = statusColors(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {statusLabel(status)}
    </span>
  );
}

// ─── Meeting Bar ──────────────────────────────────────────────────────────────

function MeetingBar({ label, url, location, status }: {
  label:     string;
  url?:      string | null;
  location?: string | null;
  status:    Meeting['status'];
}) {
  const isLive     = status === 'live';
  const isFinished = status === 'finished';

  if (!url) {
    return (
      <div className="flex items-center gap-2 w-full px-4 py-2.5 rounded-lg border bg-gray-50 border-gray-200 text-gray-600 text-sm font-medium">
        <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
        <span>{location || 'On Campus'}</span>
      </div>
    );
  }

  return (
    <a
      href={isFinished ? undefined : url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between w-full px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors
        ${isLive
          ? 'bg-green-50 border-green-300 text-green-800 hover:bg-green-100'
          : isFinished
          ? 'bg-gray-50 border-gray-200 text-gray-500 cursor-default pointer-events-none'
          : 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'}`}
    >
      <span className="flex items-center gap-2">
        <Video className="w-4 h-4" />
        {label}
      </span>
      <span className="flex items-center gap-1 text-xs opacity-75">
        <ExternalLink className="w-3 h-3" />
        {isFinished ? 'Finished' : 'Join Meeting'}
      </span>
    </a>
  );
}

// ─── Create / Edit Dialog ─────────────────────────────────────────────────────

interface DialogProps {
  groups:   Group[];
  initial?: Meeting | null;
  onSave:   (data: CreateMeetingPayload | UpdateMeetingPayload, id?: string) => Promise<void>;
  onClose:  () => void;
}

function MeetingDialog({ groups, initial, onSave, onClose }: DialogProps) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);

  const initDt = initial?.date_time ? initial.date_time.slice(0, 16) : '';
  const initType: MeetingType = initial?.meeting_url ? 'online' : 'on_campus';

  const [meetingType, setMeetingType] = useState<MeetingType>(initType);
  const [form, setForm] = useState({
    title:       initial?.title       ?? '',
    meeting_url: initial?.meeting_url ?? '',
    location:    initial?.location    ?? '',
    date:        initDt.split('T')[0] ?? '',
    time:        initDt.split('T')[1] ?? '09:00',
    group_id:    initial?.groups?.id  ?? (groups[0]?.id ?? ''),
    notes:       initial?.notes       ?? '',
  });

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date || !form.time || !form.group_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      const payload: CreateMeetingPayload = {
        title:       form.title.trim(),
        meeting_url: meetingType === 'online' ? (form.meeting_url.trim() || null) : null,
        location:    meetingType === 'on_campus' ? (form.location.trim() || null) : null,
        date_time:   new Date(`${form.date}T${form.time}`).toISOString(),
        group_id:    form.group_id,
        notes:       form.notes.trim() || undefined,
      };
      await onSave(isEdit ? { ...payload } : payload, initial?.id);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save meeting');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Meeting' : 'Schedule New Meeting'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Weekly Discussion"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
              required
            />
          </div>

          {/* Group (only for creation) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group *</label>
              {groups.length === 0 ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  No groups available for your course.
                </p>
              ) : (
                <select
                  value={form.group_id}
                  onChange={(e) => set('group_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] bg-white"
                  required
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Meeting Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Meeting Type</label>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setMeetingType('online')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                  ${meetingType === 'online'
                    ? 'bg-[var(--color-primary-600)] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <Video className="w-4 h-4" />
                Online
              </button>
              <button
                type="button"
                onClick={() => setMeetingType('on_campus')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-gray-300
                  ${meetingType === 'on_campus'
                    ? 'bg-[var(--color-primary-600)] text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <MapPin className="w-4 h-4" />
                On Campus
              </button>
            </div>
          </div>

          {/* Online URL (optional) */}
          {meetingType === 'online' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Meeting Link <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <Link2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={form.meeting_url}
                  onChange={(e) => set('meeting_url', e.target.value)}
                  placeholder="https://meet.google.com/..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
                />
              </div>
              {form.meeting_url && (
                <p className="mt-1 text-xs text-gray-500">
                  Platform: {detectMeetingProvider(form.meeting_url)}
                </p>
              )}
            </div>
          )}

          {/* On Campus Location (optional) */}
          {meetingType === 'on_campus' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location <span className="text-gray-400 font-normal">(optional — e.g. Room 204, Office B)</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => set('location', e.target.value)}
                  placeholder="e.g. Room 204 or Dr. Al-Farsi's Office"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
                />
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <DatePicker
                  value={form.date}
                  onChange={(d) => set('date', d)}
                  placeholder="Select date"
                />
              </div>
              <TimePicker
                value={form.time}
                onChange={(t) => set('time', t)}
                placeholder="Select time"
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
              placeholder="Any additional information for participants..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[var(--color-primary-600)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

interface CardProps {
  meeting:   Meeting;
  onEdit:    (m: Meeting) => void;
  onDelete:  (m: Meeting) => void;
  onResend:  (m: Meeting) => void;
}

function MeetingCard({ meeting, onEdit, onDelete, onResend }: CardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 font-medium mb-0.5 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {meeting.groups?.name ?? '—'}
          </p>
          <h3 className="text-base font-semibold text-gray-900 truncate">{meeting.title}</h3>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      {/* Date/Time */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-gray-400" />
          {new Date(meeting.date_time).toLocaleDateString('en-US', { dateStyle: 'medium' })}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-gray-400" />
          {new Date(meeting.date_time).toLocaleTimeString('en-US', { timeStyle: 'short' })}
        </span>
      </div>

      {/* Notes */}
      {meeting.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          {meeting.notes}
        </p>
      )}

      {/* Meeting Bars */}
      <div className="space-y-2">
        <MeetingBar
          label="Student Meeting"
          url={meeting.meeting_url}
          location={meeting.location}
          status={meeting.status}
        />
        {meeting.creator_role !== 'supervisor' && (
          <MeetingBar
            label="Supervisor Meeting"
            url={meeting.meeting_url}
            location={meeting.location}
            status={meeting.status}
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={() => onResend(meeting)}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Resend Invite
        </button>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => onEdit(meeting)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit meeting"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(meeting)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Cancel meeting"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CoordinatorMeetings() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [groups,   setGroups]   = useState<Group[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Meeting | null>(null);

  const activeRole = user?.activeRole ?? 'coordinator';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listMeetings(activeRole);
      setMeetings(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load meetings');
    } finally {
      setLoading(false);
    }
  }, [activeRole]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        let query = supabase
          .from('groups')
          .select('id, project_name, group_code, group_number')
          .order('group_number', { ascending: true });

        // Scope to coordinator's assigned course only
        if (user?.coordinatorCourseId) {
          query = query.eq('course_id', user.coordinatorCourseId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        setGroups((data || []).map((g: any) => ({
          id:   g.id,
          name: g.project_name || g.group_code || `Group ${g.group_number}`,
        })));
      } catch (err: any) {
        toast.error(err.message || 'Could not load groups');
      }
    }
    fetchGroups();
    load();
  }, [load, activeRole, user?.coordinatorCourseId]);

  async function handleSave(
    payload: CreateMeetingPayload | UpdateMeetingPayload,
    id?: string
  ) {
    if (id) {
      await updateMeeting(id, payload as UpdateMeetingPayload);
      toast.success('Meeting updated');
    } else {
      await createMeeting(payload as CreateMeetingPayload, activeRole);
      toast.success('Meeting scheduled');
    }
    await load();
  }

  async function handleDelete(meeting: Meeting) {
    if (!confirm(`Cancel "${meeting.title}"? All participants will be notified.`)) return;
    try {
      await deleteMeeting(meeting.id);
      toast.success('Meeting cancelled');
      setMeetings((prev) => prev.filter((m) => m.id !== meeting.id));
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel meeting');
    }
  }

  async function handleResend(meeting: Meeting) {
    try {
      const { message } = await resendInvitation(meeting.id, activeRole);
      toast.success(message);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend invitation');
    }
  }

  return (
    <Layout user={user!} pageTitle="Meetings">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Video className="w-6 h-6 text-[var(--color-primary-600)]" />
              Meetings
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Schedule and manage meetings for your course groups
            </p>
          </div>
          <button
            onClick={() => { setEditTarget(null); setShowDialog(true); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-(--color-primary-600) text-white rounded-lg text-sm font-medium hover:bg-(--color-primary-700) transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Meeting
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            Loading meetings…
          </div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
            <Video className="w-10 h-10 opacity-30" />
            <p className="text-sm">No meetings scheduled yet. Click <strong>New Meeting</strong> to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {meetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                onEdit={(mtg) => { setEditTarget(mtg); setShowDialog(true); }}
                onDelete={handleDelete}
                onResend={handleResend}
              />
            ))}
          </div>
        )}
      </div>

      {showDialog && (
        <MeetingDialog
          groups={groups}
          initial={editTarget}
          onSave={handleSave}
          onClose={() => setShowDialog(false)}
        />
      )}
    </Layout>
  );
}
