import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase';

/** A TOTP factor being enrolled: scan the QR code or type the secret. */
export interface Enrolment {
  factorId: string;
  qrCode: string;
  secret: string;
}

const factorsKey = ['mfa-factors'] as const;

/** How many TOTP factors are verified: 1 is the main one, 2 adds the backup. */
export function useVerifiedFactorCount() {
  return useQuery({
    queryKey: factorsKey,
    queryFn: async () => {
      const { data, error } = await getSupabase().auth.mfa.listFactors();
      if (error) throw error;
      return data.totp.length;
    },
  });
}

/**
 * Starts enrolling the backup TOTP factor, after dropping any factor left
 * unverified by an abandoned enrolment. Supabase needs a distinct friendly
 * name per factor.
 */
export function useStartBackupEnrolment() {
  return useMutation({
    mutationFn: async (): Promise<Enrolment> => {
      const mfa = getSupabase().auth.mfa;
      const { data: factors } = await mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.status === 'unverified') await mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await mfa.enroll({
        factorType: 'totp',
        friendlyName: `Backup ${new Date().toISOString()}`,
      });
      if (error) throw error;
      return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
    },
  });
}

/** Verifies the backup factor with a code from it, which completes enrolment. */
export function useVerifyBackupEnrolment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ factorId, code }: { factorId: string; code: string }) => {
      const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: factorsKey }),
  });
}
