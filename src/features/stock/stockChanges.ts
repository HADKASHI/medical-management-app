import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/**
 * A Restock as the owner enters it: Units, or packs that the database converts
 * with the Stock Item's Pack Size. Omitting restocked_on means today.
 */
export type RestockInput = Omit<
  Database['public']['Functions']['record_restock']['Args'],
  'stock_item_id' | 'note'
> & { note: string | null };

const stockItemsKey = ['stock_items'] as const;

/** Records a Restock; the Stock Item's quantity rises in the same transaction. */
export function useRecordRestock(stockItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ note, ...input }: RestockInput) => {
      const { error } = await getSupabase().rpc('record_restock', {
        stock_item_id: stockItemId,
        ...input,
        ...(note ? { note } : {}),
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stockItemsKey }),
  });
}

/** Records a Stock Count: quantity becomes what was counted; the previous one is kept. */
export function useRecordStockCount(stockItemId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (countedQuantity: number) => {
      const { error } = await getSupabase().rpc('record_stock_count', {
        stock_item_id: stockItemId,
        counted_quantity: countedQuantity,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: stockItemsKey }),
  });
}
