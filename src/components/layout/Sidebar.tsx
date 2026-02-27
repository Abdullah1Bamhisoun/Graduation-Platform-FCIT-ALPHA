import { useLocation, Link } from 'react-router-dom';
import {
  Home, FileText, Calendar, Bell, Settings,
  Users, BarChart3, CheckSquare, FolderOpen, Lock, Sliders,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { useUnreadAnnouncements } from '../../hooks/useUnreadAnnouncements';
import gppLogo from '/gpp-logo.png';

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

const navItems: Record<UserRole, NavItem[]> = {
  student: [
    { icon: Home,          label: 'Dashboard',             href: '/student' },
    { icon: CheckSquare,   label: 'Chapter Submissions',   href: '/student/milestones' },
    { icon: FileText,      label: 'Weekly Reports',        href: '/student/weekly-reports' },
    { icon: BarChart3,     label: 'My Grades',             href: '/student/grades' },
    { icon: Users,         label: 'Peer Feedback',         href: '/student/peer-feedback' },
    { icon: Calendar,      label: 'Presentation Selection',href: '/student/presentation-selection' },
    { icon: Bell,          label: 'Announcements',         href: '/student/announcements' },
    { icon: Calendar,      label: 'Calendar',              href: '/student/calendar' },
    { icon: FolderOpen,    label: 'Important Files',       href: '/student/important-files' },
    { icon: Settings,      label: 'Settings',              href: '/student/settings' },
  ],
  supervisor: [
    { icon: Home,          label: 'Dashboard',             href: '/supervisor' },
    { icon: Users,         label: 'My Groups',             href: '/supervisor/groups' },
    { icon: FileText,      label: 'Weekly Reports',        href: '/supervisor/weekly-reports' },
    { icon: BarChart3,     label: 'Committee Evaluation',  href: '/supervisor/committee' },
    { icon: Calendar,      label: 'Calendar',              href: '/supervisor/schedule' },
    { icon: Bell,          label: 'Announcements',         href: '/supervisor/announcements' },
    { icon: FolderOpen,    label: 'Important Files',       href: '/supervisor/important-files' },
    { icon: Settings,      label: 'Settings',              href: '/supervisor/settings' },
  ],
  coordinator: [
    { icon: Home,          label: 'Dashboard',               href: '/coordinator' },
    { icon: CheckSquare,   label: 'Chapter Configuration',   href: '/admin/milestones' },
    { icon: FileText,      label: 'Weekly Reports',          href: '/coordinator/weekly-reports' },
    { icon: BarChart3,     label: 'Deliverables Grading',    href: '/coordinator/grades' },
    { icon: Sliders,       label: 'Grade Scheme Editor',     href: '/coordinator/grade-scheme' },
    { icon: Calendar,      label: 'Presentation & Committee',href: '/admin/presentation-committee' },
    { icon: Calendar,      label: 'Calendar',                href: '/coordinator/calendar' },
    { icon: Bell,          label: 'Announcements Manager',   href: '/coordinator/announcements' },
    { icon: BarChart3,     label: 'Exports & Audit',         href: '/admin/exports' },
    { icon: Users,         label: 'User Management',         href: '/admin/users' },
    { icon: FolderOpen,    label: 'Important Files Manager', href: '/admin/important-files' },
    { icon: Lock,          label: 'Lock Manager',            href: '/admin/locks' },
    { icon: Settings,      label: 'Settings',                href: '/coordinator/settings' },
  ],
  admin: [
    { icon: Home,          label: 'Dashboard',             href: '/admin' },
    { icon: CheckSquare,   label: 'Chapter Configuration', href: '/admin/milestones' },
    { icon: FileText,      label: 'Weekly Reports',        href: '/admin/weekly-reports' },
    { icon: BarChart3,     label: 'Deliverables Grading',  href: '/admin/grades-deliverables' },
    { icon: Sliders,       label: 'Grade Scheme Editor',   href: '/coordinator/grade-scheme' },
    { icon: Calendar,      label: 'Presentation & Committee', href: '/admin/presentation-committee' },
    { icon: Calendar,      label: 'Calendar',              href: '/admin/calendar' },
    { icon: Bell,          label: 'Announcements Manager', href: '/admin/announcements' },
    { icon: BarChart3,     label: 'Exports & Audit',       href: '/admin/exports' },
    { icon: Users,         label: 'User Management',       href: '/admin/users' },
    { icon: FolderOpen,    label: 'Important Files Manager', href: '/admin/important-files' },
    { icon: Lock,          label: 'Lock Manager',          href: '/admin/locks' },
    { icon: Settings,      label: 'Settings',              href: '/admin/settings' },
  ],
};

interface SidebarProps {
  user: User;
}

export function Sidebar({ user }: SidebarProps) {
  const location = useLocation();
  const role = user.activeRole;
  const items = navItems[role] ?? navItems['student'];
  const { unreadCount } = useUnreadAnnouncements(user);

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
            const isActive =
              item.href === `/${role}`
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href);

            // Show unread badge only on the plain "Announcements" item (consumers, not managers)
            const showBadge = item.label === 'Announcements' && unreadCount > 0;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-semibold'
                      : 'text-[var(--color-text-700)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-900)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--color-primary-600)]' : 'text-[var(--color-text-600)]'}`} />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--color-border)]">
        <p className="text-[var(--color-text-600)] text-center text-xs">
          Faculty of Computing and Information Technology, King Abdulaziz University
        </p>
      </div>
    </div>
  );
}
