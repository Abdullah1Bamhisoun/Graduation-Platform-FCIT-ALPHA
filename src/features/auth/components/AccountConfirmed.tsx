import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, GraduationCap, LogIn } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { supabase } from '../../../lib/supabase';
import gppLogo from '/gpp-logo.png';

type ConfirmationStatus = 'loading' | 'success' | 'error';

export function AccountConfirmed() {
  const [status, setStatus] = useState<ConfirmationStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    // Parse URL hash for Supabase auth params (e.g. #error=... or #access_token=...&type=signup)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

    const error = params.get('error');
    const errorDescription = params.get('error_description');

    // Error embedded in redirect URL (invalid/expired token)
    if (error) {
      const message = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'The confirmation link is invalid or has expired.';
      setErrorMessage(message);
      setStatus('error');
      return;
    }

    // Supabase JS v2 automatically exchanges the #access_token fragment on page load
    // and fires SIGNED_IN via onAuthStateChange when the confirmation succeeds.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStatus('success');
        // Sign out immediately — the user must log in explicitly after confirmation.
        supabase.auth.signOut();
      }
    });

    // Fallback: the session may already be available synchronously before the listener fires.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus('success');
        supabase.auth.signOut();
      } else if (!hash.includes('access_token') && !hash.includes('type=signup')) {
        // No token in URL and no active session → likely a direct navigation with no valid context.
        setErrorMessage('No valid confirmation token found. Please check your email for the confirmation link.');
        setStatus('error');
      }
      // If there IS a token in the URL but no session yet, keep 'loading' and let the
      // onAuthStateChange listener above resolve it.
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--color-surface-white)">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-(--color-primary-600) border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-(--color-text-600)">Verifying your email confirmation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-(--color-surface-white)">
        <div className="w-full max-w-md text-center">
          <img src={gppLogo} alt="GPP FCIT KAU" className="w-48 mx-auto mb-8" />

          {status === 'success' ? (
            <>
              {/* Success icon */}
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>

              <h1 className="text-(--color-text-900) mb-3">Email Confirmed!</h1>

              <p className="text-lg text-green-700 font-medium mb-2">
                Your account has been successfully confirmed.
              </p>

              <p className="text-(--color-text-600) mb-8">
                Your registration is now pending admin review. You will be able to log in once
                your account has been approved. Keep an eye on your university email for an
                approval notification.
              </p>

              <Link to="/login?confirmed=true">
                <Button className="w-full flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Go to Login
                </Button>
              </Link>
            </>
          ) : (
            <>
              {/* Error icon */}
              <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>

              <h1 className="text-(--color-text-900) mb-3">Confirmation Failed</h1>

              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-8 text-left">
                <p className="text-sm font-medium text-red-800 mb-1">Unable to confirm your email</p>
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>

              <p className="text-(--color-text-600) mb-8">
                If this was already confirmed, please proceed to login. Otherwise, try registering
                again to receive a new confirmation email.
              </p>

              <div className="space-y-3">
                <Link to="/login">
                  <Button className="w-full flex items-center justify-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Go to Login
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="outline" className="w-full">
                    Register Again
                  </Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="hidden lg:flex w-1/2 bg-linear-to-br from-(--color-primary-600) to-(--color-primary-700) p-12 items-center justify-center text-white sticky top-0 h-screen">
        <div className="max-w-md text-center">
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-white mb-4">Welcome to the Graduation Project Platform</h2>
          <p className="text-white/80 mb-8">
            A comprehensive platform for managing graduation projects at FCIT,
            King Abdulaziz University.
          </p>
          <ul className="space-y-4 text-left">
            {[
              { step: '1', title: 'Email Confirmed', desc: 'Your university email has been verified' },
              { step: '2', title: 'Admin Review',    desc: 'Your registration is reviewed by the coordinator or admin' },
              { step: '3', title: 'Get Started',     desc: 'Once approved, sign in and start using the platform' },
            ].map((item) => (
              <li key={item.step} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5 text-sm font-semibold">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-white mb-1">{item.title}</h3>
                  <p className="text-white/80 text-sm">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
