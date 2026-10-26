import type { QueryClient } from '@tanstack/react-query';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import { del, get, set } from 'idb-keyval';

const QUERY_CACHE_KEY = 'medical-management-query-cache';

/** Persists the TanStack Query cache to IndexedDB under one key. */
export function createQueryCachePersister(key: string = QUERY_CACHE_KEY): Persister {
  return {
    persistClient: (client: PersistedClient) => set(key, client),
    restoreClient: () => get<PersistedClient>(key),
    removeClient: () => del(key),
  };
}

/** The part of `supabase.auth` sign-out needs. */
export interface SignOutAuth {
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{ error: Error | null }>;
}

export interface SessionDeps {
  auth: SignOutAuth;
  queryClient: QueryClient;
  persister: Persister;
}

/**
 * Signs this device out and clears its cached data. With `everywhere`, every
 * refresh token is revoked (Supabase global sign-out), so other devices must
 * sign in again.
 *
 * Later slices: also delete this device's `push_subscriptions` row (all rows
 * when `everywhere`) once that table exists.
 */
export async function signOut(
  { auth, queryClient, persister }: SessionDeps,
  { everywhere = false }: { everywhere?: boolean } = {},
): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
  const { error } = await auth.signOut({ scope: everywhere ? 'global' : 'local' });
  if (error) throw error;
}
