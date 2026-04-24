import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import {
  Video, Plus, Pencil, Trash2, RefreshCw, ExternalLink,
  Calendar, Clock, Users, X, Link2, Tag, MapPin, MessageSquare,
} from 'lucide-react';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import {
  listMeetings, createMeeting, updateMeeting, deleteMeeting, resendInvitation,
  statusLabel, statusColors, detectMeetingProvider,
  type Meeting, type CreateMeetingPayload, type UpdateMeetingPayload,
} from '../../services/meetings';
import { supabase } from '../../lib/supabase';
import { apiUrl, apiFetch } from '../../lib/api';
import { DiscussionTab } from '../../components/meetings/DiscussionTab';

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

function CreatorBadge({ role }: { role: 'coordinator' | 'supervisor' }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
      ${role === 'coordinator' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
      <Tag className="w-3 h-3" />
      {role === 'coordinator' ? 'By Coordinator' : 'By You'}
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
          ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-default pointer-events-none'
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
  groups:        Group[];
  initial?:      Meeting | null;
  isCoordinator?: boolean;
  onSave:        (payload: CreateMeetingPayload | UpdateMeetingPayload, id?: string) => Promise<void>;
  onSaveAll?:    (payload: Omit<CreateMeetingPayload, 'group_id'>) => Promise<void>;
  onClose:       () => void;
}

function MeetingDialog({ groups, initial, isCoordinator, onSave, onSaveAll, onClose }: DialogProps) {
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
    group_id:    initial?.groups?.id  ?? (isCoordinator ? 'all' : (groups[0]?.id ?? '')),
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
      const base = {
        title:       form.title.trim(),
        meeting_url: meetingType === 'online' ? (form.meeting_url.trim() || null) : null,
        location:    meetingType === 'on_campus' ? (form.location.trim() || null) : null,
        date_time:   new Date(`${form.date}T${form.time}`).toISOString(),
        notes:       form.notes.trim() || undefined,
      };

      if (!isEdit && form.group_id === 'all' && onSaveAll) {
        await onSaveAll(base);
      } else {
        const payload: CreateMeetingPayload = { ...base, group_id: form.group_id };
        await onSave(isEdit ? { ...payload } : payload, initial?.id);
      }
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Sprint Review"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
              required
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group *</label>
              {groups.length === 0 ? (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  No groups assigned to you yet. Contact your coordinator.
                </p>
              ) : (
                <select
                  value={form.group_id}
                  onChange={(e) => set('group_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] bg-white"
                  required
                >
                  {isCoordinator && (
                    <option value="all">— All Groups in Course ({groups.length}) —</option>
                  )}
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
                  placeholder="https://zoom.us/j/..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)]"
                />
              </div>
              {form.meeting_url && (
                <p className="mt-1 text-xs text-gray-500">Platform: {detectMeetingProvider(form.meeting_url)}</p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
              placeholder="Any additional info for students..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-600)] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >Cancel</button>
            <button
              type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[var(--color-primary-600)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-700)] disabled:opacity-50 transition-colors"
            >{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Schedule Meeting'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

interface CardProps {
  meeting:  Meeting;
  userId:   string;
  onEdit:   (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
  onResend: (m: Meeting) => void;
}

function MeetingCard({ meeting, userId, onEdit, onDelete, onResend }: CardProps) {
  const isOwner = meeting.created_by === userId;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {meeting.groups?.name ?? '—'}
            </p>
            <CreatorBadge role={meeting.creator_role} />
          </div>
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

      {/* Meeting Bar */}
      <MeetingBar
        label="Join Meeting"
        url={meeting.meeting_url}
        location={meeting.location}
        status={meeting.status}
      />

      {/* Actions (only for own meetings) */}
      {isOwner && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={() => onResend(meeting)}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Resend Invite
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => onEdit(meeting)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(meeting)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Cancel">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Group Section ────────────────────────────────────────────────────────────

function GroupSection({ groupName, meetings, userId, onEdit, onDelete, onResend }: {
  groupName: string;
  meetings:  Meeting[];
  userId:    string;
  onEdit:    (m: Meeting) => void;
  onDelete:  (m: Meeting) => void;
  onResend:  (m: Meeting) => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" />
        Group: {groupName}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {meetings.map((m) => (
          <MeetingCard
            key={m.id}
            meeting={m}
            userId={userId}
            onEdit={onEdit}
            onDelete={onDelete}
            onResend={onResend}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'meetings' | 'discussion';

export function SupervisorMeetings() {
  const { user } = useAuth();
  const [meetings,      setMeetings]      = useState<Meeting[]>([]);
  const [groups,        setGroups]        = useState<Group[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Meeting | null>(null);
  const [activeTab,  setActiveTab]  = useState<Tab>('meetings');

  const activeRole = user?.activeRole ?? 'supervisor';

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
    async function fetchMyGroups() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        if (activeRole === 'coordinator' || activeRole === 'admin') {
          // Use the dedicated coordinator-groups endpoint which scopes to their course
          const res = await apiFetch(apiUrl('/api/meetings/coordinator-groups'), {
            headers: {
              Authorization:   `Bearer ${session.access_token}`,
              'X-Active-Role': activeRole,
            },
          });
          if (!res.ok) throw new Error('Could not load groups');
          const data: Group[] = await res.json();
          setGroups(data);
        } else {
          // Supervisor: fetch groups where they are the supervisor
          const { data, error } = await supabase
            .from('groups')
            .select('id, project_name, group_code, group_number')
            .eq('supervisor_id', session.user.id)
            .order('group_number', { ascending: true });
          if (error) throw new Error(error.message);
          setGroups((data || []).map((g: any) => ({
            id:   g.id,
            name: g.project_name || g.group_code || `Group ${g.group_number}`,
          })));
        }
      } catch (err: any) {
        toast.error(err.message || 'Could not load groups');
      } finally {
        setGroupsLoading(false);
      }
    }
    fetchMyGroups();
    load();
  }, [load, activeRole, user?.id]);

  const byGroup = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
    const gName = m.groups?.name ?? 'Unknown Group';
    if (!acc[gName]) acc[gName] = [];
    acc[gName].push(m);
    return acc;
  }, {});

  async function handleSave(payload: CreateMeetingPayload | UpdateMeetingPayload, id?: string) {
    if (id) {
      await updateMeeting(id, payload as UpdateMeetingPayload);
      toast.success('Meeting updated');
    } else {
      await createMeeting(payload as CreateMeetingPayload, activeRole);
      toast.success('Meeting scheduled');
    }
    await load();
  }

  async function handleSaveAll(base: Omit<CreateMeetingPayload, 'group_id'>) {
    await Promise.all(
      groups.map((g) => createMeeting({ ...base, group_id: g.id }, activeRole))
    );
    toast.success(`Meeting scheduled for all ${groups.length} groups`);
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
    <Layout user={user!} pageTitle="Meetings & Discussions">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Video className="w-6 h-6 text-[var(--color-primary-600)]" />
              Meetings & Discussions
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage meetings and communicate with your groups
            </p>
          </div>
          {activeTab === 'meetings' && (
            <button
              onClick={() => { setEditTarget(null); setShowDialog(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary-600)] text-white rounded-lg text-sm font-medium hover:bg-[var(--color-primary-700)] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Meeting
            </button>
          )}
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
              <p className="text-sm">No meetings yet for your groups.</p>
            </div>
          ) : (
            Object.entries(byGroup).map(([groupName, groupMeetings]) => (
              <GroupSection
                key={groupName}
                groupName={groupName}
                meetings={groupMeetings}
                userId={user?.id ?? ''}
                onEdit={(m) => { setEditTarget(m); setShowDialog(true); }}
                onDelete={handleDelete}
                onResend={handleResend}
              />
            ))
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
              groups={groups}
              currentUserId={user?.id ?? ''}
              currentUserName={user?.name ?? 'Supervisor'}
              currentUserRole="supervisor"
            />
          )
        )}
      </div>

      {showDialog && (
        <MeetingDialog
          groups={groups}
          initial={editTarget}
          isCoordinator={activeRole === 'coordinator' || activeRole === 'admin'}
          onSave={handleSave}
          onSaveAll={handleSaveAll}
          onClose={() => setShowDialog(false)}
        />
      )}
    </Layout>
  );
}
