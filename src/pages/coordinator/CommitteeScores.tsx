import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAdminCommitteeScore, upsertAdminCommitteeScore } from '../../services/admin-committee-scores';
import { Save, Info } from 'lucide-react';
import type { AdminCommitteeScore } from '../../types';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string;
  groupCode: string;
  projectName: string;
  score: AdminCommitteeScore | null;
  draft: { poster: number; impl: number; testing: number };
  saving: boolean;
  dirty: boolean;
}

const SEMESTER = 'DEFAULT';

// ─── Component ───────────────────────────────────────────────────────────────

export function CoordinatorCommitteeScores() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Fetch CPIS-499 groups
        const { data: courseRow } = await supabase
          .from('courses')
          .select('id')
          .ilike('code', '%499%')
          .limit(1)
          .maybeSingle();

        if (!courseRow) { setLoading(false); return; }

        const { data: groupData } = await supabase
          .from('groups')
          .select('id, group_code, project_name')
          .eq('course_id', courseRow.id)
          .order('group_code');

        if (!groupData) { setLoading(false); return; }

        const rows: GroupRow[] = await Promise.all(
          groupData.map(async g => {
            const score = await getAdminCommitteeScore(g.id, SEMESTER);
            return {
              id:          g.id,
              groupCode:   g.group_code,
              projectName: g.project_name,
              score,
              draft: {
                poster:  score?.posterDayScore ?? 0,
                impl:    score?.implementationScore ?? 0,
                testing: score?.testingScore ?? 0,
              },
              saving: false,
              dirty:  false,
            };
          })
        );

        setGroups(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Update draft value ─────────────────────────────────────────────────────
  const updateDraft = (
    groupId: string,
    field: 'poster' | 'impl' | 'testing',
    raw: string
  ) => {
    const val = Math.min(5, Math.max(0, parseFloat(raw) || 0));
    setGroups(prev =>
      prev.map(g =>
        g.id === groupId
          ? { ...g, draft: { ...g.draft, [field]: val }, dirty: true }
          : g
      )
    );
  };

  // ── Save a single group ────────────────────────────────────────────────────
  const saveGroup = async (groupId: string) => {
    if (!user) return;
    const row = groups.find(g => g.id === groupId);
    if (!row) return;

    const total = row.draft.poster + row.draft.impl + row.draft.testing;
    if (total > 15) {
      toast.error(`Total for ${row.groupCode} exceeds 15 (got ${total})`);
      return;
    }

    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, saving: true } : g));
    try {
      await upsertAdminCommitteeScore({
        groupId,
        semester:            SEMESTER,
        posterDayScore:      row.draft.poster,
        implementationScore: row.draft.impl,
        testingScore:        row.draft.testing,
        gradedBy:            user.id,
      });
      const updated = await getAdminCommitteeScore(groupId, SEMESTER);
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, score: updated, saving: false, dirty: false } : g
      ));
      toast.success(`Saved scores for ${row.groupCode}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save scores');
      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, saving: false } : g));
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <Layout user={user} pageTitle="Senior Project Committee Scores">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout user={user} pageTitle="Senior Project Committee Scores — CPIS-499 (15%)">

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <Info className="mt-0.5 w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div className="text-sm text-indigo-800">
          <p className="font-medium mb-1">Graded by Coordinator only — CPIS-499 §15</p>
          <p>Each sub-component is out of <strong>5 marks</strong>. Total must not exceed <strong>15</strong>.
          Supervisors and committee members cannot edit these scores.</p>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-600)]">
          No CPIS-499 groups found.
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
              <tr>
                <th className="p-4 text-left text-[var(--color-text-700)]">Group</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Poster Day /5</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Implementation /5</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Testing /5</th>
                <th className="p-4 text-center text-[var(--color-text-700)]">Total /15</th>
                <th className="p-4 text-right text-[var(--color-text-700)]">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {groups.map(g => {
                const total = g.draft.poster + g.draft.impl + g.draft.testing;
                const invalid = total > 15;
                return (
                  <tr key={g.id} className={g.dirty ? 'bg-yellow-50/40' : ''}>
                    <td className="p-4">
                      <div className="font-medium text-[var(--color-text-900)]">{g.groupCode}</div>
                      <div className="text-xs text-[var(--color-text-600)]">{g.projectName}</div>
                    </td>

                    {/* Score inputs */}
                    {(['poster', 'impl', 'testing'] as const).map(field => (
                      <td key={field} className="p-4 text-center">
                        <input
                          type="number"
                          min={0}
                          max={5}
                          step={0.5}
                          value={g.draft[field]}
                          onChange={e => updateDraft(g.id, field, e.target.value)}
                          className="w-20 text-center border border-[var(--color-border)] rounded-lg p-1.5 text-[var(--color-text-900)] focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                      </td>
                    ))}

                    {/* Total */}
                    <td className="p-4 text-center">
                      <span className={`text-lg font-bold tabular-nums ${invalid ? 'text-red-600' : 'text-[var(--color-text-900)]'}`}>
                        {total.toFixed(1)}
                      </span>
                      {invalid && (
                        <div className="text-xs text-red-500 mt-0.5">Exceeds 15</div>
                      )}
                    </td>

                    {/* Save */}
                    <td className="p-4 text-right">
                      <Button
                        size="sm"
                        disabled={g.saving || !g.dirty || invalid}
                        onClick={() => saveGroup(g.id)}
                        className="h-7 text-xs"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        {g.saving ? 'Saving…' : 'Save'}
                      </Button>
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
