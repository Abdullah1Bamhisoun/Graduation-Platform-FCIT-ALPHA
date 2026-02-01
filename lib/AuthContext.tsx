import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user credentials (in production, this would be verified against a backend/database)
const MOCK_CREDENTIALS = {
  'abamhisoun@stu.kau.edu.sa': {
    password: 'password123',
    user: {
      id: '2236500',
      name: 'Abdullah Bamhisoun',
      email: 'abamhisoun@stu.kau.edu.sa',
      role: 'student' as UserRole,
      studentId: '2236500',
    },
  },
  'h.labani@kau.edu.sa': {
    password: 'password123',
    user: {
      id: 'sup-001',
      name: 'Dr. Hasan Labani',
      email: 'h.labani@kau.edu.sa',
      role: 'supervisor' as UserRole,
      employeeNumber: '0000482731',
    },
  },
  'coordinator@kau.edu.sa': {
    password: 'password123',
    user: {
      id: 'admin-001',
      name: 'Dr. Ahmad Al-Coordinator',
      email: 'coordinator@kau.edu.sa',
      role: 'admin' as UserRole,
      employeeNumber: '0000195847',
    },
  },
};

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SessionData {
  user: User;
  timestamp: number;
  expiresAt: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = () => {
      try {
        const sessionData = localStorage.getItem('gpp_session');
        if (sessionData) {
          const session: SessionData = JSON.parse(sessionData);

          // Check if session has expired
          if (Date.now() < session.expiresAt) {
            setUser(session.user);
          } else {
            // Session expired, clear it
            localStorage.removeItem('gpp_session');
          }
        }
      } catch (error) {
        console.error('Failed to load session:', error);
        localStorage.removeItem('gpp_session');
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const kauEmailRegex = /^[\w.-]+@(stu\.)?kau\.edu\.sa$/;
    return kauEmailRegex.test(email);
  };

  // Validate password
  const validatePassword = (password: string): boolean => {
    return password.length >= 8;
  };

  // Login function
  const login = async (email: string, password: string): Promise<void> => {
    // Validate email format
    if (!validateEmail(email)) {
      throw new Error('Please enter a valid KAU email address');
    }

    // Validate password
    if (!validatePassword(password)) {
      throw new Error('Password must be at least 8 characters');
    }

    // Simulate async authentication (in production, this would be an API call)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check credentials
    const credentials = MOCK_CREDENTIALS[email as keyof typeof MOCK_CREDENTIALS];

    if (!credentials || credentials.password !== password) {
      throw new Error('Invalid email or password');
    }

    // Authentication successful
    const authenticatedUser = credentials.user;
    setUser(authenticatedUser);

    // Save session to localStorage
    const sessionData: SessionData = {
      user: authenticatedUser,
      timestamp: Date.now(),
      expiresAt: Date.now() + SESSION_EXPIRY_MS,
    };
    localStorage.setItem('gpp_session', JSON.stringify(sessionData));

    // Redirect to role-specific dashboard
    navigate(`/${authenticatedUser.role}`);
  };

  // Logout function
  const logout = () => {
    setUser(null);
    localStorage.removeItem('gpp_session');
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
