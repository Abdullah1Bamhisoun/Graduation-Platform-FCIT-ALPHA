// Base URL for API calls.
// In production set VITE_API_URL to your backend domain, e.g. https://backend.cranl.app
// In development the Vite proxy handles /api → localhost:5000 so we leave this empty.
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function apiUrl(path: string): string {
  // path must start with /api/...
  return `${API_BASE}${path}`;
}
