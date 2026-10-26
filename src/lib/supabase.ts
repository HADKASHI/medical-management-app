import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

let client: SupabaseClient<Database> | undefined;

/**
 * The app's Supabase client, created on first use from the build-time env
 * (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; see `.env.example`). The
 * session (refresh token) is kept in the PWA's storage, so it stays signed in.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set');
    }
    client = createClient<Database>(url, key);
  }
  return client;
}

/** Where the signed-in user stands on the way to an aal2 session. */
export type AuthStep = 'password' | 'totp' | 'enrol' | 'done';

export async function currentAuthStep(): Promise<AuthStep> {
  const supabase = getSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return 'password';
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) return 'password';
  if (data.currentLevel === 'aal2') return 'done';
  return data.nextLevel === 'aal2' ? 'totp' : 'enrol';
}
