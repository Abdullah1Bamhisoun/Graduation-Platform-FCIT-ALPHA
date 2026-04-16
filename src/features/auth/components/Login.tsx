import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AlertCircle, Eye, EyeOff, Clock, CheckCircle } from 'lucide-react';
import gppLogo from '/gpp-logo.png';
import { useAuth } from '../../../lib/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Show the pending-approval notice when arriving from /account-confirmed
  // OR when the login attempt itself reveals the account is not yet approved.
  const [pendingApproval, setPendingApproval] = useState(
    searchParams.get('confirmed') === 'true'
  );

  // Redirect if already authenticated
  if (isAuthenticated && user) {
    navigate(`/${user.role}`, { replace: true });
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password, rememberMe);
      // Navigation is handled by the login function
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      if (message.toLowerCase().includes('pending admin approval')) {
        setPendingApproval(true);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-(--color-surface-white)">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img src={gppLogo} alt="GPP FCIT KAU" className="w-64 mx-auto mb-8" />
            <h1 className="text-(--color-text-900) mb-2">Welcome Back</h1>
            <p className="text-(--color-text-600)">Sign in to your account to continue</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {pendingApproval && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm font-semibold text-amber-900">Email confirmed successfully!</p>
                  </div>
                  <p className="text-sm text-amber-800">
                    Your account is now <span className="font-medium">awaiting admin approval</span>.
                    You will be able to log in once your registration has been reviewed.
                    Please check your university email for an approval notification.
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <Label htmlFor="email">Email or University ID</Label>
              <Input
                id="email"
                type="text"
                placeholder="your.name@stu.kau.edu.sa or University ID"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                required
                disabled={isLoading}
                autoComplete="username"
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative mt-2">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-600) hover:text-(--color-text-900)"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-(--color-border)"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-(--color-text-600)">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-(--color-primary-600) hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <p className="text-center text-(--color-text-600)">
              Don't have an account?{' '}
              <Link to="/register" className="text-(--color-primary-600) hover:underline font-medium">
                Create Account
              </Link>
            </p>
          </form>

        </div>
      </div>

      {/* Right Panel - Platform Info (hidden on mobile) */}
      <div className="hidden lg:flex w-1/2 bg-linear-to-br from-(--color-primary-600) to-(--color-primary-700) p-12 items-center justify-center text-white">
        <div className="max-w-md">
          <h2 className="text-white mb-6">Graduation Project Platform</h2>
          <p className="mb-8 text-white/90">
            A comprehensive platform for managing graduation projects at FCIT, King Abdulaziz University.
          </p>
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Track Milestones</h3>
                <p className="text-white/80">Monitor deadlines for chapters, reports, and presentations</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Submit & Review</h3>
                <p className="text-white/80">Upload submissions and receive detailed feedback from supervisors</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="text-white mb-1">Transparent Grading</h3>
                <p className="text-white/80">View rubric-based evaluations and track your progress</p>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
