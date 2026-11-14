import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { currentAuthStep, getSupabase } from '@/lib/supabase';

/**
 * Renders its children only for a session that passed TOTP (aal2); anything
 * less goes to Sign in. RLS enforces the same rule on every table, so this is
 * only about showing the right screen.
 */
export function RequireAal2({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let active = true;
    currentAuthStep().then((step) => {
      if (active) setState(step === 'done' ? 'allowed' : 'denied');
    });
    const { data } = getSupabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) setState('denied');
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (state === 'checking') return null;
  if (state === 'denied') return <Navigate to="/sign-in" replace />;
  return children;
}
