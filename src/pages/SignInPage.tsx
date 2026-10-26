import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { currentAuthStep, getSupabase, type AuthStep } from '@/lib/supabase';

const inputClass = 'w-full rounded border border-gray-300 px-3 py-2';
const buttonClass = 'rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50';

/**
 * Email + password, then a TOTP code. With no verified factor yet, the second
 * step enrols one (scan the QR code or type the secret into an authenticator).
 */
export function SignInPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<AuthStep | 'loading'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    currentAuthStep().then((next) => {
      if (!active) return;
      if (next === 'done') navigate('/', { replace: true });
      else setStep(next);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function advance() {
    const next = await currentAuthStep();
    if (next === 'done') navigate('/', { replace: true });
    else setStep(next);
  }

  const run = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <main className="mx-auto max-w-sm space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      {step === 'password' && (
        <PasswordStep busy={busy} onSubmit={(email, password) => run(() => signIn(email, password).then(advance))} />
      )}
      {step === 'totp' && <TotpStep busy={busy} onSubmit={(code) => run(() => verifyTotp(code).then(advance))} />}
      {step === 'enrol' && <EnrolStep busy={busy} run={run} onEnrolled={advance} />}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
    </main>
  );
}

async function signIn(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function verifyTotp(code: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const factor = data.totp[0];
  if (!factor) throw new Error('No authenticator is set up');
  const result = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (result.error) throw result.error;
}

function PasswordStep({ busy, onSubmit }: { busy: boolean; onSubmit: (email: string, password: string) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    onSubmit(String(form.get('email')), String(form.get('password')));
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        Email
        <input name="email" type="email" autoComplete="username" required className={inputClass} />
      </label>
      <label className="block">
        Password
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={buttonClass}>
        Sign in
      </button>
    </form>
  );
}

function CodeField() {
  return (
    <label className="block">
      Authentication code
      <input
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        required
        className={inputClass}
      />
    </label>
  );
}

function TotpStep({ busy, onSubmit }: { busy: boolean; onSubmit: (code: string) => void }) {
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    onSubmit(String(new FormData(e.currentTarget).get('code')));
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p>Enter the code from your authenticator.</p>
      <CodeField />
      <button type="submit" disabled={busy} className={buttonClass}>
        Verify
      </button>
    </form>
  );
}

interface Enrolment {
  factorId: string;
  qrCode: string;
  secret: string;
}

function EnrolStep({
  busy,
  run,
  onEnrolled,
}: {
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  onEnrolled: () => Promise<void>;
}) {
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Enrol once per visit, even when StrictMode runs effects twice.
    if (started.current) return;
    started.current = true;
    void run(async () => {
      const supabase = getSupabase();
      // Drop factors left unverified by an earlier, abandoned enrolment.
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setEnrolment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    });
  }, [run]);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enrolment) return;
    const code = String(new FormData(e.currentTarget).get('code'));
    void run(async () => {
      const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId: enrolment.factorId, code });
      if (error) throw error;
      await onEnrolled();
    });
  }

  if (!enrolment) return <p>Setting up your authenticator…</p>;
  return (
    <form onSubmit={submit} className="space-y-3">
      <p>Scan this code with your authenticator, or enter the key below, then type the code it shows.</p>
      <img src={enrolment.qrCode} alt="Authenticator QR code" className="h-48 w-48" />
      <p className="font-mono break-all">{enrolment.secret}</p>
      <CodeField />
      <button type="submit" disabled={busy} className={buttonClass}>
        Verify
      </button>
    </form>
  );
}
