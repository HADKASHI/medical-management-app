-- References between owned rows are composite (owner_id, id) foreign keys:
-- a Dose, Restock, Stock Count, Dose Schedule or Dose Time can only point at
-- a row of the same owner, whatever path writes it.
begin;
select plan(6);

select tests.as_owner();
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item()::text, true);
select set_config('test.schedule', tests.make_schedule(current_setting('test.item')::uuid)::text, true);

-- written as the database owner, past RLS and grants: only the keys stop it
reset role;
select set_config('test.stranger', '00000000-0000-4000-8000-00000000000b', true);
insert into auth.users (id, email, aud, role)
values (current_setting('test.stranger')::uuid, 'stranger@example.com', 'authenticated', 'authenticated')
on conflict (id) do nothing;

select throws_ok(
  $$ insert into public.doses (owner_id, stock_item_id, amount, status)
     values (current_setting('test.stranger')::uuid, current_setting('test.item')::uuid, 1, 'taken') $$,
  '23503', null, 'a Dose cannot reference another owner''s Stock Item');
select throws_ok(
  $$ insert into public.restocks (owner_id, stock_item_id, quantity, restocked_on)
     values (current_setting('test.stranger')::uuid, current_setting('test.item')::uuid, 30, '2026-01-05') $$,
  '23503', null, 'a Restock cannot reference another owner''s Stock Item');
select throws_ok(
  $$ insert into public.stock_counts (owner_id, stock_item_id, counted_quantity, previous_quantity)
     values (current_setting('test.stranger')::uuid, current_setting('test.item')::uuid, 30, 0) $$,
  '23503', null, 'a Stock Count cannot reference another owner''s Stock Item');
select throws_ok(
  $$ insert into public.dose_schedules (owner_id, stock_item_id, pattern, effective_from, effective_to)
     values (current_setting('test.stranger')::uuid, current_setting('test.item')::uuid, 'as_needed', '2026-01-10', '2026-01-11') $$,
  '23503', null, 'a Dose Schedule cannot reference another owner''s Stock Item');
select throws_ok(
  $$ insert into public.dose_times (owner_id, dose_schedule_id, time_of_day, amount)
     values (current_setting('test.stranger')::uuid, current_setting('test.schedule')::uuid, '09:00', 1) $$,
  '23503', null, 'a Dose Time cannot reference another owner''s Dose Schedule');

-- a Dose of the stranger's own Stock Item, under the owner's Dose Schedule
insert into public.stock_items (owner_id, name, kind, unit)
values (current_setting('test.stranger')::uuid, 'Medication S', 'medication', 'pill');
select set_config('test.stranger_item',
  (select id::text from public.stock_items where name = 'Medication S'), true);

select throws_ok(
  $$ insert into public.doses (owner_id, stock_item_id, dose_schedule_id, due_at, amount)
     values (current_setting('test.stranger')::uuid, current_setting('test.stranger_item')::uuid,
             current_setting('test.schedule')::uuid, '2026-01-06 08:00+02', 1) $$,
  '23503', null, 'a Dose cannot reference another owner''s Dose Schedule');

select * from finish();
rollback;
