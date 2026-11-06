-- set_dose_status() allows only pending -> taken | skipped, skipped -> taken,
-- missed -> taken (a late fix) and taken -> pending (undo of a just-taken
-- Dose). A skipped or missed Dose is never reopened, and taken can't become
-- skipped. log_as_needed_dose() needs a current As Needed schedule and an
-- unarchived Stock Item.
begin;
select plan(12);

select tests.as_owner();
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item(quantity => 10)::text, true);
select tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00,12:00,20:00}');
select tests.tick_at('2026-01-05 20:00 Asia/Jerusalem');
-- 08:00 and 12:00 are missed by now; 20:00 is pending
select set_config('test.missed',
  (select id from public.doses where due_at = '2026-01-05 08:00+02')::text, true);
select set_config('test.skipped',
  (select id from public.doses where due_at = '2026-01-05 12:00+02')::text, true);
select set_config('test.pending',
  (select id from public.doses where due_at = '2026-01-05 20:00+02')::text, true);

select throws_ok(
  $$ select public.set_dose_status(current_setting('test.missed')::uuid, 'pending') $$,
  '22023', null, 'a missed Dose cannot be reopened');
select throws_ok(
  $$ select public.set_dose_status(current_setting('test.missed')::uuid, 'skipped') $$,
  '22023', null, 'a missed Dose cannot be skipped');
select results_eq(
  $$ select status::text from public.set_dose_status(current_setting('test.missed')::uuid, 'taken') $$,
  $$ values ('taken') $$, 'a missed Dose can be fixed to taken');

-- a Dose skipped from pending (set up as the database owner: it is missed by now)
reset role;
update public.doses set status = 'skipped' where id = current_setting('test.skipped')::uuid;
select tests.as_owner();

select throws_ok(
  $$ select public.set_dose_status(current_setting('test.skipped')::uuid, 'pending') $$,
  '22023', null, 'a skipped Dose cannot be reopened');
select results_eq(
  $$ select status::text from public.set_dose_status(current_setting('test.skipped')::uuid, 'taken') $$,
  $$ values ('taken') $$, 'a skipped Dose can be changed to taken');

select throws_ok(
  $$ select public.set_dose_status(current_setting('test.pending')::uuid, 'missed') $$,
  '22023', null, 'only the Confirmation Window marks a Dose missed');
select results_eq(
  $$ select status::text from public.set_dose_status(current_setting('test.pending')::uuid, 'taken') $$,
  $$ values ('taken') $$, 'a pending Dose can be taken');
select throws_ok(
  $$ select public.set_dose_status(current_setting('test.pending')::uuid, 'skipped') $$,
  '22023', null, 'a taken Dose cannot be changed to skipped');
select results_eq(
  $$ select status::text from public.set_dose_status(current_setting('test.pending')::uuid, 'pending') $$,
  $$ values ('pending') $$, 'a taken Dose can be undone to pending');
select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (8::numeric) $$,
  'rejected changes leave quantity alone'
);

-- an As Needed Dose needs a current As Needed schedule and an active Stock Item
select throws_ok(
  $$ select public.log_as_needed_dose(current_setting('test.item')::uuid, 1) $$,
  '22023', null, 'an As Needed Dose is rejected when the current schedule is not As Needed');

select set_config('test.as_needed', tests.make_stock_item(name => 'Medication B')::text, true);
select tests.make_schedule(current_setting('test.as_needed')::uuid, times => '{}', pattern => 'as_needed');
select public.archive_stock_item(current_setting('test.as_needed')::uuid);
select throws_ok(
  $$ select public.log_as_needed_dose(current_setting('test.as_needed')::uuid, 1) $$,
  '22023', null, 'an As Needed Dose is rejected for an Archived Stock Item');

select * from finish();
rollback;
