import { randomUUID } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import { expect, signIn, test, withDatabase } from './fixtures';

test('an expiring Authorization is in the Alerts list until the lead times exclude it', async ({
  page,
  owner,
}) => {
  const reference = `RX-${randomUUID().slice(0, 8)}`;
  await withDatabase(
    (sql) => sql`
      insert into public.authorizations (owner_id, type, reference_number, covers, expires_on)
      select id, 'prescription', ${reference}, 'Medication A, 3 months',
             (now() at time zone 'Asia/Jerusalem')::date + 5
      from auth.users where email = ${owner.email}`,
  );
  try {
    await signIn(page, owner);

    await page.goto('/alerts');
    const alert = page
      .getByRole('list', { name: 'Alerts' })
      .getByRole('link', { name: `Prescription ${reference}: expires in 5 days` });
    await expect(alert).toBeVisible();

    await page.goto('/settings');
    await page.getByLabel('First notice (days before expiry)').fill('3');
    await page.getByLabel('Second notice (days before expiry)').fill('1');
    await page.getByRole('button', { name: 'Save lead times' }).click();
    await expect(page.getByRole('status')).toHaveText('Lead times saved.');

    await page.goto('/alerts');
    await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
    await expect(page.getByText('Loading…')).toHaveCount(0);
    await expect(page.getByText(reference)).toHaveCount(0);
  } finally {
    await withDatabase(async (sql) => {
      await sql`delete from public.settings`;
      await sql`update public.authorizations set archived_at = now()
                where reference_number = ${reference}`;
    });
  }
});

test('the owner adds a backup authenticator in Settings', async ({ page, owner }) => {
  await signIn(page, owner);
  await page.goto('/settings');

  await page.getByRole('button', { name: 'Add backup authenticator' }).click();
  await expect(page.getByAltText('Backup authenticator QR code')).toBeVisible();
  const secret = (await page.locator('p.font-mono').textContent())!.trim();
  const backup = new TOTP({ secret: Secret.fromBase32(secret) });

  await page.getByLabel('Authentication code').fill(backup.generate());
  await page.getByRole('button', { name: 'Verify backup' }).click();
  await expect(page.getByText('Main and backup authenticators are set up.')).toBeVisible();
});
