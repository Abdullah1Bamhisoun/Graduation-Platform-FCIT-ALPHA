import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { apiUrl, apiFetch } from '@/lib/api';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { getGroupFiles, getRoleBadge, type GroupFile } from '../../services/groupFiles';
import { getSignedUrl } from '../../services/storage';
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  BookOpen, History, AlertTriangle, Info,
  Paperclip, Download, ChevronDown, ChevronUp, FileText,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TermEntry {
  year: number;
  term_code: string;
  term: string;
  isCurrent: boolean;
}

interface GradeEntry { score: number | null; max: number; }

interface HistoryStudent {
  id: string;
  name: string;
  student_id: string | null;
  grades: {
    supervisor:   GradeEntry;
    committee:    GradeEntry;
    weekly:       GradeEntry;
    deliverables: GradeEntry;
    peer:         GradeEntry;
    total:        number;
  };
}

interface HistoryGroup {
  id: string;
  group_code: string;
  group_number: number;
  course_number: string;
  project_name: string | null;
  department: string | null;
  gender: string | null;
  students: HistoryStudent[];
}

interface SchemeComponent {
  component_key: string;
  component_name: string;
  total_marks: number;
  evaluator_role: string;
}

interface SchemeCriteria {
  criterion_key: string;
  criterion_name: string;
  component_key: string;
  max_raw_score: number;
  description_1: string;
  description_2: string;
  description_3: string;
  description_4: string;
  description_5: string;
}

interface Scheme {
  components: SchemeComponent[];
  criteria:   SchemeCriteria[];
  isSnapshot: boolean;
}

interface TermData {
  year: number;
  term_code: string;
  term: string;
  groups: HistoryGroup[];
  scheme: { '498': Scheme; '499': Scheme };
}

const PASS_MARK = 60;

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Files section (lazy-loaded per group) ─────────────────────────────────────
function FilesSection({ groupId, activeRole }: { groupId: string; activeRole: string }) {
  const [open, setOpen]       = useState(false);
  const [files, setFiles]     = useState<GroupFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const result = await getGroupFiles(groupId, { activeRole });
      setFiles(result);
    } catch {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [groupId, activeRole, loaded]);

  const toggle = () => {
    if (!open && !loaded) load();
    setOpen((v) => !v);
  };

  const handleDownload = async (file: GroupFile) => {
    setDownloading(file.id);
    try {
      const url = await getSignedUrl(file.filePath);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.target = '_blank';
      a.click();
    } catch {
      toast.error('Failed to generate download link');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="border-t border-(--color-border)">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-2.5 text-sm font-medium text-(--color-text-600) hover:bg-(--color-surface-alt) transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          Files
          {loaded && (
            <span className="text-xs text-(--color-text-500)">({files.length})</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-5 pb-4">
          {loading ? (
            <p className="text-xs text-(--color-text-500) py-2">Loading files…</p>
          ) : files.length === 0 ? (
            <p className="text-xs text-(--color-text-500) italic py-2">No files submitted for this group.</p>
          ) : (
            <div className="space-y-1 mt-1">
              {files.map((f) => {
                const badge = getRoleBadge(f.uploaderRole);
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-(--color-border) bg-(--color-surface-alt) px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-3.5 h-3.5 text-(--color-text-500) shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-(--color-text-900) truncate">{f.fileName}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.className}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-(--color-text-500)">{f.uploaderName}</span>
                          <span className="text-[10px] text-(--color-text-400)">
                            {new Date(f.uploadedAt).toLocaleDateString()}
                          </span>
                          {f.fileSize && (
                            <span className="text-[10px] text-(--color-text-400)">{formatBytes(f.fileSize)}</span>
                          )}
                          {f.notes && (
                            <span className="text-[10px] text-(--color-text-600) italic truncate max-w-[160px]" title={f.notes}>
                              {f.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(f)}
                      disabled={downloading === f.id}
                      className="shrink-0 flex items-center gap-1 text-xs font-medium text-(--color-primary) hover:opacity-70 disabled:opacity-40 transition-opacity"
                    >
                      <Download className="w-3.5 h-3.5" />
                      {downloading === f.id ? '…' : 'Download'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function gradeColor(score: number | null, max: number) {
  if (score == null) return 'text-(--color-text-500)';
  const pct = (score / max) * 100;
  if (pct >= 70) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-500';
  return 'text-red-500';
}

function GradeCell({ label, score, max }: { label: string; score: number | null; max: number }) {
  return (
    <div className="text-center min-w-[52px]">
      <p className="text-[10px] text-(--color-text-500) font-medium uppercase tracking-wide leading-none mb-0.5">{label}</p>
      <p className={`text-xs font-semibold ${gradeColor(score, max)}`}>
        {score != null ? score : '—'}<span className="text-(--color-text-400) font-normal">/{max}</span>
      </p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function AdminTermHistory() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [terms, setTerms]           = useState<TermEntry[]>([]);
  const [termIdx, setTermIdx]       = useState(0);
  const [termData, setTermData]     = useState<TermData | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [mainTab, setMainTab]       = useState<'groups' | 'scheme'>('groups');
  const [courseFilter, setCourseFilter] = useState<'all' | '498' | '499'>('all');
  const [schemeTab, setSchemeTab]   = useState<'498' | '499'>('498');

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? '';
  }, []);

  // Load term list on mount
  useEffect(() => {
    (async () => {
      setLoadingList(true);
      try {
        const token = await getToken();
        const res = await apiFetch(apiUrl('/api/settings/terms-list'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const body = await res.json();
        const list: TermEntry[] = body.terms ?? [];
        setTerms(list);

        // Determine initial index from URL params or default to current term
        const qYear = searchParams.get('year');
        const qTc   = searchParams.get('term_code');
        if (qYear && qTc) {
          const idx = list.findIndex((t) => t.year === parseInt(qYear) && t.term_code === qTc);
          setTermIdx(idx >= 0 ? idx : 0);
        } else {
          const currentIdx = list.findIndex((t) => t.isCurrent);
          setTermIdx(currentIdx >= 0 ? currentIdx : 0);
        }
      } catch {
        toast.error('Failed to load term list');
      } finally {
        setLoadingList(false);
      }
    })();
  }, []);

  // Load term data whenever selected term changes
  const selectedTerm = terms[termIdx];
  useEffect(() => {
    if (!selectedTerm) return;
    setSearchParams({ year: String(selectedTerm.year), term_code: selectedTerm.term_code }, { replace: true });

    (async () => {
      setLoadingData(true);
      setTermData(null);
      try {
        const token = await getToken();
        const res = await apiFetch(
          apiUrl(`/api/settings/term-data?year=${selectedTerm.year}&term_code=${selectedTerm.term_code}`),
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) throw new Error();
        setTermData(await res.json());
      } catch {
        toast.error('Failed to load term data');
      } finally {
        setLoadingData(false);
      }
    })();
  }, [selectedTerm?.year, selectedTerm?.term_code]);

  const goTerm = (dir: -1 | 1) => {
    setTermIdx((i) => Math.max(0, Math.min(terms.length - 1, i + dir)));
  };

  if (!user) return null;

  const groups = termData?.groups ?? [];
  const visibleGroups = courseFilter === 'all'
    ? groups
    : groups.filter((g) => g.course_number === courseFilter);

  const allStudents = groups.flatMap((g) => g.students);
  const passCount   = allStudents.filter((s) => s.grades.total >= PASS_MARK).length;
  const failCount   = allStudents.filter((s) => s.grades.total < PASS_MARK).length;

  return (
    <Layout user={user} pageTitle="Term History" unreadCount={0}>

      {/* ── Term navigator ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-white) px-5 py-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-(--color-primary)" />
          <h1 className="text-base font-bold text-(--color-text-900)">Term History</h1>
        </div>

        {loadingList ? (
          <div className="h-10 w-64 bg-(--color-surface-alt) rounded-xl animate-pulse" />
        ) : terms.length === 0 ? (
          <p className="text-sm text-(--color-text-600)">No terms found.</p>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => goTerm(1)}
              disabled={termIdx >= terms.length - 1}
              className="p-1.5 rounded-lg border border-(--color-border) text-(--color-text-600) hover:bg-(--color-surface-alt) disabled:opacity-30 transition-colors"
              title="Older term"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center min-w-[180px]">
              <span className="text-xs text-(--color-text-500) font-medium uppercase tracking-widest">
                {selectedTerm?.term}
              </span>
              <span className="text-xl font-bold text-(--color-text-900)">{selectedTerm?.year}</span>
              {selectedTerm?.isCurrent && (
                <span className="mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-(--color-primary)/10 text-(--color-primary)">
                  Current Active Term
                </span>
              )}
            </div>

            <button
              onClick={() => goTerm(-1)}
              disabled={termIdx <= 0}
              className="p-1.5 rounded-lg border border-(--color-border) text-(--color-text-600) hover:bg-(--color-surface-alt) disabled:opacity-30 transition-colors"
              title="Newer term"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Jump list */}
        {terms.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {terms.map((t, i) => (
              <button
                key={`${t.year}_${t.term_code}`}
                onClick={() => setTermIdx(i)}
                className={[
                  'text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors',
                  i === termIdx
                    ? 'bg-(--color-primary) text-white border-(--color-primary)'
                    : 'border-(--color-border) text-(--color-text-600) hover:bg-(--color-surface-alt)',
                ].join(' ')}
              >
                {t.term_code === '01' ? 'S1' : 'S2'} {t.year}
                {t.isCurrent && ' ●'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Main tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-5 border-b border-(--color-border)">
        {(['groups', 'scheme'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMainTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize',
              mainTab === tab
                ? 'border-(--color-primary) text-(--color-primary)'
                : 'border-transparent text-(--color-text-600) hover:text-(--color-text-900)',
            ].join(' ')}
          >
            {tab === 'groups' ? 'Groups & Grades' : 'Grade Scheme'}
          </button>
        ))}
      </div>

      {loadingData ? (
        <div className="py-24 text-center text-(--color-text-600)">Loading term data…</div>
      ) : !termData ? null : (

        <>
          {/* ════════════════ GROUPS & GRADES TAB ════════════════ */}
          {mainTab === 'groups' && (
            <div>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Groups',   value: groups.length,      color: 'text-(--color-text-900)' },
                  { label: 'Students', value: allStudents.length,  color: 'text-(--color-text-900)' },
                  { label: 'Passed ≥ 60', value: passCount,        color: 'text-emerald-600' },
                  { label: 'Failed < 60', value: failCount,        color: 'text-red-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-(--color-border) bg-(--color-surface-white) px-4 py-3 text-center">
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-(--color-text-600) mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Course filter */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-(--color-text-600) font-medium">Show:</span>
                {(['all', '498', '499'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setCourseFilter(f)}
                    className={[
                      'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border',
                      courseFilter === f
                        ? 'bg-(--color-primary) text-white border-(--color-primary)'
                        : 'bg-(--color-surface-alt) border-(--color-border) text-(--color-text-700) hover:bg-(--color-surface-white)',
                    ].join(' ')}
                  >
                    {f === 'all' ? 'All' : `CPIS-${f}`}
                    {' '}({f === 'all' ? groups.length : groups.filter(g => g.course_number === f).length})
                  </button>
                ))}
              </div>

              {/* Group list */}
              {visibleGroups.length === 0 ? (
                <div className="py-20 text-center text-(--color-text-600)">No groups for this filter.</div>
              ) : (
                <div className="space-y-4">
                  {visibleGroups.map((group) => {
                    const gpassed = group.students.filter((s) => s.grades.total >= PASS_MARK).length;
                    const gfailed = group.students.filter((s) => s.grades.total <  PASS_MARK).length;
                    return (
                      <div key={group.id} className="rounded-2xl border border-(--color-border) bg-(--color-surface-white) shadow-sm overflow-hidden">
                        {/* Group header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-5 py-3.5 border-b border-(--color-border) bg-(--color-surface-alt)">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-(--color-primary)/10 text-(--color-primary) font-bold text-sm shrink-0">
                              {group.group_number}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-(--color-text-900) truncate">
                                {group.project_name ?? `Group ${group.group_number}`}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-(--color-text-600) flex-wrap">
                                <span className="font-mono bg-(--color-surface-white) border border-(--color-border) px-1.5 py-0.5 rounded text-[10px]">
                                  {group.group_code}
                                </span>
                                <span>CPIS-{group.course_number}</span>
                                {group.gender && <span className="capitalize">{group.gender}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />{gpassed} passed
                            </span>
                            {gfailed > 0 && (
                              <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                <XCircle className="w-3 h-3" />{gfailed} failed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Student rows */}
                        <div className="divide-y divide-(--color-border)">
                          {/* Column headers */}
                          <div className="hidden sm:grid grid-cols-[1fr_auto] gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-(--color-text-500)">
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

                          {group.students.length === 0 ? (
                            <p className="px-5 py-3 text-xs text-(--color-text-500) italic">No students in this group.</p>
                          ) : group.students.map((s) => {
                            const total    = s.grades.total;
                            const isPassed = total >= PASS_MARK;
                            return (
                              <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 sm:gap-4 px-5 py-3 items-center">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-(--color-text-900) truncate">{s.name}</p>
                                  {s.student_id && (
                                    <p className="text-xs text-(--color-text-500) font-mono">{s.student_id}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
                                  <GradeCell label="Sup"   score={s.grades.supervisor.score}   max={s.grades.supervisor.max} />
                                  <GradeCell label="Com"   score={s.grades.committee.score}    max={s.grades.committee.max} />
                                  <GradeCell label="Wkly"  score={s.grades.weekly.score}       max={s.grades.weekly.max} />
                                  <GradeCell label="Deliv" score={s.grades.deliverables.score} max={s.grades.deliverables.max} />
                                  <GradeCell label="Peer"  score={s.grades.peer.score}         max={s.grades.peer.max} />
                                  <div className="text-center min-w-[72px]">
                                    <p className="text-[10px] text-(--color-text-500) font-medium uppercase tracking-wide leading-none mb-0.5">Total</p>
                                    <p className={`text-sm font-bold ${isPassed ? 'text-emerald-600' : 'text-red-500'}`}>
                                      {total}<span className="text-(--color-text-400) font-normal text-xs">/100</span>
                                    </p>
                                  </div>
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
                              </div>
                            );
                          })}
                        </div>

                        {/* Files section — collapsible, lazy-loaded */}
                        <FilesSection groupId={group.id} activeRole={user.activeRole} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════════════════ GRADE SCHEME TAB ════════════════ */}
          {mainTab === 'scheme' && (
            <div>
              {/* Course sub-tabs */}
              <div className="flex gap-2 mb-5">
                {(['498', '499'] as const).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setSchemeTab(ct)}
                    className={[
                      'px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
                      schemeTab === ct
                        ? 'bg-(--color-primary) text-white border-(--color-primary)'
                        : 'bg-(--color-surface-alt) border-(--color-border) text-(--color-text-700) hover:bg-(--color-surface-white)',
                    ].join(' ')}
                  >
                    CPIS-{ct}
                  </button>
                ))}
              </div>

              {(() => {
                const scheme = termData.scheme[schemeTab];
                return (
                  <div className="space-y-5">
                    {/* Snapshot notice */}
                    {scheme.isSnapshot ? (
                      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" />
                        This is the grade scheme as it was snapshotted at the end of {selectedTerm?.term} {selectedTerm?.year}.
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                        No snapshot found for this term — showing the <strong>current</strong> grade scheme, which may differ from what was in effect then.
                      </div>
                    )}

                    {/* Components table */}
                    <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-white) overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-(--color-border) bg-(--color-surface-alt)">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-(--color-primary)" />
                          <h3 className="text-sm font-semibold text-(--color-text-900)">Grade Components — CPIS-{schemeTab}</h3>
                        </div>
                      </div>
                      {scheme.components.length === 0 ? (
                        <p className="px-5 py-4 text-sm text-(--color-text-500) italic">No components defined.</p>
                      ) : (
                        <div className="divide-y divide-(--color-border)">
                          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-(--color-text-500)">
                            <span>Component</span>
                            <span className="w-24 text-center">Evaluator</span>
                            <span className="w-20 text-right">Marks</span>
                          </div>
                          {scheme.components.map((c) => (
                            <div key={c.component_key} className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 items-center">
                              <div>
                                <p className="text-sm font-medium text-(--color-text-900)">{c.component_name}</p>
                                <p className="text-xs text-(--color-text-500) font-mono">{c.component_key}</p>
                              </div>
                              <span className="w-24 text-center text-xs text-(--color-text-600) capitalize">{c.evaluator_role}</span>
                              <span className="w-20 text-right text-sm font-bold text-(--color-text-900)">{c.total_marks}</span>
                            </div>
                          ))}
                          {/* Total row */}
                          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 bg-(--color-surface-alt)">
                            <span className="text-sm font-bold text-(--color-text-900)">Total</span>
                            <span className="w-24" />
                            <span className="w-20 text-right text-sm font-bold text-(--color-primary)">
                              {scheme.components.reduce((s, c) => s + c.total_marks, 0)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Criteria table */}
                    {scheme.criteria.length > 0 && (
                      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-white) overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-(--color-border) bg-(--color-surface-alt) flex items-center gap-2">
                          <Info className="w-4 h-4 text-(--color-primary)" />
                          <h3 className="text-sm font-semibold text-(--color-text-900)">Rubric Criteria — CPIS-{schemeTab}</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-(--color-border) bg-(--color-surface-alt)">
                                <th className="text-left px-4 py-2 text-(--color-text-500) font-semibold uppercase tracking-wider w-48">Criterion</th>
                                {[1, 2, 3, 4, 5].map((n) => (
                                  <th key={n} className="text-center px-3 py-2 text-(--color-text-500) font-semibold uppercase tracking-wider">{n}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-(--color-border)">
                              {scheme.criteria.map((c) => (
                                <tr key={c.criterion_key}>
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-(--color-text-900)">{c.criterion_name}</p>
                                    <p className="text-(--color-text-500) font-mono text-[10px]">{c.criterion_key}</p>
                                  </td>
                                  {[c.description_1, c.description_2, c.description_3, c.description_4, c.description_5].map((desc, i) => (
                                    <td key={i} className="px-3 py-3 text-center text-(--color-text-600) max-w-[120px]">
                                      {desc ?? '—'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
