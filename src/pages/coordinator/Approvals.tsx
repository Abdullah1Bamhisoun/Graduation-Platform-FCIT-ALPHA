import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '@/lib/api';
import { CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

interface PendingReg {
  id: string;
  accountType: 'student' | 'supervisor';
  name: string;
  email: string;
  department: string | null;
  studentId: string | null;
  employeeNumber: string | null;
  course: string | null;
  term: string | null;
  projectName: string | null;
  projectIdea: string | null;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  groupId: string | null;
}

export function CoordinatorApprovals() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('groups');
  const [registrations, setRegistrations] = useState<PendingReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const loadRegistrations = useCallback(async () => {
    if (!user?.coordinatorCourseId) return;
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);

      const response = await fetch(apiUrl(`/api/auth/pending-registrations?${params}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Active-Role': 'coordinator',
        },
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        throw new Error(json.error || 'Failed to load registrations');
      }

      const data = await response.json();

      setRegistrations(
        (data || []).map((r: any) => ({
          id: r.id,
          accountType: r.account_type ?? 'student',
          name: r.name,
          email: r.email,
          department: r.department ?? null,
          studentId: r.student_id ?? null,
          employeeNumber: r.employee_number ?? null,
          course: r.course ?? null,
          term: r.term ?? null,
          projectName: r.project_name ?? null,
          projectIdea: r.project_idea ?? null,
          submittedAt: r.submitted_at,
          status: r.status,
          groupId: r.group_id ?? null,
        }))
      );
    } catch (err) {
      console.error('Error loading registrations:', err);
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [user?.coordinatorCourseId, filter]);

  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  const handleApprove = async (regId: string) => {
    setProcessing(regId);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(apiUrl('/api/auth/approve-registration'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Active-Role': 'coordinator',
        },
        body: JSON.stringify({ registrationId: regId }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Approval failed');

      toast.success('Registration approved successfully');
      await loadRegistrations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve registration');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (regId: string) => {
    setProcessing(regId);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const response = await fetch(apiUrl('/api/auth/reject-registration'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Active-Role': 'coordinator',
        },
        body: JSON.stringify({ registrationId: regId }),
      });

      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Rejection failed');

      toast.success('Registration rejected');
      await loadRegistrations();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject registration');
    } finally {
      setProcessing(null);
    }
  };

  if (!user?.coordinatorCourseId) {
    return (
      <Layout user={user!} pageTitle="Approvals">
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-800">No course assigned to your coordinator account. Contact an admin.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user!} pageTitle="Approvals">
      {isLocked && <LockedBanner />}
      <div className="space-y-5">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-[var(--color-primary-600)] text-white'
                    : 'bg-[var(--color-surface-alt)] text-[var(--color-text-600)] hover:bg-[var(--color-border)]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={loadRegistrations} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Registration list */}
        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">Loading registrations...</div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">
            No {filter === 'all' ? '' : filter} registrations found.
          </div>
        ) : (
          <div className="space-y-3">
            {registrations.map((reg) => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                processing={processing === reg.id}
                onApprove={() => handleApprove(reg.id)}
                onReject={() => handleReject(reg.id)}
                isLocked={isLocked}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Sub-component ──────────────────────────────────────────────────────────────

function RegistrationCard({
  reg, processing, onApprove, onReject, isLocked,
}: {
  reg: PendingReg;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
  isLocked: boolean;
}) {
  const statusStyles: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  const StatusIcon =
    reg.status === 'approved' ? CheckCircle :
    reg.status === 'rejected' ? XCircle : Clock;

  const isSupervisor = reg.accountType === 'supervisor';

  return (
    <div className="bg-[var(--color-surface-white)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        {/* Info */}
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-[var(--color-primary-600)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-[var(--color-text-900)]">{reg.name}</div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                isSupervisor
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isSupervisor ? 'Supervisor' : 'Student'}
              </span>
            </div>
            <div className="text-sm text-[var(--color-text-600)]">{reg.email}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              {reg.studentId && (
                <span className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full text-[var(--color-text-600)]">
                  Student ID: {reg.studentId}
                </span>
              )}
              {reg.employeeNumber && (
                <span className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full text-[var(--color-text-600)]">
                  Employee #: {reg.employeeNumber}
                </span>
              )}
              {reg.department && (
                <span className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full text-[var(--color-text-600)]">
                  {reg.department}
                </span>
              )}
              {reg.course && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                  {reg.course}
                </span>
              )}
              {reg.term && (
                <span className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full text-[var(--color-text-600)]">
                  Term: {reg.term}
                </span>
              )}
            </div>
            {reg.projectName && (
              <div className="mt-2 text-sm text-[var(--color-text-600)]">
                <span className="font-medium">Project:</span> {reg.projectName}
              </div>
            )}
            <div className="mt-1 text-xs text-[var(--color-text-600)]">
              Submitted {new Date(reg.submittedAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${statusStyles[reg.status]}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {reg.status}
          </span>

          {reg.status === 'pending' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={onReject}
                disabled={isLocked || processing}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={onApprove}
                disabled={isLocked || processing}
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                {processing ? 'Processing…' : 'Approve'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
