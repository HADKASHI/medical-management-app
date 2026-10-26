import { randomUUID } from 'node:crypto';
import { test as base } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { Secret, TOTP } from 'otpauth';

export interface Owner {
  email: string;
  password: string;
  /** A current code from the owner's authenticator. */
  totpCode(): string;
}

const OWNER_EMAIL = 'user@example.com';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (is the local Supabase stack running?)`);
  return value;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/**
 * The owner's account on the local stack, recreated for each test with a fresh
 * password and one verified TOTP factor. Sign-up is disabled, so it is made
 * with the admin API, as the owner's real account is made once in production.
 */
async function createOwner(): Promise<Owner> {
  const url = env('SUPABASE_URL');
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), noSession);

  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  for (const user of list.users.filter((u) => u.email === OWNER_EMAIL)) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  }

  const password = randomUUID();
  const { error: createError } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password,
    email_confirm: true,
  });
  if (createError) throw createError;

  const owner = createClient(url, env('SUPABASE_ANON_KEY'), noSession);
  const { error: signInError } = await owner.auth.signInWithPassword({ email: OWNER_EMAIL, password });
  if (signInError) throw signInError;
  const { data: factor, error: enrolError } = await owner.auth.mfa.enroll({ factorType: 'totp' });
  if (enrolError) throw enrolError;

  const totp = new TOTP({ secret: Secret.fromBase32(factor.totp.secret) });
  const { error: verifyError } = await owner.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: totp.generate(),
  });
  if (verifyError) throw verifyError;
  await owner.auth.signOut({ scope: 'local' });

  return { email: OWNER_EMAIL, password, totpCode: () => totp.generate() };
}

export const test = base.extend<{ owner: Owner }>({
  // eslint-disable-next-line no-empty-pattern
  owner: async ({}, use) => {
    await use(await createOwner());
  },
});

export { expect } from '@playwright/test';
