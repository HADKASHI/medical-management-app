import { useQuery } from '@tanstack/react-query';
import type { DoseSchedulePattern } from '@/features/doses/doseSchedules';
import type { DoseStatus } from '@/features/doses/dueDoses';
import { getSupabase } from '@/lib/supabase';

/** A Dose in a month report, with its Asia/Jerusalem local date and time. */
export type MonthDose = {
  id: string;
  stock_item_id: string;
  /** null for an As Needed Dose */
  dose_schedule_id: string | null;
  due_at: string | null;
  taken_at: string | null;
  status: DoseStatus;
  amount: number;
  /** "2026-01-31": the due date, or for an As Needed Dose the date it was taken */
  local_date: string;
  /** "08:00:00" */
  local_time: string;
};

/** A Dose Schedule version in force on at least one day of the month. */
export type MonthDoseSchedule = {
  id: string;
  stock_item_id: string;
  pattern: DoseSchedulePattern;
  /** first local date in force */
  effective_from: string;
  /** exclusive; null = the current version */
  effective_to: string | null;
  /** Dose Times, "08:00:00", in time order */
  times: string[];
};

export type MonthDoseReport = { doses: MonthDose[]; schedules: MonthDoseSchedule[] };

/** A month of Doses and the schedule versions in force; `month` is "YYYY-MM-01". */
export function useMonthDoses(month: string) {
  return useQuery({
    queryKey: ['reports', 'month_doses', month],
    queryFn: async (): Promise<MonthDoseReport> => {
      const supabase = getSupabase();
      const [doses, schedules] = await Promise.all([
        supabase.rpc('month_doses', { month }),
        supabase.rpc('month_dose_schedules', { month }),
      ]);
      if (doses.error) throw doses.error;
      if (schedules.error) throw schedules.error;
      // Generated types drop the nullability of RPC table columns.
      return {
        doses: doses.data as MonthDose[],
        schedules: schedules.data as MonthDoseSchedule[],
      };
    },
  });
}
