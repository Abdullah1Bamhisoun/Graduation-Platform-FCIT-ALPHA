import { useLocation, Link } from 'react-router-dom';
import {
  Home, FileText, Calendar, Bell, Settings,
  Users, BarChart3, CheckSquare, FolderOpen, Lock, Sliders, X, HeadphonesIcon, Video, RefreshCw,
} from 'lucide-react';
import { User, UserRole } from '../../types';
import { useUnreadAnnouncements } from '../../hooks/useUnreadAnnouncements';
import { usePendingRegistrationsCount } from '../../hooks/usePendingRegistrationsCount';
import { useAuth } from '../../lib/AuthContext';
import { toast } from 'sonner';
import gppLogo from '/gpp-logo.png';

const SWITCHABLE_ROLES: UserRole[] = ['supervisor', 'coordinator'];


const roleLabel: Record<string, string> = {
  supervisor:  'Supervisor Mode',
  coordinator: 'Coordinator Mode',
  admin:       'Admin',
  student:     'Student',
};

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
    { icon: Video,         label: 'Meetings & Discussions', href: '/student/meetings' },
    { icon: BarChart3,     label: 'My Grades',             href: '/student/grades' },
    { icon: Calendar,      label: 'Presentation Time',href: '/student/presentation-selection' },
    { icon: Bell,          label: 'Announcements',         href: '/student/announcements' },
    { icon: Calendar,      label: 'Calendar',              href: '/student/calendar' },
    { icon: FolderOpen,       label: 'Important Files',       href: '/student/important-files' },
    { icon: HeadphonesIcon,   label: 'Contact Us',            href: '/student/contact' },
    { icon: Settings,         label: 'Settings',              href: '/student/settings' },
  ],
  supervisor: [
    { icon: Home,          label: 'Dashboard',             href: '/supervisor' },
    { icon: Users,         label: 'My Groups',             href: '/supervisor/groups' },
    { icon: FileText,      label: 'Weekly Reports',        href: '/supervisor/weekly-reports' },
    { icon: Video,         label: 'Meetings & Discussions', href: '/supervisor/meetings' },
    { icon: BarChart3,     label: 'Committee Evaluation',  href: '/supervisor/committee' },
    { icon: Calendar,      label: 'Calendar',              href: '/supervisor/schedule' },
    { icon: Bell,          label: 'Announcements',         href: '/supervisor/announcements' },
    { icon: FolderOpen,       label: 'Important Files',       href: '/supervisor/important-files' },
    { icon: HeadphonesIcon,   label: 'Contact Us',            href: '/supervisor/contact' },
    { icon: Settings,         label: 'Settings',              href: '/supervisor/settings' },
  ],
  coordinator: [
    { icon: Home,          label: 'Dashboard',               href: '/coordinator' },
    { icon: CheckSquare,   label: 'Assessment Configuration',   href: '/admin/milestones' },
    { icon: FileText,      label: 'Weekly Reports',          href: '/coordinator/weekly-reports' },
    { icon: Video,         label: 'Meetings & Discussions',  href: '/coordinator/meetings' },
    { icon: BarChart3,     label: 'Course Grades',           href: '/coordinator/grades' },
    { icon: Sliders,       label: 'Grade Scheme Editor',     href: '/coordinator/grade-scheme' },
    { icon: Calendar,      label: 'Presentation & Committee',href: '/admin/presentation-committee' },
    { icon: Calendar,      label: 'Calendar',                href: '/coordinator/calendar' },
    { icon: Bell,          label: 'Announcements Manager',   href: '/coordinator/announcements' },
    { icon: BarChart3,     label: 'Exports & Audit',         href: '/admin/exports' },
    { icon: Users,         label: 'User Management',         href: '/admin/users' },
    { icon: FolderOpen,    label: 'Important Files Manager', href: '/admin/important-files' },
    { icon: Lock,             label: 'Lock Manager',            href: '/admin/locks' },
    { icon: HeadphonesIcon,   label: 'Contact Us',              href: '/coordinator/contact' },
    { icon: Settings,         label: 'Settings',                href: '/coordinator/settings' },
  ],
  admin: [
    { icon: Home,          label: 'Dashboard',             href: '/admin' },
    { icon: CheckSquare,   label: 'Assessment Configuration', href: '/admin/milestones' },
    { icon: FileText,      label: 'Weekly Reports',        href: '/admin/weekly-reports' },
    { icon: BarChart3,     label: 'Course Grades',          href: '/admin/course-grades' },
    { icon: Sliders,       label: 'Grade Scheme Editor',   href: '/coordinator/grade-scheme' },
    { icon: Calendar,      label: 'Presentation & Committee', href: '/admin/presentation-committee' },
    { icon: Calendar,      label: 'Calendar',              href: '/admin/calendar' },
    { icon: Bell,          label: 'Announcements Manager', href: '/admin/announcements' },
    { icon: BarChart3,     label: 'Exports & Audit',       href: '/admin/exports' },
    { icon: Users,         label: 'User Management',       href: '/admin/users' },
    { icon: FolderOpen,    label: 'Important Files Manager', href: '/admin/important-files' },
    { icon: Lock,             label: 'Lock Manager',          href: '/admin/locks' },
    { icon: HeadphonesIcon,   label: 'Contact Us',            href: '/admin/contact' },
    { icon: Settings,         label: 'Settings',              href: '/admin/settings' },
  ],
};

interface SidebarProps {
  user: User;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, isOpen = false, onClose }: SidebarProps) {
  const location = useLocation();
  const role = user.activeRole;
  const items = navItems[role] ?? navItems['student'];
  const { unreadCount } = useUnreadAnnouncements(user);
  const { pendingCount } = usePendingRegistrationsCount(user);
  const { switchRole } = useAuth();

  const switchableRoles = user.roles.filter((r) => SWITCHABLE_ROLES.includes(r));
  const isMultiRole = switchableRoles.length > 1;

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <div
      className={`w-[280px] h-screen bg-[var(--color-surface-white)] border-r border-[var(--color-border)] flex flex-col fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
        <img src={gppLogo} alt="GPP FCIT KAU" className="w-full h-auto" />
        {/* Close button - mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden ml-2 p-1.5 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-600)] flex-shrink-0"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Role badge + switch button (faculty with multiple roles only) */}
      {isMultiRole && (
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex flex-col gap-2">
          <div className={`w-full px-3 py-2 rounded-lg text-xs font-medium ${
            user.activeRole === 'coordinator'
              ? 'bg-purple-50 border border-purple-200 text-purple-700'
              : 'bg-blue-50 border border-blue-200 text-blue-700'
          }`}>
            You are in{' '}
            <span className="font-bold whitespace-nowrap">
              {roleLabel[user.activeRole] ?? user.activeRole}
              {user.activeRole === 'coordinator' && user.coordinatorCourseCode && ` · ${user.coordinatorCourseCode.replace(/_/g, '-')}`}
            </span>
          </div>
          {user.activeRole === 'supervisor' && user.roles.includes('coordinator') && (
            <button
              onClick={() => {
                switchRole('coordinator');
                toast.success('You are now in Coordinator Mode', { duration: 3000 });
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 hover:bg-purple-100 transition-colors rounded-lg"
            >
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
              Switch to Coordinator Mode
            </button>
          )}
          {user.activeRole === 'coordinator' && user.roles.includes('supervisor') && (
            <button
              onClick={() => {
                switchRole('supervisor');
                toast.success('You are now in Supervisor Mode', { duration: 3000 });
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 hover:bg-blue-100 transition-colors rounded-lg"
            >
              <RefreshCw className="w-4 h-4 flex-shrink-0" />
              Switch to Supervisor Mode
            </button>
          )}
        </div>
      )}

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
            const showAnnouncementBadge = item.label === 'Announcements' && unreadCount > 0;
            // Show pending registrations badge on "User Management" for coordinator/admin
            const showPendingBadge = item.label === 'User Management' && pendingCount > 0;

            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={handleNavClick}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                    isActive
                      ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] font-semibold'
                      : 'text-[var(--color-text-700)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-900)]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--color-primary-600)]' : 'text-[var(--color-text-600)]'}`} />
                  <span className="flex-1">{item.label}</span>
                  {showAnnouncementBadge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold leading-none">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  {showPendingBadge && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold leading-none">
                      {pendingCount > 99 ? '99+' : pendingCount}
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
