import { randomUUID } from 'node:crypto';
import { expect, signIn, test } from './fixtures';

test('a Restock in packs raises the shown stock and clears a Low Stock Alert', async ({
  page,
  owner,
}) => {
  const name = `Medication ${randomUUID().slice(0, 8)}`;
  await signIn(page, owner);

  await page.goto('/stock/new');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Unit').fill('pill');
  await page.getByLabel('Quantity').fill('4');
  await page.getByLabel('Low-Stock Threshold').fill('10');
  await page.getByLabel('Pack Size').fill('30');
  await page.getByRole('button', { name: 'Save' }).click();

  const row = page.getByRole('listitem', { name });
  await expect(row.getByText('4 pill')).toBeVisible();

  await page.getByRole('link', { name: 'Home' }).click();
  await page.getByRole('link', { name: 'Alerts' }).click();
  const alert = page.getByRole('list', { name: 'Alerts' }).getByRole('link', {
    name: `${name}: 4 pill left`,
  });
  await expect(alert).toBeVisible();
  await alert.click();

  await page.getByLabel('Packs').check();
  await page.getByLabel('Number of packs').fill('2');
  await page.getByRole('button', { name: 'Restock' }).click();
  await expect(page.getByRole('status')).toHaveText('Restock saved.');
  await expect(page.getByText('In stock: 64 pill')).toBeVisible();

  await page.getByRole('link', { name: 'Stock', exact: true }).click();
  await expect(page.getByRole('listitem', { name }).getByText('64 pill')).toBeVisible();

  await page.goto('/alerts');
  await expect(page.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
  await expect(page.getByText(name)).toHaveCount(0);
});
