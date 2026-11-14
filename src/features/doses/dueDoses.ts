import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type DoseStatus = Database['public']['Enums']['dose_status'];

/** A pending Dose as Due Doses lists it. */
export type DueDose = {
  id: string;
  due_at: string | null;
  amount: number;
  stock_item: { name: string; strength: string | null; unit: string };
};

const dueDosesKey = ['due_doses'] as const;
const stockItemsKey = ['stock_items'] as const;

/** Every pending Dose, earliest first. */
export function useDueDoses() {
  return useQuery({
    queryKey: dueDosesKey,
    queryFn: async (): Promise<DueDose[]> => {
      const { data, error } = await getSupabase()
        .from('doses')
        .select('id, due_at, amount, stock_item:stock_items!inner (name, strength, unit)')
        .eq('status', 'pending')
        .order('due_at', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Dose status and stock change together, so both caches are refreshed. */
function useDoseMutation<TInput>(mutationFn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: dueDosesKey }),
        queryClient.invalidateQueries({ queryKey: stockItemsKey }),
      ]),
  });
}

/** Marks one Dose taken, skipped, or pending again; quantity follows in the same transaction. */
export function useSetDoseStatus() {
  return useDoseMutation(async ({ doseId, status }: { doseId: string; status: DoseStatus }) => {
    const { error } = await getSupabase().rpc('set_dose_status', { dose_id: doseId, status });
    if (error) throw error;
  });
}

/** "All taken": takes every listed pending Dose in one transaction. */
export function useTakeDoses() {
  return useDoseMutation(async (doseIds: string[]) => {
    const { error } = await getSupabase().rpc('take_doses', { dose_ids: doseIds });
    if (error) throw error;
  });
}

/** Logs an As Needed Dose: created as taken, now, and subtracted from quantity. */
export function useLogAsNeededDose(stockItemId: string) {
  return useDoseMutation(async (amount: number) => {
    const { error } = await getSupabase().rpc('log_as_needed_dose', {
      stock_item_id: stockItemId,
      amount,
    });
    if (error) throw error;
  });
}
