import { randomUUID } from 'node:crypto';
import { expect, signIn, test } from './fixtures';

test('a Restock in packs raises the shown stock', async ({ page, owner }) => {
  const name = `Medication ${randomUUID().slice(0, 8)}`;
  await signIn(page, owner);

  await page.goto('/stock/new');
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Unit').fill('pill');
  await page.getByLabel('Quantity').fill('4');
  await page.getByLabel('Pack Size').fill('30');
  await page.getByRole('button', { name: 'Save' }).click();

  const row = page.getByRole('listitem', { name });
  await expect(row.getByText('4 pill')).toBeVisible();
  await row.getByRole('link', { name }).click();

  await page.getByLabel('Packs').check();
  await page.getByLabel('Number of packs').fill('2');
  await page.getByRole('button', { name: 'Restock' }).click();
  await expect(page.getByRole('status')).toHaveText('Restock saved.');
  await expect(page.getByText('In stock: 64 pill')).toBeVisible();

  await page.getByRole('link', { name: 'Stock', exact: true }).click();
  await expect(page.getByRole('listitem', { name }).getByText('64 pill')).toBeVisible();
});
