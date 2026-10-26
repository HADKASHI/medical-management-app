import { useQuery } from '@tanstack/react-query';
import type { Appointment } from '@/features/appointments/appointments';
import { getSupabase } from '@/lib/supabase';

/** An Appointment with its linked Authorization's reference number, if any. */
export type Visit = Pick<
  Appointment,
  'id' | 'title' | 'starts_at' | 'provider' | 'visit_summary' | 'status'
> & { authorization: { reference_number: string } | null };

/** Every Appointment with its derived status, newest start first. */
export function useVisits() {
  return useQuery({
    queryKey: ['reports', 'visits'],
    queryFn: async (): Promise<Visit[]> => {
      const { data, error } = await getSupabase()
        .from('appointments')
        .select(
          'id, title, starts_at, provider, visit_summary, status, authorization:authorizations(reference_number)',
        )
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}
