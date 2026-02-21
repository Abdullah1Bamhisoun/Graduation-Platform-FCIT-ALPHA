import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../lib/AuthContext';
import { getLateRequests, approveLateRequest, rejectLateRequest } from '../../services/late-requests';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import type { LateRequest } from '../../types';
import { toast } from 'sonner';

type CourseTab = '498' | '499';
const SEMESTER = 'DEFAULT';

const STATUS_STYLES: Record<string, string> = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending:  <Clock className="w-3.5 h-3.5" />,
  approved: <CheckCircle className="w-3.5 h-3.5" />,
  rejected: <XCircle className="w-3.5 h-3.5" />,
};

export function CoordinatorLateRequests() {
  const { user } = useAuth();
  const [activeTab, setActiveTab]   = useState<CourseTab>('498');
  const [requests498, setReqs498]   = useState<LateRequest[]>([]);
  const [requests499, setReqs499]   = useState<LateRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [actionId, setActionId]     = useState<string | null>(null);

  const requests = activeTab === '498' ? requests498 : requests499;

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [r498, r499] = await Promise.all([
          getLateRequests('498', SEMESTER),
          getLateRequests('499', SEMESTER),
        ]);
        setReqs498(r498);
        setReqs499(r499);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const refresh = async () => {
    const [r498, r499] = await Promise.all([
      getLateRequests('498', SEMESTER),
      getLateRequests('499', SEMESTER),
    ]);
    setReqs498(r498);
    setReqs499(r499);
  };

  const handleApprove = async (req: LateRequest) => {
    if (!user) return;
    setActionId(req.id);
    try {
      await approveLateRequest(req.id, user.id);
      await refresh();
      toast.success(`Approved late request for Group Week ${req.weekNumber}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve request');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (req: LateRequest) => {
    if (!user) return;
    setActionId(req.id);
    try {
      await rejectLateRequest(req.id, user.id);
      await refresh();
      toast.success(`Rejected late request for Week ${req.weekNumber}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject request');
    } finally {
      setActionId(null);
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <Layout user={user} pageTitle="Late Submission Requests">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <Layout user={user} pageTitle="Late Submission Requests">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] text-sm">
          Review and action late submission requests from student groups.
          Approving re-opens the week <em>for that group only</em>.
        </p>
      </div>

      {/* Course tabs */}
      <div className="flex gap-2 mb-6">
        {(['498', '499'] as const).map(ct => (
          <button
            key={ct}
            onClick={() => setActiveTab(ct)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeTab === ct
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-[var(--color-surface-white)] text-[var(--color-text-700)] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
            }`}
          >
            CPIS-{ct}
          </button>
        ))}
        {pendingCount > 0 && (
          <span className="ml-auto self-center text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-2.5 py-1 rounded-full">
            {pendingCount} pending
          </span>
        )}
      </div>

      {/* Requests table */}
      {requests.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-600)]">
          No late submission requests for CPIS-{activeTab}.
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
              <tr>
                <th className="p-4 text-left text-[var(--color-text-700)]">Group</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Week</th>
                <th className="p-4 text-left text-[var(--color-text-700)]">Reason</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Requested</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Status</th>
                <th className="p-4 text-right text-[var(--color-text-700)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {requests.map(req => {
                const busy = actionId === req.id;
                return (
                  <tr key={req.id}>
                    <td className="p-4 text-[var(--color-text-900)] font-mono text-xs">{req.groupId.slice(0, 8)}…</td>
                    <td className="p-4 text-center font-medium text-[var(--color-text-900)]">Week {req.weekNumber}</td>
                    <td className="p-4 text-[var(--color-text-700)] max-w-xs">
                      {req.reason || <span className="italic text-[var(--color-text-600)]">No reason provided</span>}
                    </td>
                    <td className="p-4 text-center text-[var(--color-text-600)] text-xs">
                      {new Date(req.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full border ${STATUS_STYLES[req.status]}`}>
                        {STATUS_ICONS[req.status]}
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4">
                      {req.status === 'pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-green-600 border-green-300 hover:bg-green-50"
                            disabled={busy}
                            onClick={() => handleApprove(req)}
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600 border-red-300 hover:bg-red-50"
                            disabled={busy}
                            onClick={() => handleReject(req)}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="text-right text-xs text-[var(--color-text-600)]">
                          {req.reviewedAt ? new Date(req.reviewedAt).toLocaleDateString() : '—'}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
}
