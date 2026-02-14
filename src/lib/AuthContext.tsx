import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Load session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user).then((profile) => {
          if (profile) {
            setUser(profile);
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen for sign out only (sign in is handled by login function)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load user profile from profiles table
  const loadUserProfile = async (authUser: SupabaseUser): Promise<User | null> => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (error) {
      console.error('Failed to load profile:', error.message);
      throw new Error('Failed to load user profile. Please contact an administrator.');
    }

    if (!profile) {
      throw new Error('User profile not found. Please contact an administrator.');
    }

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role as UserRole,
      studentId: profile.student_id,
      employeeNumber: profile.employee_number,
      avatarUrl: profile.avatar_url,
    };
  };

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    // Validate email format
    const kauEmailRegex = /^[\w.-]+@(stu\.)?kau\.edu\.sa$/;
    if (!kauEmailRegex.test(email)) {
      throw new Error('Please enter a valid KAU email address');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password');
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Login failed. Please try again.');
    }

    // Load the user profile
    const profile = await loadUserProfile(data.user);
    if (!profile) {
      throw new Error('User profile not found. Please contact an administrator.');
    }
    setUser(profile);

    // Redirect to role-specific dashboard
    navigate(`/${profile.role}`);
  };

  // Logout function
  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/login');
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
