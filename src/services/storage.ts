import { supabase } from '../lib/supabase';

const BUCKET = 'File Upload';

export async function uploadSubmissionFile(
  file: File,
  studentId: string,
  milestoneId: string
): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `submissions/${studentId}/${milestoneId}/${timestamp}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: false });

  if (error) throw error;
  return filePath;
}

/** Uploads an admin-managed important file. Returns the storage path. */
export async function uploadImportantFile(file: File): Promise<string> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `important-files/${timestamp}-${safeName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { upsert: false });

  if (error) throw error;
  return filePath;
}

/** Removes an already-uploaded file from storage (called on DB rollback). */
export async function deleteStorageFile(filePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([filePath]);
}

/**
 * Uploads a committee evaluation feedback file via the backend (supabaseAdmin),
 * bypassing storage bucket RLS that blocks frontend uploads.
 * Returns the storage path.
 */
export async function uploadCommitteeFeedbackFile(
  file: File,
  groupId: string,
  _evaluatorId: string
): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const form = new FormData();
  form.append('file', file);
  form.append('groupId', groupId);

  // Import lazily to avoid circular deps
  const { apiUrl, apiFetch } = await import('@/lib/api');
  const res = await apiFetch(apiUrl('/api/evaluations/upload-feedback-file'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }

  const { filePath } = await res.json();
  return filePath;
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data.signedUrl;
}
