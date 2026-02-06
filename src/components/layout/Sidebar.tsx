import { useLocation, Link } from 'react-router-dom';
import { Home, FileText, Calendar, Bell, Settings, Users, BarChart3, CheckSquare, ClipboardList, FolderOpen } from 'lucide-react';
import { UserRole } from '../../types';
import gppLogo from '/gpp-logo.png';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const navItems: Record<UserRole, NavItem[]> = {
  student: [
    { icon: Home, label: 'Dashboard', href: '/student' },
    { icon: CheckSquare, label: 'Chapter Submissions', href: '/student/milestones' },
    { icon: FileText, label: 'Weekly Reports', href: '/student/weekly-reports' },
    { icon: BarChart3, label: 'My Grades', href: '/student/grades' },
    { icon: Users, label: 'Peer Feedback', href: '/student/peer-feedback' },
    { icon: Calendar, label: 'Presentation Selection', href: '/student/presentation-selection' },
    { icon: Bell, label: 'Announcements', href: '/student/announcements' },
    { icon: Calendar, label: 'Calendar', href: '/student/calendar' },
    { icon: FolderOpen, label: 'Important Files', href: '/student/important-files' },
    { icon: Settings, label: 'Settings', href: '/student/settings' },
  ],
  supervisor: [
    { icon: Home, label: 'Dashboard', href: '/supervisor' },
    { icon: Users, label: 'Chapter Grading', href: '/supervisor/groups' },
    { icon: FileText, label: 'Weekly Reports', href: '/supervisor/weekly-reports' },
    { icon: BarChart3, label: 'Committee Evaluation', href: '/supervisor/committee' },
    { icon: Calendar, label: 'Calendar', href: '/supervisor/schedule' },
    { icon: Bell, label: 'Announcements', href: '/supervisor/announcements' },
    { icon: FolderOpen, label: 'Important Files', href: '/supervisor/important-files' },
    { icon: Settings, label: 'Settings', href: '/supervisor/settings' },
  ],
  admin: [
    { icon: Home, label: 'Dashboard', href: '/admin' },
    { icon: CheckSquare, label: 'Chapter Configuration', href: '/admin/milestones' },
    { icon: FileText, label: 'Weekly Reports', href: '/admin/weekly-reports' },
    { icon: BarChart3, label: 'Deliverables Grading', href: '/admin/grades-deliverables' },
    { icon: Calendar, label: 'Presentation & Committee', href: '/admin/presentation-committee' },
    { icon: Calendar, label: 'Calendar', href: '/admin/calendar' },
    { icon: Bell, label: 'Announcements Manager', href: '/admin/announcements' },
    { icon: BarChart3, label: 'Exports & Audit', href: '/admin/exports' },
    { icon: Users, label: 'User Management', href: '/admin/users' },
    { icon: FolderOpen, label: 'Important Files Manager', href: '/admin/important-files' },
    { icon: Settings, label: 'Settings', href: '/admin/settings' },
  ],
};

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const location = useLocation();
  const items = navItems[role];

  return (
    <div className="w-[280px] h-screen bg-[var(--color-surface-white)] border-r border-[var(--color-border)] flex flex-col fixed left-0 top-0">
      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-border)]">
        <img src={gppLogo} alt="GPP FCIT KAU" className="w-full h-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-[var(--color-primary-100)] text-black'
                      : 'text-black hover:bg-[var(--color-surface-alt)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-[var(--color-text-600)] text-center">Faculty of Computing and Information Technology, King Abdulaziz University</p>
      </div>
    </div>
  );
}
