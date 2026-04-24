import { ChevronDown, Menu, Moon, Sun } from 'lucide-react';
import { User } from '../../types';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface TopbarProps {
  user: User;
  pageTitle: string;
  unreadCount?: number;
  onMenuClick?: () => void;
}

// ── Role badge colours ────────────────────────────────────────────────────────
const roleBadgeStyle: Record<string, string> = {
  supervisor:  'bg-blue-100 text-blue-700 border border-blue-200',
  coordinator: 'bg-purple-100 text-purple-700 border border-purple-200',
  admin:       'bg-red-100 text-red-700 border border-red-200',
  student:     'bg-green-100 text-green-700 border border-green-200',
};

const roleLabel: Record<string, string> = {
  supervisor:  'Supervisor Mode',
  coordinator: 'Coordinator Mode',
  admin:       'Admin',
  student:     'Student',
};

export function Topbar({ user, pageTitle, onMenuClick }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  // Settings path depends on active role
  const settingsPath =
    user.activeRole === 'coordinator'
      ? '/coordinator/settings'
      : `/${user.activeRole}/settings`;

  return (
    <div className="h-16 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] fixed top-0 right-0 left-0 lg:left-[280px] z-10 flex items-center justify-between px-4 sm:px-6">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-text-600)] flex-shrink-0"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-sm sm:text-base lg:text-lg font-semibold text-[var(--color-text-900)] tracking-tight leading-tight break-words">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* ── Dark Mode Toggle ── */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors text-[var(--color-text-600)]"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* ── User Menu ── */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center font-semibold flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {/* User name/id hidden on small screens */}
            <div className="text-left hidden sm:block">
              <div className="text-sm font-medium text-[var(--color-text-900)]">{user.name}</div>
              {user.studentId && (
                <div className="text-xs text-[var(--color-text-600)]">{user.studentId}</div>
              )}
              {user.employeeNumber && (
                <div className="text-xs text-[var(--color-text-600)]">{user.employeeNumber}</div>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-surface-white)] rounded-lg shadow-lg border border-[var(--color-border)] py-2 z-20">
                <div className="px-4 py-2">
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeStyle[user.activeRole] ?? ''}`}
                  >
                    {roleLabel[user.activeRole] ?? user.activeRole}
                  </span>
                </div>
                {/* Show user name in dropdown on mobile (since it's hidden in header) */}
                <div className="px-4 py-2 sm:hidden border-b border-[var(--color-border)] mb-1">
                  <p className="text-sm font-medium text-[var(--color-text-900)]">{user.name}</p>
                  {user.studentId && <p className="text-xs text-[var(--color-text-600)]">{user.studentId}</p>}
                  {user.employeeNumber && <p className="text-xs text-[var(--color-text-600)]">{user.employeeNumber}</p>}
                </div>
                <Link
                  to={settingsPath}
                  className="block px-4 py-2 text-[var(--color-text-900)] hover:bg-[var(--color-surface-alt)]"
                  onClick={() => setShowUserMenu(false)}
                >
                  Profile Settings
                </Link>
                <div className="border-t border-[var(--color-border)] my-2" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left block px-4 py-2 text-[var(--color-danger)] hover:bg-[var(--color-surface-alt)]"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
