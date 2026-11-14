import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/** An Authorization, with `renewed`: another Authorization renews this one. */
export type Authorization = Database['public']['Tables']['authorizations']['Row'];
export type AuthorizationType = Database['public']['Enums']['authorization_type'];

/** The fields the owner enters; `renews_authorization_id` is set only by Renewal. */
export type AuthorizationInput = Pick<
  Authorization,
  'type' | 'reference_number' | 'covers' | 'stock_item_id' | 'issued_on' | 'expires_on'
> & { renews_authorization_id?: string | null };

const authorizationsKey = ['authorizations'] as const;

/** Every Authorization, current, renewed and Archived, soonest expiry first. */
export function useAuthorizations() {
  return useQuery({
    queryKey: authorizationsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('authorizations')
        .select('*, renewed')
        .order('expires_on');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Creates an Authorization, or edits the one with `id`. A Renewal is a create
 * whose `renews_authorization_id` points at the old Authorization.
 */
export function useSaveAuthorization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: AuthorizationInput }) => {
      const table = getSupabase().from('authorizations');
      const { error } = id ? await table.update(input).eq('id', id) : await table.insert(input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authorizationsKey }),
  });
}

/** Archives an Authorization: it keeps its row and leaves daily views. */
export function useArchiveAuthorization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc('archive_authorization', { authorization_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authorizationsKey }),
  });
}

/** Deletes an Authorization entered by mistake. */
export function useDeleteAuthorization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('authorizations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authorizationsKey }),
  });
}
