import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  // Show nothing while loading session
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-alt)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[var(--color-primary-600)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--color-text-600)]">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has allowed role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // User is authenticated but doesn't have permission for this route
    // Redirect to their appropriate dashboard
    return <Navigate to={`/${user.role}`} replace />;
  }

  // User is authenticated and has correct role
  return <>{children}</>;
}
