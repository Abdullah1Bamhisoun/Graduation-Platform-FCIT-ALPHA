import { Search, ChevronDown } from 'lucide-react';
import { User } from '../../types';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

interface TopbarProps {
  user: User;
  pageTitle: string;
  unreadCount?: number;
}

export function Topbar({ user, pageTitle }: TopbarProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { logout } = useAuth();

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  return (
    <div className="h-16 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] fixed top-0 right-0 left-[280px] z-10 flex items-center justify-between px-6">
      {/* Page Title */}
      <h1 className="text-[var(--color-text-900)]">{pageTitle}</h1>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-600)]" />
          <input
            type="text"
            placeholder="Search... (Cmd+/)"
            className="pl-10 pr-4 py-2 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] text-[var(--color-text-900)] placeholder:text-[var(--color-text-600)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent"
          />
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center">
              {user.name.charAt(0)}
            </div>
            <div className="text-left">
              <div className="text-[var(--color-text-900)]">{user.name}</div>
              {user.studentId && (
                <div className="text-[var(--color-text-600)]">{user.studentId}</div>
              )}
              {user.employeeNumber && (
                <div className="text-[var(--color-text-600)]">{user.employeeNumber}</div>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />
          </button>

          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-56 bg-[var(--color-surface-white)] rounded-lg shadow-lg border border-[var(--color-border)] py-2 z-20">
                <Link
                  to={`/${user.role}/settings`}
                  className="block px-4 py-2 text-[var(--color-text-900)] hover:bg-[var(--color-surface-alt)]"
                  onClick={() => setShowUserMenu(false)}
                >
                  Profile Settings
                </Link>
                <div className="border-t border-[var(--color-border)] my-2"></div>
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
