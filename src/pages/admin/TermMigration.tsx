import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/ui/dialog';
import { apiUrl, apiFetch } from '@/lib/api';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import {
  ArrowRight, CheckCircle2, XCircle, ChevronLeft,
  BookOpen, AlertTriangle, AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CurrentTerm { term: string; year: number; term_code: string; }

interface GradeEntry { score: number | null; max: number; }

interface MigrationStudent {
  id: string;
  name: string;
  email: string;
  student_id: string | null;
  grades?: {
    supervisor:   GradeEntry;
    committee:    GradeEntry;
    weekly:       GradeEntry;
    deliverables: GradeEntry;
    peer:         GradeEntry;
    total:        number;
  };
}

interface MigrationGroup {
  id: string;
  group_code: string;
  new_group_code?: string;
  group_number: number;
  project_name: string | null;
  department: string | null;
  gender: string | null;
  students: MigrationStudent[];
}

const PASS_MARK = 60;

// ── Helpers ───────────────────────────────────────────────────────────────────
function gradeColor(score: number | null, max: number) {
  if (score == null) return 'text-[var(--color-text-500)]';
  const pct = (score / max) * 100;
  if (pct >= 70) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function GradeCell({ label, score, max }: { label: string; score: number | null; max: number }) {
  return (
    <div className="text-center min-w-[52px]">
      <p className="text-[10px] text-[var(--color-text-500)] font-medium uppercase tracking-wide leading-none mb-0.5">{label}</p>
      <p className={`text-xs font-semibold ${gradeColor(score, max)}`}>
        {score != null ? `${score}` : '—'}<span className="text-[var(--color-text-400)] font-normal">/{max}</span>
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function AdminTermMigration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Pending term passed via navigation state
  const pendingTerm: CurrentTerm | null = (location.state as any)?.pendingTerm ?? null;

  const [groups, setGroups]             = useState<MigrationGroup[]>([]);
  const [currentTerm, setCurrentTerm]   = useState<CurrentTerm | null>(null);
  const [loading, setLoading]           = useState(true);
  const [applying, setApplying]         = useState(false);
  const [filter, setFilter]             = useState<'all' | 'passed' | 'failed'>('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }, []);

  useEffect(() => {
    if (!pendingTerm) { navigate('/admin/settings', { replace: true }); return; }
    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const [previewRes, termRes] = await Promise.all([
          apiFetch(apiUrl('/api/settings/migration-preview'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          apiFetch(apiUrl('/api/settings/current-term')),
        ]);
        if (previewRes.ok) {
          const body = await previewRes.json();
          setGroups(body.groups498 ?? []);
        }
        if (termRes.ok) setCurrentTerm(await termRes.json());
      } catch (_) {
        toast.error('Failed to load migration data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConfirm = async () => {
    if (!pendingTerm) return;
    setApplying(true);
    try {
      const token = await getToken();
      const res = await apiFetch(apiUrl('/api/settings/current-term'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pendingTerm),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as any).error ?? `Error ${res.status}`);
      const migrated = (body as any).migratedGroups ?? 0;
      toast.success(`Term advanced to ${pendingTerm.term} ${pendingTerm.year}. ${migrated} group(s) migrated to CPIS-499.`);
      navigate('/admin/settings', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Migration failed');
    } finally {
      setApplying(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const allStudents  = groups.flatMap((g) => g.students);
  const passed       = allStudents.filter((s) => (s.grades?.total ?? 0) >= PASS_MARK);
  const failed       = allStudents.filter((s) => (s.grades?.total ?? 0) <  PASS_MARK);
  const noGrade      = allStudents.filter((s) => !s.grades || s.grades.total === 0);

  const visibleGroups = groups.map((g) => {
    if (filter === 'all') return g;
    const students = g.students.filter((s) =>
      filter === 'passed'
        ? (s.grades?.total ?? 0) >= PASS_MARK
        : (s.grades?.total ?? 0) <  PASS_MARK
    );
    return { ...g, students };
  }).filter((g) => g.students.length > 0);

  if (!user) return null;

  return (
    <Layout user={user} pageTitle="Term Migration Preview" unreadCount={0}>
      {/* ── Header banner ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-gradient-to-r from-[var(--color-primary)]/8 to-[var(--color-primary)]/3 px-6 py-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text-900)] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
              Advancing Term
            </h1>
            {/* Current → Next visual */}
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex flex-col items-center rounded-xl border border-[var(--color-border)] bg-white px-4 py-1.5 text-center shadow-sm">
                <span className="text-[10px] text-[var(--color-text-500)] uppercase tracking-widest font-semibold">Current</span>
                <span className="text-sm font-bold text-[var(--color-text-900)] leading-tight">
                  {currentTerm?.term ?? '—'}
                </span>
                <span className="text-xs font-semibold text-[var(--color-text-600)]">
                  {currentTerm?.year ?? ''}
                </span>
              </span>
              <ArrowRight className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
              <span className="inline-flex flex-col items-center rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-4 py-1.5 text-center shadow-sm">
                <span className="text-[10px] text-[var(--color-primary)] uppercase tracking-widest font-semibold">New Term</span>
                <span className="text-sm font-bold text-[var(--color-text-900)] leading-tight">{pendingTerm?.term}</span>
                <span className="text-xs font-semibold text-[var(--color-primary)]">{pendingTerm?.year}</span>
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={applying}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button onClick={() => setShowConfirmDialog(true)} disabled={applying || loading}>
              {applying ? 'Applying…' : 'Confirm & Migrate to CPIS-499'}
              {!applying && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total Groups"   value={groups.length}        color="text-[var(--color-text-900)]" />
          <StatCard label="Total Students" value={allStudents.length}   color="text-[var(--color-text-900)]" />
          <StatCard label="Passed ≥ 60"    value={passed.length}        color="text-emerald-600" />
          <StatCard label="Failed < 60"    value={failed.length}        color="text-red-500" />
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      {!loading && (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-[var(--color-text-600)] font-medium">Show:</span>
          {(['all', 'passed', 'failed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                filter === f
                  ? f === 'passed' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                    : f === 'failed' ? 'bg-red-100 text-red-700 border border-red-300'
                    : 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-alt)] border border-[var(--color-border)] text-[var(--color-text-700)] hover:bg-white',
              ].join(' ')}
            >
              {f === 'all' ? `All (${allStudents.length})` : f === 'passed' ? `Passed (${passed.length})` : `Failed (${failed.length})`}
            </button>
          ))}
        </div>
      )}

      {/* ── Warning banner if students have no grades ──────────────────── */}
      {!loading && noGrade.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>{noGrade.length}</strong> student(s) have no grades recorded — they show as 0/100.
            Verify grading is complete before confirming migration.
          </span>
        </div>
      )}

      {/* ── Group list ────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 text-center text-[var(--color-text-600)]">Loading CPIS-498 groups…</div>
      ) : visibleGroups.length === 0 ? (
        <div className="py-20 text-center text-[var(--color-text-600)]">No groups match the selected filter.</div>
      ) : (
        <div className="space-y-4">
          {visibleGroups.map((group) => {
            const groupPassed = group.students.filter((s) => (s.grades?.total ?? 0) >= PASS_MARK).length;
            const groupFailed = group.students.filter((s) => (s.grades?.total ?? 0) <  PASS_MARK).length;

            return (
              <div key={group.id} className="rounded-2xl border border-[var(--color-border)] bg-white shadow-sm overflow-hidden">
                {/* Group header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] font-bold text-sm shrink-0">
                      {group.group_number}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-text-900)] truncate">
                        {group.project_name ?? `Group ${group.group_number}`}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {group.department && (
                          <span className="text-xs text-[var(--color-text-600)]">{group.department}</span>
                        )}
                        {group.gender && (
                          <span className="text-xs text-[var(--color-text-600)] capitalize">{group.gender}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Code change badge */}
                    <div className="hidden sm:flex items-center gap-1">
                      <code className="text-[10px] bg-red-50 border border-red-200 text-red-600 px-1.5 py-0.5 rounded line-through">
                        {group.group_code}
                      </code>
                      <ArrowRight className="w-3 h-3 text-[var(--color-text-400)]" />
                      <code className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 px-1.5 py-0.5 rounded">
                        {group.new_group_code ?? group.group_code.replace(/_498_/g, '_499_')}
                      </code>
                    </div>
                    {/* Pass/fail summary */}
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />{groupPassed} passed
                      </span>
                      {groupFailed > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" />{groupFailed} failed
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Student rows */}
                <div className="divide-y divide-[var(--color-border)]">
                  {/* Column headers */}
                  <div className="hidden sm:grid grid-cols-[1fr_auto] gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-500)]">
                    <span>Student</span>
                    <div className="flex items-center gap-4 pr-2">
                      <span className="w-[52px] text-center">Sup/20</span>
                      <span className="w-[52px] text-center">Com/40</span>
                      <span className="w-[52px] text-center">Wkly/20</span>
                      <span className="w-[52px] text-center">Deliv/15</span>
                      <span className="w-[52px] text-center">Peer/5</span>
                      <span className="w-[72px] text-center">Total/100</span>
                      <span className="w-16 text-center">Status</span>
                    </div>
                  </div>

                  {group.students.map((s) => {
                    const total = s.grades?.total ?? 0;
                    const isPassed = total >= PASS_MARK;

                    return (
                      <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 px-5 py-3 items-center">
                        {/* Name + ID */}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--color-text-900)] truncate">{s.name}</p>
                          {s.student_id && (
                            <p className="text-xs text-[var(--color-text-500)] font-mono">{s.student_id}</p>
                          )}
                        </div>

                        {/* Grades */}
                        {s.grades ? (
                          <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
                            <GradeCell label="Sup"   score={s.grades.supervisor.score}   max={s.grades.supervisor.max} />
                            <GradeCell label="Com"   score={s.grades.committee.score}    max={s.grades.committee.max} />
                            <GradeCell label="Wkly"  score={s.grades.weekly.score}       max={s.grades.weekly.max} />
                            <GradeCell label="Deliv" score={s.grades.deliverables.score} max={s.grades.deliverables.max} />
                            <GradeCell label="Peer"  score={s.grades.peer.score}         max={s.grades.peer.max} />

                            {/* Total */}
                            <div className="text-center min-w-[72px]">
                              <p className="text-[10px] text-[var(--color-text-500)] font-medium uppercase tracking-wide leading-none mb-0.5">Total</p>
                              <p className={`text-sm font-bold ${isPassed ? 'text-emerald-600' : 'text-red-500'}`}>
                                {total}<span className="text-[var(--color-text-400)] font-normal text-xs">/100</span>
                              </p>
                            </div>

                            {/* Pass/Fail badge */}
                            <div className="min-w-[64px] flex justify-center">
                              {isPassed ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-300 text-emerald-700">
                                  <CheckCircle2 className="w-3 h-3" /> Pass
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 border border-red-300 text-red-600">
                                  <XCircle className="w-3 h-3" /> Fail
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--color-text-500)] italic">No grades recorded</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Bottom action bar ─────────────────────────────────────────────── */}
      {!loading && groups.length > 0 && (
        <div className="sticky bottom-0 mt-6 border-t border-[var(--color-border)] bg-white/95 backdrop-blur px-4 py-3 -mx-4 sm:-mx-6 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--color-text-600)]">
            <strong>{groups.length}</strong> group(s) · <strong className="text-emerald-600">{passed.length}</strong> passed · <strong className="text-red-500">{failed.length}</strong> failed
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)} disabled={applying}>Cancel</Button>
            <Button onClick={() => setShowConfirmDialog(true)} disabled={applying}>
              {applying ? 'Applying…' : 'Confirm & Migrate to CPIS-499'}
              {!applying && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </Button>
          </div>
        </div>
      )}
      {/* ── Confirmation Dialog ──────────────────────────────────────────── */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirm Migration
            </DialogTitle>
            <DialogDescription className="pt-1">
              You are about to advance to{' '}
              <strong>{pendingTerm?.term} {pendingTerm?.year}</strong> and migrate all{' '}
              <strong>{groups.length} CPIS-498 group(s)</strong> to CPIS-499.
            </DialogDescription>
          </DialogHeader>

          {/* Current → New term visual */}
          <div className="flex items-center justify-center gap-3 py-4">
            <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-text-500)] mb-1">Current</p>
              <p className="text-sm font-bold text-[var(--color-text-900)] leading-tight">{currentTerm?.term ?? '—'}</p>
              <p className="text-xs font-semibold text-[var(--color-text-600)]">{currentTerm?.year}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
            <div className="flex-1 rounded-xl border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/5 px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--color-primary)] mb-1">New Term</p>
              <p className="text-sm font-bold text-[var(--color-text-900)] leading-tight">{pendingTerm?.term}</p>
              <p className="text-xs font-semibold text-[var(--color-primary)]">{pendingTerm?.year}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
            Group codes will be updated from <code className="mx-0.5 bg-amber-100 px-1 rounded">_498_</code> to{' '}
            <code className="mx-0.5 bg-amber-100 px-1 rounded">_499_</code>. This cannot be automatically undone.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)} disabled={applying}>
              Cancel
            </Button>
            <Button onClick={async () => { setShowConfirmDialog(false); await handleConfirm(); }} disabled={applying}>
              {applying ? 'Applying…' : 'Confirm & Migrate to CPIS-499'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// ── Stat card helper ──────────────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 text-center shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-[var(--color-text-600)] mt-0.5">{label}</p>
    </div>
  );
}
