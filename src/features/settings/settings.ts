import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';
import { DEFAULT_LEAD_DAYS, type LeadDays } from './leadDays';

export interface Settings {
  authorization_lead_days: LeadDays;
}

const settingsKey = ['settings'] as const;

/** The app-wide settings; the defaults while no row is saved yet. */
export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await getSupabase()
        .from('settings')
        .select('authorization_lead_days')
        .maybeSingle();
      if (error) throw error;
      return {
        authorization_lead_days:
          (data?.authorization_lead_days as LeadDays | undefined) ?? DEFAULT_LEAD_DAYS,
      };
    },
  });
}

/** Saves the Authorization lead times, creating the settings row on first save. */
export function useSaveLeadDays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (days: LeadDays) => {
      const { error } = await getSupabase()
        .from('settings')
        .upsert({ authorization_lead_days: days }, { onConflict: 'owner_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKey });
      // The Alerts list reads the lead times.
      void queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
