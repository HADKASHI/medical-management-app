import { useQuery } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type Alert = Database['public']['Views']['alerts']['Row'];

/**
 * The Alerts list, derived in the database from current conditions, so it is
 * refetched whenever the screen is shown rather than invalidated by writes.
 */
export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('alerts')
        .select('*')
        .order('needs_stock_count', { ascending: false })
        .order('message');
      if (error) throw error;
      return data;
    },
  });
}
