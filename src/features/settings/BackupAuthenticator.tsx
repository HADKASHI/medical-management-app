import type { FormEvent } from 'react';
import {
  useStartBackupEnrolment,
  useVerifiedFactorCount,
  useVerifyBackupEnrolment,
} from './authenticators';

const buttonClass = 'rounded border border-gray-300 px-4 py-2 disabled:opacity-50';

/**
 * The second, backup TOTP factor, saved offline. Sign-in accepts a code from
 * either factor. If both are lost, the owner removes a factor in the Supabase
 * dashboard.
 */
export function BackupAuthenticator() {
  const factors = useVerifiedFactorCount();
  const start = useStartBackupEnrolment();
  const verify = useVerifyBackupEnrolment();
  const enrolment = start.data;
  const error = factors.error ?? start.error ?? verify.error;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enrolment) return;
    const code = String(new FormData(e.currentTarget).get('code'));
    verify.mutate({ factorId: enrolment.factorId, code });
  }

  let body;
  if (factors.isPending) body = <p>Loading…</p>;
  else if ((factors.data ?? 0) >= 2) body = <p>Main and backup authenticators are set up.</p>;
  else if (!enrolment)
    body = (
      <>
        <p>Add a backup authenticator and keep it offline, in case the main one is lost.</p>
        <button
          type="button"
          disabled={start.isPending}
          className={buttonClass}
          onClick={() => start.mutate()}
        >
          Add backup authenticator
        </button>
      </>
    );
  else
    body = (
      <form onSubmit={submit} className="space-y-3">
        <p>
          Scan this code with the backup authenticator, or enter the key below, then type the code
          it shows.
        </p>
        <img src={enrolment.qrCode} alt="Backup authenticator QR code" className="h-48 w-48" />
        <p className="font-mono break-all">{enrolment.secret}</p>
        <label className="block">
          Authentication code
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button type="submit" disabled={verify.isPending} className={buttonClass}>
          Verify backup
        </button>
      </form>
    );

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Authenticators</h2>
      {body}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
    </section>
  );
}
