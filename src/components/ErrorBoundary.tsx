import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React error boundary — catches unhandled render/lifecycle errors in the
 * component tree below it and shows a user-friendly recovery screen instead of
 * a blank page.
 *
 * Place this once near the root of the app (in App.tsx) and optionally wrap
 * individual high-risk subtrees for finer-grained recovery.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // In production you would send this to an error tracking service (Sentry, etc.)
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return <DefaultErrorScreen error={this.state.error} reset={this.reset} />;
  }
}

// ── Default fallback UI ───────────────────────────────────────────────────────

function DefaultErrorScreen({ error, reset }: { error: Error; reset: () => void }) {
  const isDev = import.meta.env.DEV;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-alt,#f9fafb)] p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-8 h-8 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-gray-500 text-sm">
          An unexpected error occurred. You can try refreshing the page or returning to the
          dashboard.
        </p>

        {isDev && (
          <pre className="text-left text-xs bg-gray-100 rounded p-3 overflow-auto max-h-40 text-red-700">
            {error.message}
          </pre>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = '/'; }}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Go to home
          </button>
        </div>
      </div>
    </div>
  );
}
