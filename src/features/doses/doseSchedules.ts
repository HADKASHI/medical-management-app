import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type DoseSchedulePattern = Database['public']['Enums']['dose_schedule_pattern'];

/** One Dose Time: an Asia/Jerusalem wall-clock time ("08:00") and the Units taken then. */
export type DoseTimeInput = { time_of_day: string; amount: number };

/** What the owner enters to save a new version of a medication's Dose Schedule. */
export type DoseScheduleInput = {
  pattern: DoseSchedulePattern;
  times: DoseTimeInput[];
  /** 0 = Sunday … 6 = Saturday; only for `weekdays`. */
  weekdays: number[] | null;
  /** Only for `every_n_days`, counted from effective_from. */
  interval_days: number | null;
  /** First day of the new version; null = today. */
  effective_from: string | null;
};

const scheduleKey = (stockItemId: string) => ['dose_schedule', stockItemId] as const;

/** The current version of a Stock Item's Dose Schedule, or null if it has none. */
export function useCurrentDoseSchedule(stockItemId: string) {
  return useQuery({
    queryKey: scheduleKey(stockItemId),
    queryFn: async (): Promise<DoseScheduleInput | null> => {
      const { data, error } = await getSupabase()
        .from('dose_schedules')
        .select('pattern, weekdays, interval_days, dose_times (time_of_day, amount)')
        .eq('stock_item_id', stockItemId)
        .is('effective_to', null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        pattern: data.pattern,
        weekdays: data.weekdays,
        interval_days: data.interval_days,
        effective_from: null,
        times: data.dose_times
          .map((t) => ({ time_of_day: t.time_of_day.slice(0, 5), amount: t.amount }))
          .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day)),
      };
    },
  });
}

/** Saves a new version of a Stock Item's Dose Schedule, ending the current one. */
export function useSaveDoseSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      stockItemId,
      input,
    }: {
      stockItemId: string;
      input: DoseScheduleInput;
    }) => {
      const { error } = await getSupabase().rpc('save_dose_schedule', {
        stock_item_id: stockItemId,
        pattern: input.pattern,
        times: input.times,
        weekdays: input.weekdays ?? undefined,
        interval_days: input.interval_days ?? undefined,
        effective_from: input.effective_from ?? undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { stockItemId }) =>
      queryClient.invalidateQueries({ queryKey: scheduleKey(stockItemId) }),
  });
}
