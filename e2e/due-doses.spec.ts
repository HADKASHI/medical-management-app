import { randomUUID } from 'node:crypto';
import { expect, signIn, test, withDatabase } from './fixtures';

/**
 * A medication with 10 pills and a daily Dose Time at the current minute
 * (Asia/Jerusalem), saved a minute ago; then one app.tick() makes that Dose due.
 */
async function makeDoseDueNow(ownerEmail: string, name: string): Promise<void> {
  await withDatabase(async (sql) => {
    await sql`
      with owner as (
        select id from auth.users where email = ${ownerEmail}
      ), item as (
        insert into public.stock_items (owner_id, name, kind, unit, quantity)
        select id, ${name}, 'medication', 'pill', 10 from owner
        returning id, owner_id
      ), schedule as (
        insert into public.dose_schedules (owner_id, stock_item_id, pattern, effective_from, created_at)
        select owner_id, id, 'daily', (now() at time zone app.time_zone())::date, now() - interval '1 minute'
        from item
        returning id, owner_id
      )
      insert into public.dose_times (owner_id, dose_schedule_id, time_of_day, amount)
      select owner_id, id, date_trunc('minute', now() at time zone app.time_zone())::time, 1
      from schedule
    `;
    await sql`select app.tick()`;
  });
}

test('a Dose made due by app.tick() is taken from Due Doses, and stock goes down', async ({
  page,
  owner,
}) => {
  const name = `Medication ${randomUUID().slice(0, 8)}`;
  await makeDoseDueNow(owner.email, name);
  await signIn(page, owner);

  await page.getByRole('link', { name: 'Due Doses' }).click();
  const row = page.getByRole('listitem', { name });
  await expect(row.getByText('1 pill')).toBeVisible();
  await row.getByRole('button', { name: 'Taken' }).click();
  await expect(page.getByRole('status')).toHaveText(`${name} taken.`);
  await expect(row).toHaveCount(0);

  await page.goto('/stock');
  await expect(page.getByRole('listitem', { name }).getByText('9 pill')).toBeVisible();
});
