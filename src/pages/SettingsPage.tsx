import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
      await signOut({ auth: getSupabase().auth, queryClient, persister: queryCachePersister }, { everywhere });
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
      <button type="button" disabled={busy} className={buttonClass} onClick={() => handleSignOut(false)}>
        Sign out
      </button>
      <button type="button" disabled={busy} className={buttonClass} onClick={() => handleSignOut(true)}>
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
