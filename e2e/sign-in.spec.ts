import { expect, test } from './fixtures';

test('sign in: password, then TOTP code, lands on Home', async ({ page, owner }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password').fill(owner.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByLabel('Authentication code').fill(owner.totpCode());
  await page.getByRole('button', { name: 'Verify' }).click();

  await expect(page.getByRole('heading', { name: 'Medical Management' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});
