import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Switches between localStorage (remember me) and sessionStorage (don't remember).
// Must be configured before the Supabase client reads from storage.
class AdaptiveStorage implements Storage {
  private _useLocal = true;

  setMode(rememberMe: boolean) { this._useLocal = rememberMe; }

  private get store(): Storage {
    return this._useLocal ? localStorage : sessionStorage;
  }

  get length(): number { return this.store.length; }
  key(index: number): string | null { return this.store.key(index); }
  getItem(key: string): string | null { return this.store.getItem(key); }
  setItem(key: string, value: string): void { this.store.setItem(key, value); }
  removeItem(key: string): void { this.store.removeItem(key); }
  clear(): void { this.store.clear(); }
}

export const adaptiveStorage = new AdaptiveStorage();

// Restore storage mode from previous login preference before the client initializes.
if (localStorage.getItem('rememberMePref') === 'false') {
  adaptiveStorage.setMode(false);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: adaptiveStorage },
});
