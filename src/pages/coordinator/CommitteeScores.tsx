/**
 * Coordinator: Senior Project Coordinator Grades — CPIS-499 (10 marks)
 *
 * Official CPIS-499 Coordinator Deliverables:
 * - Demo 1:                 2 marks
 * - Demo 2:                 2 marks
 * - Poster Day:             2 marks
 * - Chapter Implementation: 2 marks
 * - Chapter Testing:        2 marks
 * Total:                   10 marks
 *
 * Uses coordinator_deliverable_scores table.
 * Falls back to group_deliverable_grades / admin_committee_scores for legacy data.
 */

import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  getRubricCriteria,
  getCoordinatorDeliverableScores,
  saveAllCoordinatorDeliverables,
  type RubricCriterion,
} from '../../services/grading-rubric';
import { Save, Info, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GroupRow {
  id: string;
  groupCode: string;
  projectName: string;
  courseId: string;
  draft: Record<string, number>;  // deliverableKey → score
  saved: Record<string, number>;
  saving: boolean;
  dirty: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoordinatorCommitteeScores() {
  const { user } = useAuth();
  const [groups, setGroups]       = useState<GroupRow[]>([]);
  const [criteria, setCriteria]   = useState<RubricCriterion[]>([]);
  const [loading, setLoading]     = useState(true);

  const totalMax = criteria.reduce((s, c) => s + c.maxRawScore, 0);

  useEffect(() => {
    if (!user) return;
    ;(async () => {
      try {
        // Load criteria for 499 coordinator deliverables
        const crit = await getRubricCriteria('499', 'coordinator_deliverables');
        setCriteria(crit);

        // Fetch CPIS-499 course
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
            const scores = await getCoordinatorDeliverableScores(g.id, courseRow.id);
            const saved: Record<string, number> = {};
            const draft: Record<string, number> = {};
            for (const s of scores) {
              saved[s.deliverableKey]  = s.score;
              draft[s.deliverableKey]  = s.score;
            }
            // Ensure all keys are present
            for (const c of crit) {
              if (draft[c.criterionKey] === undefined) draft[c.criterionKey] = 0;
              if (saved[c.criterionKey] === undefined) saved[c.criterionKey] = 0;
            }
            return {
              id: g.id, groupCode: g.group_code, projectName: g.project_name,
              courseId: courseRow.id, draft, saved, saving: false, dirty: false,
            };
          })
        );
        setGroups(rows);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const updateDraft = (groupId: string, key: string, raw: string, max: number) => {
    const val = Math.min(max, Math.max(0, parseFloat(raw) || 0));
    setGroups(prev => prev.map(g =>
      g.id === groupId
        ? { ...g, draft: { ...g.draft, [key]: val }, dirty: true }
        : g
    ));
  };

  const saveGroup = async (groupId: string) => {
    if (!user) return;
    const row = groups.find(g => g.id === groupId);
    if (!row) return;

    const total = criteria.reduce((s, c) => s + (row.draft[c.criterionKey] ?? 0), 0);
    if (total > totalMax) {
      toast.error(`Total for ${row.groupCode} exceeds ${totalMax} (got ${total.toFixed(1)})`);
      return;
    }

    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, saving: true } : g));
    try {
      await saveAllCoordinatorDeliverables({
        groupId,
        courseId:   row.courseId,
        courseType: '499',
        scores:     row.draft,
        gradedBy:   user.id,
      });
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, saved: { ...g.draft }, saving: false, dirty: false } : g
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
      <Layout user={user} pageTitle="Senior Project Coordinator Grades — CPIS-499">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout user={user} pageTitle="Senior Project Coordinator Grades — CPIS-499 (10 marks)">

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
        <Info className="mt-0.5 w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div className="text-sm text-indigo-800">
          <p className="font-semibold mb-1">CPIS-499 — Senior Project Coordinator (10 marks)</p>
          <p>
            Enter grades for each deliverable. Totals are auto-calculated.
            Only the Course Coordinator can enter these scores.
          </p>
        </div>
      </div>

      {/* Criteria reference */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {criteria.map(c => (
          <div key={c.criterionKey} className="bg-white border border-[var(--color-border)] rounded-lg p-3 text-center">
            <div className="text-xs text-[var(--color-text-600)] leading-tight">{c.criterionName}</div>
            <div className="text-lg font-bold text-[var(--color-text-900)] mt-1">{c.maxRawScore}</div>
            <div className="text-xs text-[var(--color-text-500)]">marks</div>
          </div>
        ))}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <div className="text-xs text-blue-700 font-semibold">Total Maximum</div>
          <div className="text-lg font-bold text-blue-900 mt-1">{totalMax}</div>
          <div className="text-xs text-blue-600">marks</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-600)]">
          No CPIS-499 groups found.
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
                <tr>
                  <th className="p-4 text-left text-[var(--color-text-700)]">Group</th>
                  {criteria.map(c => (
                    <th key={c.criterionKey} className="p-3 text-center text-[var(--color-text-700)] whitespace-nowrap">
                      {c.criterionName}<br />
                      <span className="text-xs font-normal text-[var(--color-text-500)]">/{c.maxRawScore}</span>
                    </th>
                  ))}
                  <th className="p-4 text-center text-[var(--color-text-700)]">Total<br /><span className="text-xs font-normal">/{totalMax}</span></th>
                  <th className="p-4 text-right text-[var(--color-text-700)]">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {groups.map(g => {
                  const total   = criteria.reduce((s, c) => s + (g.draft[c.criterionKey] ?? 0), 0);
                  const invalid = total > totalMax;
                  const allSaved = criteria.every(c => g.saved[c.criterionKey] !== undefined);
                  return (
                    <tr key={g.id} className={g.dirty ? 'bg-yellow-50/40' : ''}>
                      <td className="p-4">
                        <div className="font-medium text-[var(--color-text-900)]">{g.groupCode}</div>
                        <div className="text-xs text-[var(--color-text-600)]">{g.projectName}</div>
                        {allSaved && !g.dirty && (
                          <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                            <CheckCircle className="w-3 h-3" />Saved
                          </div>
                        )}
                      </td>

                      {criteria.map(c => (
                        <td key={c.criterionKey} className="p-3 text-center">
                          <Input
                            type="number"
                            min={0}
                            max={c.maxRawScore}
                            step={0.5}
                            value={g.draft[c.criterionKey] ?? 0}
                            onChange={e => updateDraft(g.id, c.criterionKey, e.target.value, c.maxRawScore)}
                            className="w-16 text-center border border-[var(--color-border)] rounded-lg p-1.5 text-[var(--color-text-900)] focus:outline-none focus:ring-2 focus:ring-indigo-300 mx-auto"
                          />
                        </td>
                      ))}

                      <td className="p-4 text-center">
                        <span className={`text-lg font-bold tabular-nums ${invalid ? 'text-red-600' : 'text-[var(--color-text-900)]'}`}>
                          {total.toFixed(1)}
                        </span>
                        {invalid && (
                          <div className="text-xs text-red-500 mt-0.5">Exceeds {totalMax}</div>
                        )}
                      </td>

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
        </div>
      )}
    </Layout>
  );
}
