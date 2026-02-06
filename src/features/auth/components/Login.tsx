import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AlertCircle } from 'lucide-react';
import gppLogo from '/gpp-logo.png';
import { useAuth } from '../../../lib/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
      await login(email, password);
      // Navigation is handled by the login function
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="w-1/2 flex items-center justify-center p-12 bg-[var(--color-surface-white)]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img src={gppLogo} alt="GPP FCIT KAU" className="w-64 mx-auto mb-8" />
            <h1 className="text-[var(--color-text-900)] mb-2">Welcome Back</h1>
            <p className="text-[var(--color-text-600)]">Sign in to your account to continue</p>
          </div>

          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-800 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <Label htmlFor="email">University Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.name@stu.kau.edu.sa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
                required
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2"
                required
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-[var(--color-border)]" />
                <span className="text-[var(--color-text-600)]">Remember me</span>
              </label>
              <a href="#" className="text-[var(--color-primary-600)] hover:underline">
                Forgot password?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled
            >
              Single Sign-On (SSO) - Coming Soon
            </Button>

            <p className="text-center text-[var(--color-text-600)]">
              Don't have an account?{' '}
              <Link to="/register" className="text-[var(--color-primary-600)] hover:underline font-medium">
                Create Account
              </Link>
            </p>
          </form>

        </div>
      </div>

      {/* Right Panel - Platform Info */}
      <div className="w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 flex items-center justify-center text-white">
        <div className="max-w-md">
          <h2 className="text-white mb-6">Graduation Project Platform</h2>
          <p className="mb-8 text-white/90">
            A comprehensive platform for managing graduation projects at FCIT, King Abdulaziz University.
          </p>
          
          <ul className="space-y-4">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 mt-0.5">
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
