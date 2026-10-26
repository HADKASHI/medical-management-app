import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/** An Appointment with its derived status (scheduled, done or cancelled). */
export type Appointment = Database['public']['Tables']['appointments']['Row'];
export type AppointmentStatus = Database['public']['Enums']['appointment_status'];

/** The fields the owner enters on the Appointment form. */
export type AppointmentInput = Pick<
  Appointment,
  | 'title'
  | 'starts_at'
  | 'ends_at'
  | 'provider'
  | 'location'
  | 'notes'
  | 'buffer_before_minutes'
  | 'buffer_after_minutes'
  | 'send_to_work_calendar'
>;

const appointmentsKey = ['appointments'] as const;

/** Every Appointment, newest start first, with its derived status. */
export function useAppointments() {
  return useQuery({
    queryKey: appointmentsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('appointments')
        .select('*, status')
        .order('starts_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Creates an Appointment, or edits the one with `id`. Returns its id. */
export function useSaveAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (save: {
      id?: string;
      input: Partial<AppointmentInput> & {
        visit_summary?: string | null;
      };
    }) => {
      const table = getSupabase().from('appointments');
      const { data, error } = save.id
        ? await table.update(save.input).eq('id', save.id).select('id').single()
        : await table
            .insert(save.input as AppointmentInput)
            .select('id')
            .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appointmentsKey }),
  });
}

/** Cancels an Appointment: it is kept, as cancelled. */
export function useCancelAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().rpc('cancel_appointment', { appointment_id: id });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appointmentsKey }),
  });
}

/** Deletes an Appointment for good. */
export function useDeleteAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appointmentsKey }),
  });
}

/**
 * Copies an Appointment to new times: everything else carries over except the
 * Visit Summary and the cancellation. Returns the copy's id.
 */
export function useDuplicateAppointment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (copy: { id: string; starts_at: string; ends_at: string }) => {
      const { data, error } = await getSupabase().rpc('duplicate_appointment', {
        appointment_id: copy.id,
        starts_at: copy.starts_at,
        ends_at: copy.ends_at,
      });
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: appointmentsKey }),
  });
}
