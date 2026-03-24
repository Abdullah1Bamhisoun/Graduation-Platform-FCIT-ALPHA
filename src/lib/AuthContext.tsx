import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase, adaptiveStorage } from './supabase';
import { User, UserRole } from '../types';
import {
  getUserRoles,
  logRoleSwitch,
  getStoredActiveRole,
  storeActiveRole,
  clearStoredActiveRole,
  getDashboardPath,
} from '../services/roles';

// ─── Context Shape ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  /** Switch active role for multi-role faculty (supervisor ↔ coordinator) */
  switchRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // ── Load user profile + all roles from user_roles table ───────────────────
  const loadUserProfile = useCallback(
    async (authUser: SupabaseUser): Promise<User | null> => {
      // 1. Fetch base profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !profile) {
        console.error('Failed to load profile:', error?.message);
        throw new Error('Your account is pending admin approval. Please wait — you will be able to log in once approved.');
      }

      // 2. Fetch all roles from user_roles table (authoritative source)
      const roleEntries = await getUserRoles(authUser.id);

      // 3. Coordinator course UUID — check user_roles first, then profiles, then platform_locks
      const coordinatorEntry = roleEntries.find((r) => r.roleName === 'coordinator');
      let coordinatorCourseId: string | undefined =
        coordinatorEntry?.coordinatorCourseId ??
        (profile as Record<string, unknown>).coordinator_course_id as string | undefined;

      // Fallback: check platform_locks (works regardless of DB schema migrations)
      if (!coordinatorCourseId) {
        const { data: lockRow } = await supabase
          .from('platform_locks')
          .select('entity_id')
          .eq('entity_type', 'coordinator_assignment')
          .eq('locked_by', authUser.id)
          .eq('is_locked', true)
          .limit(1)
          .maybeSingle();
        coordinatorCourseId = (lockRow?.entity_id as string | undefined) ?? undefined;
      }

      // Build role list: from user_roles if available, otherwise derive from profiles
      let roleNames: UserRole[];
      if (roleEntries.length > 0) {
        roleNames = roleEntries.map((r) => r.roleName);
      } else {
        roleNames = [profile.role as UserRole];
      }
      // Ensure coordinator role is present whenever a coordinator course is assigned
      if (coordinatorCourseId && !roleNames.includes('coordinator' as UserRole)) {
        roleNames.push('coordinator' as UserRole);
      }

      // 4. Resolve active role:
      //    stored localStorage preference → profiles.role → first available
      const stored = getStoredActiveRole(authUser.id);
      const activeRole: UserRole =
        stored && roleNames.includes(stored)
          ? stored
          : roleNames.includes(profile.role as UserRole)
          ? (profile.role as UserRole)
          : roleNames[0];

      return {
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as UserRole,
        roles: roleNames,
        activeRole,
        coordinatorCourseId,
        studentId: profile.student_id ?? undefined,
        employeeNumber: profile.employee_number ?? undefined,
        avatarUrl: profile.avatar_url ?? undefined,
        department: profile.department ?? undefined,
        gender: profile.gender ?? undefined,
      };
    },
    []
  );

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user)
          .then((profile) => { if (profile) setUser(profile); })
          .catch(console.error)
          .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setUser(null);
    });

    return () => subscription.unsubscribe();
  }, [loadUserProfile]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const login = async (identifier: string, password: string, rememberMe = true): Promise<void> => {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // If the input doesn't contain '@', treat it as a university / employee ID
    // and resolve it to an email via the backend before proceeding.
    let email = identifier.trim();
    if (!email.includes('@')) {
      const res = await fetch('/api/auth/resolve-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'University ID not found. Please use your email instead.');
      }
      const data = await res.json();
      email = data.email;
    }

    const kauEmailRegex = /^[\w.-]+@(stu\.)?kau\.edu\.sa$/;
    if (!kauEmailRegex.test(email)) {
      throw new Error('Please enter a valid KAU email address');
    }

    // Configure storage before signing in so the session lands in the right place.
    adaptiveStorage.setMode(rememberMe);
    localStorage.setItem('rememberMePref', String(rememberMe));

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      throw new Error(
        error.message.includes('Invalid login credentials')
          ? 'Invalid email or password'
          : error.message
      );
    }

    if (!data.user) throw new Error('Login failed. Please try again.');

    const profile = await loadUserProfile(data.user);
    if (!profile) throw new Error('User profile not found. Please contact an administrator.');

    setUser(profile);
    // Redirect based on active role (handles multi-role faculty correctly)
    navigate(getDashboardPath(profile.activeRole));
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = async () => {
    if (user) clearStoredActiveRole(user.id);
    localStorage.removeItem('rememberMePref');
    adaptiveStorage.setMode(true); // reset to default for next login
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login');
  };

  // ── Switch active role (faculty with supervisor + coordinator) ────────────
  const switchRole = async (newRole: UserRole): Promise<void> => {
    if (!user) return;
    if (!user.roles.includes(newRole)) {
      console.warn('User does not have role:', newRole);
      return;
    }

    const fromRole = user.activeRole;
    storeActiveRole(user.id, newRole);
    logRoleSwitch(fromRole, newRole);

    // When switching to coordinator, re-fetch the profile so coordinatorCourseId
    // is always up-to-date (it may have been assigned after the last login).
    if (newRole === 'coordinator') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const refreshed = await loadUserProfile(session.user);
          if (refreshed) {
            storeActiveRole(refreshed.id, newRole);
            setUser({ ...refreshed, activeRole: newRole });
            navigate(getDashboardPath(newRole));
            return;
          }
        }
      } catch {
        // fall through to the basic state update below
      }
    }

    setUser((prev) => (prev ? { ...prev, activeRole: newRole } : null));
    navigate(getDashboardPath(newRole));
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    switchRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
