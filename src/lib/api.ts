// Base URL for API calls.
// In production set VITE_API_URL to your backend domain, e.g. https://backend.cranl.app
// In development the Vite proxy handles /api → localhost:5000 so we leave this empty.
export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export function apiUrl(path: string): string {
  // path must start with /api/...
  return `${API_BASE}${path}`;
}

/** Drop-in replacement for fetch() that converts network-level failures
 *  (TypeError: "Failed to fetch") into a readable "Connection error" message. */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error('Connection error. Please check your network and try again.');
    }
    throw err;
  }
}
