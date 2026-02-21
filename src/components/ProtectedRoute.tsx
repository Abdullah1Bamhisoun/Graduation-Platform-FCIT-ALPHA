import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';
import { getDashboardPath } from '../services/roles';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show spinner while session is being restored
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-alt)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--color-primary-600)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[var(--color-text-600)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated → login page
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check if ANY of the user's roles satisfies the route requirement
  if (allowedRoles) {
    const hasAccess = allowedRoles.some((r) => user.roles.includes(r));
    if (!hasAccess) {
      // Redirect to their current active dashboard (not a generic role page)
      return <Navigate to={getDashboardPath(user.activeRole)} replace />;
    }
  }

  return <>{children}</>;
}
