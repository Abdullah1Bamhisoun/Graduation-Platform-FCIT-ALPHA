import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';
import gppLogo from '/gpp-logo.png';
import { supabase } from '../../../lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-[var(--color-surface-white)]">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img src={gppLogo} alt="GPP FCIT KAU" className="w-64 mx-auto mb-8" />
            <h1 className="text-[var(--color-text-900)] mb-2">Reset Password</h1>
            <p className="text-[var(--color-text-600)]">
              Enter your university email and we'll send you a password reset link.
            </p>
          </div>

          {isSubmitted ? (
            <div className="space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-green-800">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Check your inbox</p>
                  <p className="text-sm mt-1">
                    If <strong>{email}</strong> is registered, you'll receive a password reset link
                    within a few minutes.
                  </p>
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-600)]">
                Didn't receive an email? Check your spam folder or{' '}
                <button
                  className="text-[var(--color-primary-600)] hover:underline font-medium"
                  onClick={() => { setIsSubmitted(false); setEmail(''); }}
                >
                  try again
                </button>
                .
              </p>
              <Link
                to="/login"
                className="flex items-center gap-2 text-[var(--color-primary-600)] hover:underline text-sm font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit}>
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

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Reset Link'}
              </Button>

              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-[var(--color-text-600)] hover:text-[var(--color-text-900)] text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </Link>
            </form>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-[var(--color-primary-600)] to-[var(--color-primary-700)] p-12 items-center justify-center text-white">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-white mb-4">Password Recovery</h2>
          <p className="text-white/80">
            A secure reset link will be sent to your registered university email address.
            The link expires after 1 hour for your security.
          </p>
        </div>
      </div>
    </div>
  );
}
