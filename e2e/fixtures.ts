import { randomUUID } from 'node:crypto';
import { test as base, type Page } from '@playwright/test';
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
 * The owner's account on the local stack, set up for each test with a fresh
 * password and one verified TOTP factor. Sign-up is disabled, so it is made
 * with the admin API, as the owner's real account is made once in production.
 * An existing account is reused rather than deleted, since the owner's rows
 * reference it: data from earlier tests stays, so tests use unique names.
 */
async function createOwner(): Promise<Owner> {
  const url = env('SUPABASE_URL');
  const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), noSession);

  const password = randomUUID();
  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === OWNER_EMAIL);
  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      password,
    });
    if (updateError) throw updateError;
    const { data: factors, error: factorsError } = await admin.auth.admin.mfa.listFactors({
      userId: existing.id,
    });
    if (factorsError) throw factorsError;
    for (const factor of factors.factors) {
      const { error } = await admin.auth.admin.mfa.deleteFactor({
        userId: existing.id,
        id: factor.id,
      });
      if (error) throw error;
    }
  } else {
    const { error: createError } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password,
      email_confirm: true,
    });
    if (createError) throw createError;
  }

  const owner = createClient(url, env('SUPABASE_ANON_KEY'), noSession);
  const { error: signInError } = await owner.auth.signInWithPassword({
    email: OWNER_EMAIL,
    password,
  });
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

/** Signs the owner in through the real UI (password, then TOTP) and waits for Home. */
export async function signIn(page: Page, owner: Owner): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Authentication code').fill(owner.totpCode());
  await page.getByRole('button', { name: 'Verify' }).click();
  await base.expect(page.getByRole('heading', { name: 'Medical Management' })).toBeVisible();
}

export const test = base.extend<{ owner: Owner }>({
  // eslint-disable-next-line no-empty-pattern
  owner: async ({}, provide) => {
    await provide(await createOwner());
  },
});

export { expect } from '@playwright/test';
