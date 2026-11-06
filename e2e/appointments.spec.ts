import { randomUUID } from 'node:crypto';
import { expect, signIn, test } from './fixtures';

test('an Appointment can be created, duplicated and the copy cancelled', async ({
  page,
  owner,
}) => {
  const title = `Physiotherapy ${randomUUID().slice(0, 8)}`;
  await signIn(page, owner);

  await page.getByRole('link', { name: 'Appointments' }).click();
  await page.getByRole('link', { name: 'Add Appointment' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Start', { exact: true }).fill('2030-03-12T10:00');
  await page.getByLabel('End', { exact: true }).fill('2030-03-12T10:45');
  await page.getByLabel('Provider').fill('Clinic A');
  await page.getByRole('button', { name: 'Save' }).click();

  const upcoming = page.getByRole('list', { name: 'Upcoming' });
  await expect(upcoming.getByRole('listitem', { name: title })).toHaveCount(1);
  await expect(upcoming.getByRole('listitem', { name: title })).toContainText('Scheduled');

  await upcoming.getByRole('link', { name: title }).click();
  await expect(page.getByLabel('New start')).toHaveValue('2030-03-19T10:00');
  await page.getByRole('button', { name: 'Duplicate' }).click();

  await expect(page.getByLabel('Start', { exact: true })).toHaveValue('2030-03-19T10:00');
  await expect(page.getByLabel('Provider')).toHaveValue('Clinic A');
  await page.getByRole('button', { name: 'Cancel Appointment' }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Appointments', exact: true }).click();
  await expect(upcoming.getByRole('listitem', { name: title })).toHaveCount(1);
  await expect(
    page.getByRole('list', { name: 'Past and cancelled' }).getByRole('listitem', { name: title }),
  ).toContainText('Cancelled');
});
