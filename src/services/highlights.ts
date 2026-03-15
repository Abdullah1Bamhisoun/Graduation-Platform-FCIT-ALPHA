import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HighlightComment {
  id: string;
  highlightId: string;
  userId: string;
  userName: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface Highlight {
  id: string;
  documentId: string;
  selectedText: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  startPosition?: number | null;
  endPosition?: number | null;
  highlightColor: string;
  userId: string;
  userName: string;
  role: string;
  createdAt: string;
  comments: HighlightComment[];
}

export interface CreateHighlightPayload {
  documentId: string;
  selectedText: string;
  pageNumber: number;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  startPosition?: number;
  endPosition?: number;
  highlightColor?: string;
  comment?: string;
}

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function fetchHighlights(documentId: string): Promise<Highlight[]> {
  const token = await getToken();
  const res = await fetch(`/api/highlights?documentId=${encodeURIComponent(documentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch highlights');
  }
  return res.json();
}

export async function createHighlight(payload: CreateHighlightPayload): Promise<Highlight> {
  const token = await getToken();
  const res = await fetch('/api/highlights', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create highlight');
  }
  return res.json();
}

export async function deleteHighlight(highlightId: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/highlights/${highlightId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete highlight');
  }
}

export async function addHighlightComment(
  highlightId: string,
  content: string,
): Promise<HighlightComment> {
  const token = await getToken();
  const res = await fetch(`/api/highlights/${highlightId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add comment');
  }
  return res.json();
}

export async function deleteHighlightComment(
  highlightId: string,
  commentId: string,
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/highlights/${highlightId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete comment');
  }
}
