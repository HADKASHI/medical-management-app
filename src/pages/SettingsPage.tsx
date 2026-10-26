import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { BackupAuthenticator } from '@/features/settings/BackupAuthenticator';
import { LeadTimesForm } from '@/features/settings/LeadTimesForm';
import { useSaveLeadDays, useSettings } from '@/features/settings/settings';
import { queryCachePersister, queryClient } from '@/lib/queryClient';
import { signOut } from '@/lib/session';
import { getSupabase } from '@/lib/supabase';

const buttonClass = 'block rounded border border-gray-300 px-4 py-2 disabled:opacity-50';

export function SettingsPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut(everywhere: boolean) {
    setBusy(true);
    setError(null);
    try {
      await signOut(
        { auth: getSupabase().auth, queryClient, persister: queryCachePersister },
        { everywhere },
      );
      navigate('/sign-in', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-out failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <LeadTimesSection />
      <BackupAuthenticator />
      <h2 className="text-lg font-semibold">Session</h2>
      <button
        type="button"
        disabled={busy}
        className={buttonClass}
        onClick={() => handleSignOut(false)}
      >
        Sign out
      </button>
      <button
        type="button"
        disabled={busy}
        className={buttonClass}
        onClick={() => handleSignOut(true)}
      >
        Sign out everywhere
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <Link to="/" className="underline">
        Home
      </Link>
    </main>
  );
}

function LeadTimesSection() {
  const settings = useSettings();
  const save = useSaveLeadDays();
  const days = settings.data?.authorization_lead_days;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Authorization lead times</h2>
      <p className="text-sm text-gray-600">
        An Authorization enters the Alerts list at the first notice and stays until it is renewed or
        archived.
      </p>
      {settings.isPending && <p>Loading…</p>}
      {days && (
        <LeadTimesForm
          key={days.join(',')}
          value={days}
          submitting={save.isPending}
          onSubmit={(next) => save.mutate(next)}
        />
      )}
      {save.isSuccess && <p role="status">Lead times saved.</p>}
      {(settings.error ?? save.error) && (
        <p role="alert" className="text-red-700">
          {(settings.error ?? save.error)!.message}
        </p>
      )}
    </section>
  );
}
