import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { getGroupForStudent } from '../../services/groups';
import type { User } from '../../types';

interface Props {
  user: User;
}

export function StudentGroupBanner({ user }: Props) {
  const [group, setGroup] = useState<{
    groupCode: string;
    projectName: string;
    supervisorName: string;
    members: { id: string; name: string }[];
  } | null>(null);

  useEffect(() => {
    getGroupForStudent(user.id).then((g) => {
      if (g) {
        setGroup({
          groupCode: g.groupCode,
          projectName: g.projectName,
          supervisorName: g.supervisorName,
          members: g.members,
        });
      }
    });
  }, [user.id]);

  if (!group) return null;

  const teammates = group.members.filter((m) => m.id !== user.id);

  return (
    <div className="lg:ml-[280px] bg-[var(--color-surface-white)] border-b border-[var(--color-border)] px-4 sm:px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-600)]">Group:</span>
        <span className="font-semibold text-[var(--color-text-900)]">{group.groupCode}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[var(--color-text-600)]">Project:</span>
        <span className="font-medium text-[var(--color-text-900)] truncate max-w-[220px]">{group.projectName}</span>
      </div>
      {teammates.length > 0 && (
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[var(--color-text-600)]" />
          <span className="text-[var(--color-text-600)]">Teammates:</span>
          <span className="text-[var(--color-text-900)]">{teammates.map((t) => t.name).join(', ')}</span>
        </div>
      )}
      {group.supervisorName && (
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-text-600)]">Supervisor:</span>
          <span className="text-[var(--color-text-900)]">{group.supervisorName}</span>
        </div>
      )}
    </div>
  );
}
