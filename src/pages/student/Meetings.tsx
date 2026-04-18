import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import { Video, ExternalLink, Calendar, Clock, Tag, Users, MessageSquare } from 'lucide-react';
import {
  listMeetings, statusLabel, statusColors,
  type Meeting,
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

function CreatorLabel({ role, name }: { role: 'coordinator' | 'supervisor'; name?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
      <Tag className="w-3 h-3" />
      {role === 'coordinator' ? 'Coordinator' : name ?? 'Supervisor'}
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
      {!isFinished && (
        <ExternalLink className="w-4 h-4 opacity-70" />
      )}
    </a>
  );
}

// ─── Meeting Card ─────────────────────────────────────────────────────────────

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-4 transition-shadow hover:shadow-md
      ${meeting.status === 'live' ? 'border-green-300 ring-2 ring-green-100' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <CreatorLabel role={meeting.creator_role} name={meeting.profiles?.name} />
          </div>
          <h3 className="text-base font-semibold text-gray-900 leading-snug">{meeting.title}</h3>
        </div>
        <StatusBadge status={meeting.status} />
      </div>

      {/* Date & Time */}
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

      {/* Notes */}
      {meeting.notes && (
        <p className="text-sm text-gray-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          📝 {meeting.notes}
        </p>
      )}

      {/* Join Button */}
      <JoinBar meeting={meeting} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'meetings' | 'discussion';

export function StudentMeetings() {
  const { user } = useAuth();
  const [meetings,   setMeetings]   = useState<Meeting[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState<Tab>('meetings');
  const [myGroups,      setMyGroups]      = useState<{ id: string; name: string }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(true);

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

  // Split into upcoming (scheduled + live) and past (finished)
  const upcoming = meetings.filter((m) => m.status !== 'finished');
  const past     = meetings.filter((m) => m.status === 'finished');

  return (
    <Layout user={user!} pageTitle="Meetings & Discussions">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Video className="w-6 h-6 text-[var(--color-primary-600)]" />
            Meetings & Discussions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Meetings and group discussions for your graduation project
          </p>
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
    </Layout>
  );
}
