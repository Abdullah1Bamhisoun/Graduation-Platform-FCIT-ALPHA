import { ChevronDown, Moon, RefreshCw, Sun } from 'lucide-react';
import { User, UserRole } from '../../types';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface TopbarProps {
  user: User;
  pageTitle: string;
  unreadCount?: number;
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

// Faculty roles that can be switched between
const SWITCHABLE_ROLES: UserRole[] = ['supervisor', 'coordinator'];

export function Topbar({ user, pageTitle }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { logout, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Only show role switcher when user has multiple switchable roles
  const switchableRoles = user.roles.filter((r) => SWITCHABLE_ROLES.includes(r));
  const isMultiRole = switchableRoles.length > 1;

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  const handleSwitchRole = async (role: UserRole) => {
    await switchRole(role);
  };

  // Settings path depends on active role
  const settingsPath =
    user.activeRole === 'coordinator'
      ? '/coordinator/settings'
      : `/${user.activeRole}/settings`;

  return (
    <div className="h-16 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] fixed top-0 right-0 left-[280px] z-10 flex items-center justify-between px-6">
      {/* Page Title */}
      <h1 className="text-lg font-semibold text-[var(--color-text-900)] tracking-tight">{pageTitle}</h1>

      <div className="flex items-center gap-3">
        {/* ── Role Switcher (faculty with multiple roles only) ── */}
        {isMultiRole && (
          <>
            {/* Prominent one-click switch button */}
            {user.activeRole === 'supervisor' && user.roles.includes('coordinator') && (
              <button
                onClick={() => handleSwitchRole('coordinator')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-300 hover:bg-purple-100 transition-colors whitespace-nowrap rounded-lg"
                title="Switch to Coordinator Mode"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Switch to Coordinator Mode
              </button>
            )}
            {user.activeRole === 'coordinator' && user.roles.includes('supervisor') && (
              <button
                onClick={() => handleSwitchRole('supervisor')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 hover:bg-blue-100 transition-colors whitespace-nowrap rounded-lg"
                title="Switch to Supervisor Mode"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Switch to Supervisor Mode
              </button>
            )}
            {/* Active role badge */}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${roleBadgeStyle[user.activeRole] ?? ''}`}>
              {roleLabel[user.activeRole] ?? user.activeRole}
            </span>
          </>
        )}

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
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left">
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
                {/* Show single-role badge when NOT multi-role */}
                {!isMultiRole && (
                  <div className="px-4 py-2">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadgeStyle[user.activeRole] ?? ''}`}
                    >
                      {roleLabel[user.activeRole] ?? user.activeRole}
                    </span>
                  </div>
                )}
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
