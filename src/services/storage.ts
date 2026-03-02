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

/** Removes an already-uploaded file from storage (called on DB rollback). */
export async function deleteStorageFile(filePath: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([filePath]);
}

export async function getSignedUrl(filePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);

  if (error) throw error;
  return data.signedUrl;
}
