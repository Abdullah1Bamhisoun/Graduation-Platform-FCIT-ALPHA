import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { supabase } from '../../lib/supabase';
import { BookOpen, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';

interface Milestone {
  id: string;
  name: string;
  type: string;
  openDate: string;
  dueDate: string;
  visible: boolean;
  allowLateSubmission: boolean;
}

export function CoordinatorMilestonesConfig() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('milestones');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.coordinatorCourseId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('id, name, type, open_date, due_date, visible, allow_late_submission')
        .eq('course_id', user.coordinatorCourseId)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setMilestones(
        (data || []).map((m) => ({
          id: m.id,
          name: m.name,
          type: m.type,
          openDate: m.open_date,
          dueDate: m.due_date,
          visible: m.visible,
          allowLateSubmission: m.allow_late_submission,
        }))
      );
    } catch (err) {
      console.error('Error loading milestones:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.coordinatorCourseId]);

  useEffect(() => { load(); }, [load]);

  const toggleVisibility = async (id: string, current: boolean) => {
    setToggling(id);
    try {
      const { error } = await supabase
        .from('milestones')
        .update({ visible: !current })
        .eq('id', id);
      if (error) throw error;
      setMilestones((prev) => prev.map((m) => m.id === id ? { ...m, visible: !current } : m));
      toast.success(`Milestone ${!current ? 'made visible' : 'hidden'}`);
    } catch (err) {
      toast.error('Failed to update milestone');
    } finally {
      setToggling(null);
    }
  };

  return (
    <Layout user={user!} pageTitle="Milestone Configuration">
      {isLocked && <LockedBanner />}
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">Loading milestones…</div>
        ) : milestones.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">No milestones configured for this course.</div>
        ) : (
          <div className="space-y-3">
            {milestones.map((m) => (
              <div
                key={m.id}
                className={`bg-[var(--color-surface-white)] border rounded-xl p-4 flex items-center justify-between gap-4 ${
                  m.visible ? 'border-[var(--color-border)]' : 'border-dashed border-[var(--color-border)] opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="font-medium text-[var(--color-text-900)]">{m.name}</div>
                    <div className="text-xs text-[var(--color-text-600)] mt-0.5 space-x-3">
                      <span>Opens: {new Date(m.openDate).toLocaleDateString()}</span>
                      <span>Due: {new Date(m.dueDate).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full capitalize text-[var(--color-text-600)]">
                        {m.type.replace('_', ' ')}
                      </span>
                      {m.allowLateSubmission && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Late OK</span>
                      )}
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleVisibility(m.id, m.visible)}
                  disabled={isLocked || toggling === m.id}
                  title={m.visible ? 'Hide from students' : 'Show to students'}
                >
                  {m.visible ? (
                    <><Eye className="w-4 h-4 mr-1.5 text-green-600" /> Visible</>
                  ) : (
                    <><EyeOff className="w-4 h-4 mr-1.5 text-gray-400" /> Hidden</>
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
