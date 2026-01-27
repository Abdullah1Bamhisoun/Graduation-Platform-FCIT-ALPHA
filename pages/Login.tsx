import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { GraduationCap, Users, Shield } from 'lucide-react';
import gppLogo from '/gpp-logo.png';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (role: 'student' | 'supervisor' | 'admin') => {
    navigate(`/${role}`);
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

          <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
            <div>
              <Label htmlFor="email">University Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.name@stu.kau.edu.sa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
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
              type="button"
              className="w-full"
              onClick={() => handleLogin('student')}
            >
              Sign In
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled
            >
              Single Sign-On (SSO) - Coming Soon
            </Button>
          </form>

          {/* Demo Role Switcher */}
          <div className="mt-8 pt-8 border-t border-[var(--color-border)]">
            <p className="text-[var(--color-text-600)] mb-4 text-center">Demo: Sign in as</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-lg !bg-white text-blue-700 border-[1.5px] border-blue-500 flex items-center justify-center">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleLogin('student')}
                >
                  Student
                </Button>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-lg !bg-white text-purple-700 border-[1.5px] border-purple-500 flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleLogin('supervisor')}
                >
                  Supervisor
                </Button>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-lg !bg-white text-amber-700 border-[1.5px] border-amber-500 flex items-center justify-center">
                  <Shield className="w-6 h-6" />
                </div>
                <Button
                  className="w-full"
                  onClick={() => handleLogin('admin')}
                >
                  Admin
                </Button>
              </div>
            </div>
          </div>
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
