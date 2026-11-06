import { useQuery } from '@tanstack/react-query';
import type { AuthorizationType } from '@/features/authorizations/authorizations';
import { getSupabase } from '@/lib/supabase';

/** A Restock filled under an Authorization. */
export type ChainRestock = { id: string; restocked_on: string; quantity: number; unit: string };

/** One Authorization in a renewal chain; depth 0 is the current one. */
export type ChainLink = {
  current_id: string;
  depth: number;
  id: string;
  type: AuthorizationType;
  reference_number: string;
  covers: string;
  stock_item_id: string | null;
  issued_on: string | null;
  expires_on: string;
  archived_at: string | null;
  renewed: boolean;
  /** newest first */
  restocks: ChainRestock[];
};

/** A current Authorization (archived included) and its chain, newest to oldest. */
export type RenewalChain = { current: ChainLink; links: ChainLink[] };

/** Every renewal chain, newest expiry first. */
export function useRenewalChains() {
  return useQuery({
    queryKey: ['reports', 'renewal_chains'],
    queryFn: async (): Promise<RenewalChain[]> => {
      const { data, error } = await getSupabase().rpc('renewal_chains');
      if (error) throw error;
      // Generated types drop the nullability of RPC table columns.
      const chains = new Map<string, ChainLink[]>();
      for (const link of data as unknown as ChainLink[]) {
        chains.set(link.current_id, [...(chains.get(link.current_id) ?? []), link]);
      }
      return [...chains.values()].map((links) => ({ current: links[0]!, links }));
    },
  });
}
