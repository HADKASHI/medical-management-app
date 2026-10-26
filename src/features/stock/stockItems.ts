import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type StockItem = Database['public']['Tables']['stock_items']['Row'];
export type StockItemKind = Database['public']['Enums']['stock_item_kind'];

/** The fields the owner enters when creating a Stock Item. */
export type StockItemInput = Pick<
  StockItem,
  'name' | 'kind' | 'strength' | 'unit' | 'quantity' | 'low_stock_threshold' | 'pack_size'
>;

/**
 * The fields the owner edits later. Quantity is not among them: it changes
 * only through a taken Dose, a Restock or a Stock Count.
 */
export type StockItemEdit = Omit<StockItemInput, 'quantity'>;

const stockItemsKey = ['stock_items'] as const;

/** Every Stock Item, active and Archived, by name. */
export function useStockItems() {
  return useQuery({
    queryKey: stockItemsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('stock_items').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

/** Creates a Stock Item, or edits the one with `id`. */
export function useSaveStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      save: { id: string; input: StockItemEdit } | { id?: undefined; input: StockItemInput },
    ) => {
      const table = getSupabase().from('stock_items');
      const { error } = save.id
        ? await table.update(save.input).eq('id', save.id)
        : await table.insert(save.input);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stockItemsKey }),
  });
}

/** Archives a Stock Item: it keeps its row and history and leaves daily views. */
export function useArchiveStockItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc('archive_stock_item', { stock_item_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stockItemsKey }),
  });
}
