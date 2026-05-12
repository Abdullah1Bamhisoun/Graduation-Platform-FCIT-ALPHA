import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bmpnorvnjqzldrinfrop.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtcG5vcnZuanF6bGRyaW5mcm9wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDgwNTk1OCwiZXhwIjoyMDg2MzgxOTU4fQ.dvNrjVNHrUbwXmquZo-COxA40zhO02GorIf7SjvUoYc';
const BUCKET = 'File Upload';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function listAllFiles(prefix = '') {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    limit: 1000,
    offset: 0,
  });

  if (error) throw new Error(`Failed to list files at "${prefix}": ${error.message}`);

  const files = [];
  for (const item of data ?? []) {
    if (item.id) {
      // It's a file
      files.push(prefix ? `${prefix}/${item.name}` : item.name);
    } else {
      // It's a folder — recurse
      const nested = await listAllFiles(prefix ? `${prefix}/${item.name}` : item.name);
      files.push(...nested);
    }
  }
  return files;
}

const ROOT_FOLDER = 'submissions';

async function main() {
  console.log(`Listing all files in bucket: "${BUCKET}/${ROOT_FOLDER}" ...`);
  const files = await listAllFiles(ROOT_FOLDER);

  if (files.length === 0) {
    console.log('Bucket is already empty. Nothing to delete.');
    return;
  }

  console.log(`Found ${files.length} file(s):`);
  files.forEach(f => console.log('  -', f));

  console.log(`\nDeleting ${files.length} file(s)...`);

  // Supabase remove() accepts up to ~1000 paths at once
  const CHUNK_SIZE = 500;
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(chunk);
    if (error) throw new Error(`Failed to delete chunk: ${error.message}`);
    console.log(`  Deleted ${Math.min(i + CHUNK_SIZE, files.length)} / ${files.length}`);
  }

  console.log('Done. All files deleted.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
