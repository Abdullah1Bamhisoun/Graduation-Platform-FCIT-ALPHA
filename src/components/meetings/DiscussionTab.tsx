import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Loader2, AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '@/lib/api';
import { toast } from 'sonner';

interface Group { id: string; name: string; }

interface DiscussionPost {
  id:          string;
  group_id:    string;
  user_id:     string;
  author_name: string;
  author_role: string;
  message:     string;
  created_at:  string;
}

interface Props {
  groups:          Group[];
  currentUserId:   string;
  currentUserName: string;
  currentUserRole: string;
}

const SETUP_SQL = `-- Run this once in your Supabase SQL editor:
create table if not exists group_discussions (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  author_name  text not null,
  author_role  text not null,
  message      text not null,
  created_at   timestamptz not null default now()
);
alter table group_discussions enable row level security;
create policy "auth read"   on group_discussions for select using (auth.role() = 'authenticated');
create policy "auth insert" on group_discussions for insert with check (auth.uid() = user_id);`;

export function DiscussionTab({ groups, currentUserId, currentUserName, currentUserRole }: Props) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id ?? '');
  const [posts,   setPosts]   = useState<DiscussionPost[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [tableError, setTableError] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedGroupId) return;
    let ignore = false;
    setLoading(true);
    setTableError(false);
    supabase
      .from('group_discussions')
      .select('*')
      .eq('group_id', selectedGroupId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (ignore) return;
        setLoading(false);
        if (error) {
          setTableError(true);
        } else {
          setPosts(data ?? []);
        }
      });

    const channel = supabase
      .channel(`disc-${selectedGroupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'group_discussions',
        filter: `group_id=eq.${selectedGroupId}`,
      }, (payload) => {
        setPosts((prev) => [...prev, payload.new as DiscussionPost]);
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, [selectedGroupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || !selectedGroupId) return;
    setSending(true);
    const { data: inserted, error } = await supabase
      .from('group_discussions')
      .insert({
        group_id:    selectedGroupId,
        user_id:     currentUserId,
        author_name: currentUserName,
        author_role: currentUserRole,
        message:     trimmed,
      })
      .select()
      .single();
    setSending(false);
    if (error) {
      toast.error('Failed to send message');
      return;
    }
    setMessage('');
    // Optimistically add to local state so the message appears immediately
    // without waiting for the realtime subscription
    if (inserted) {
      setPosts((prev) => {
        if (prev.some((p) => p.id === inserted.id)) return prev;
        return [...prev, inserted as DiscussionPost];
      });
    }

    // Fire email notification to the group (non-blocking)
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    if (token) {
      fetch(apiUrl('/api/meetings/discussions/notify'), {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${token}`,
        },
        body: JSON.stringify({
          group_id:    selectedGroupId,
          sender_name: currentUserName,
          sender_role: currentUserRole,
          message:     trimmed,
        }),
      }).catch(() => {}); // best-effort, don't block the UI
    }
  }

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <MessageSquare className="w-10 h-10 opacity-30" />
        <p className="text-sm">No groups available for discussion.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Group selector — always visible */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Group:</label>
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600) bg-white"
        >
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Table not set up */}
      {tableError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Discussion table not set up</p>
              <p className="text-sm text-amber-700 mt-1">
                Run the following SQL once in your Supabase dashboard to enable this feature.
              </p>
              <button
                onClick={() => setShowSql((v) => !v)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 hover:text-amber-900"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSql ? 'rotate-180' : ''}`} />
                {showSql ? 'Hide SQL' : 'Show SQL'}
              </button>
              {showSql && (
                <pre className="mt-3 p-3 bg-amber-100 rounded-lg text-xs text-amber-900 overflow-x-auto whitespace-pre-wrap border border-amber-200">
                  {SETUP_SQL}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-130">
          {/* Message list */}
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3 mb-3">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading…
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-400">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              posts.map((post) => {
                const isMe = post.user_id === currentUserId;
                return (
                  <div key={post.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm
                      ${isMe
                        ? 'bg-(--color-primary-600) text-white rounded-tr-sm'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'}`}>
                      <p className={`text-xs font-semibold mb-1 ${
                        isMe                              ? 'text-white/80'
                        : post.author_role === 'coordinator' ? 'text-purple-600'
                        : post.author_role === 'supervisor'  ? 'text-teal-600'
                        : 'text-blue-600'
                      }`}>
                        {isMe ? 'You' : post.author_name}
                        <span className="ml-1 font-normal opacity-70 capitalize">· {post.author_role}</span>
                      </p>
                      <p className="text-sm leading-relaxed">{post.message}</p>
                      <p className="text-xs mt-1 opacity-60 text-right">
                        {new Date(post.created_at).toLocaleTimeString('en-US', { timeStyle: 'short' })}
                        {' · '}
                        {new Date(post.created_at).toLocaleDateString('en-US', { dateStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Compose */}
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Message ${selectedGroup?.name ?? 'group'}…`}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary-600)"
            />
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="px-4 py-2.5 bg-(--color-primary-600) text-white rounded-xl text-sm font-medium hover:bg-(--color-primary-700) disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
