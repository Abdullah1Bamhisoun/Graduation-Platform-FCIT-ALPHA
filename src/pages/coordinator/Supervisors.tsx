import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { Users, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';

interface SupervisorInfo {
  id: string;
  name: string;
  email: string;
  employeeNumber: string | null;
  groupCount: number;
  groups: { id: string; groupCode: string; projectName: string }[];
}

export function CoordinatorSupervisors() {
  const { user } = useAuth();
  const [supervisors, setSupervisors] = useState<SupervisorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.coordinatorCourseId) return;
    setLoading(true);
    try {
      // Fetch groups for this course, including their supervisor
      const { data, error } = await supabase
        .from('groups')
        .select(`
          id, group_code, project_name,
          supervisor:profiles!supervisor_id(id, name, email, employee_number)
        `)
        .eq('course_id', user.coordinatorCourseId)
        .not('supervisor_id', 'is', null);

      if (error) throw error;

      // Group by supervisor
      const supervisorMap = new Map<string, SupervisorInfo>();
      for (const g of data || []) {
        const sv = g.supervisor as any;
        if (!sv?.id) continue;
        if (!supervisorMap.has(sv.id)) {
          supervisorMap.set(sv.id, {
            id: sv.id,
            name: sv.name,
            email: sv.email,
            employeeNumber: sv.employee_number ?? null,
            groupCount: 0,
            groups: [],
          });
        }
        const entry = supervisorMap.get(sv.id)!;
        entry.groupCount += 1;
        entry.groups.push({ id: g.id, groupCode: g.group_code, projectName: g.project_name });
      }

      setSupervisors(Array.from(supervisorMap.values()));
    } catch (err) {
      console.error('Error loading supervisors:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.coordinatorCourseId]);

  useEffect(() => { load(); }, [load]);

  return (
    <Layout user={user!} pageTitle="Supervisors">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[var(--color-text-600)] text-sm">
            Supervisors with groups assigned in your course
          </p>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">Loading supervisors…</div>
        ) : supervisors.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-600)]">No supervisors assigned to groups in this course yet.</div>
        ) : (
          <div className="space-y-3">
            {supervisors.map((sv) => (
              <div
                key={sv.id}
                className="bg-[var(--color-surface-white)] border border-[var(--color-border)] rounded-xl p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-semibold text-blue-700 flex-shrink-0">
                    {sv.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[var(--color-text-900)]">{sv.name}</div>
                    <div className="text-sm text-[var(--color-text-600)]">{sv.email}</div>
                    {sv.employeeNumber && (
                      <div className="text-xs text-[var(--color-text-600)] mt-0.5">ID: {sv.employeeNumber}</div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Users className="w-4 h-4 text-[var(--color-text-600)]" />
                      <span className="text-sm text-[var(--color-text-600)]">
                        {sv.groupCount} {sv.groupCount === 1 ? 'group' : 'groups'}
                      </span>
                    </div>
                    {sv.groups.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {sv.groups.map((g) => (
                          <span
                            key={g.id}
                            className="text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded-full text-[var(--color-text-600)]"
                            title={g.projectName}
                          >
                            {g.groupCode}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
