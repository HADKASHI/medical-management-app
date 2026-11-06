-- Domain events are written only through their RPCs: the owner's own session
-- can't write Doses, Restocks, Stock Counts, Dose Schedules or Dose Times
-- directly, nor the guarded columns (a Stock Item's quantity and archived_at,
-- an Authorization's archived_at, an Appointment's cancelled_at and
-- invite_sequence). Each RPC works for the owner with aal2 and fails for a
-- stranger and for the owner with only aal1.
begin;
select plan(57);

select tests.as_owner();
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item(quantity => 10)::text, true);
select set_config('test.as_needed', tests.make_stock_item(name => 'Medication B')::text, true);
select tests.make_schedule(current_setting('test.as_needed')::uuid, times => '{}', pattern => 'as_needed');
select set_config('test.schedule', tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00}')::text, true);
select tests.tick_at('2026-01-05 08:00 Asia/Jerusalem');
select set_config('test.dose', (select id::text from public.doses limit 1), true);
select set_config('test.dose_time', (select id::text from public.dose_times limit 1), true);
select public.record_restock(stock_item_id => current_setting('test.item')::uuid, quantity => 5);
select public.record_stock_count(stock_item_id => current_setting('test.item')::uuid, counted_quantity => 15);
select set_config('test.auth', tests.make_authorization()::text, true);
select set_config('test.appt', tests.make_appointment()::text, true);

-- the owner can't write the event tables directly
select throws_ok(
  $$ insert into public.doses (stock_item_id, amount, status)
     values (current_setting('test.item')::uuid, 1, 'taken') $$,
  '42501', null, 'the owner cannot insert a Dose directly');
select throws_ok(
  $$ update public.doses set status = 'taken' $$,
  '42501', null, 'the owner cannot update a Dose directly');
select throws_ok(
  $$ delete from public.doses $$,
  '42501', null, 'the owner cannot delete a Dose directly');
select throws_ok(
  $$ insert into public.restocks (stock_item_id, quantity, restocked_on)
     values (current_setting('test.item')::uuid, 30, '2026-01-05') $$,
  '42501', null, 'the owner cannot insert a Restock directly');
select throws_ok(
  $$ update public.restocks set quantity = 300 $$,
  '42501', null, 'the owner cannot update a Restock directly');
select throws_ok(
  $$ delete from public.restocks $$,
  '42501', null, 'the owner cannot delete a Restock directly');
select throws_ok(
  $$ insert into public.stock_counts (stock_item_id, counted_quantity, previous_quantity)
     values (current_setting('test.item')::uuid, 30, 0) $$,
  '42501', null, 'the owner cannot insert a Stock Count directly');
select throws_ok(
  $$ update public.stock_counts set counted_quantity = 300 $$,
  '42501', null, 'the owner cannot update a Stock Count directly');
select throws_ok(
  $$ delete from public.stock_counts $$,
  '42501', null, 'the owner cannot delete a Stock Count directly');
select throws_ok(
  $$ insert into public.dose_schedules (stock_item_id, pattern, effective_from)
     values (current_setting('test.as_needed')::uuid, 'as_needed', '2026-01-10') $$,
  '42501', null, 'the owner cannot insert a Dose Schedule directly');
select throws_ok(
  $$ update public.dose_schedules set effective_from = '2025-01-01' $$,
  '42501', null, 'the owner cannot update a Dose Schedule directly');
select throws_ok(
  $$ delete from public.dose_schedules $$,
  '42501', null, 'the owner cannot delete a Dose Schedule directly');
select throws_ok(
  $$ insert into public.dose_times (dose_schedule_id, time_of_day, amount)
     values (current_setting('test.schedule')::uuid, '09:00', 1) $$,
  '42501', null, 'the owner cannot insert a Dose Time directly');
select throws_ok(
  $$ update public.dose_times set amount = 5 $$,
  '42501', null, 'the owner cannot update a Dose Time directly');
select throws_ok(
  $$ delete from public.dose_times $$,
  '42501', null, 'the owner cannot delete a Dose Time directly');

-- the owner can't write the guarded columns directly
select throws_ok(
  $$ update public.stock_items set quantity = 100 $$,
  '42501', null, 'the owner cannot set a Stock Item''s quantity directly');
select throws_ok(
  $$ update public.stock_items set archived_at = app.now() $$,
  '42501', null, 'the owner cannot set a Stock Item''s archived_at directly');
select throws_ok(
  $$ insert into public.stock_items (name, kind, unit, archived_at)
     values ('Supply A', 'supply', 'strip', app.now()) $$,
  '42501', null, 'the owner cannot create an already Archived Stock Item');
select lives_ok(
  $$ insert into public.stock_items (name, kind, unit, quantity, low_stock_threshold, pack_size)
     values ('Supply A', 'supply', 'strip', 50, 10, 25) $$,
  'the owner can still create a Stock Item with its initial quantity');
select throws_ok(
  $$ update public.authorizations set archived_at = app.now() $$,
  '42501', null, 'the owner cannot set an Authorization''s archived_at directly');
select throws_ok(
  $$ update public.appointments set cancelled_at = app.now() $$,
  '42501', null, 'the owner cannot set an Appointment''s cancelled_at directly');
select throws_ok(
  $$ update public.appointments set invite_sequence = 5 $$,
  '42501', null, 'the owner cannot set an Appointment''s invite_sequence directly');
select throws_ok(
  $$ insert into public.appointments (title, starts_at, ends_at, cancelled_at)
     values ('Physiotherapy', '2026-03-12 10:00+02', '2026-03-12 11:00+02', app.now()) $$,
  '42501', null, 'the owner cannot create an already cancelled Appointment');

-- each RPC fails for a stranger (as if the row didn't exist) ...
select tests.as_stranger();
select throws_ok(
  $$ select public.record_restock(stock_item_id => current_setting('test.item')::uuid, quantity => 1) $$,
  'P0002', null, 'a stranger cannot record a Restock');
select throws_ok(
  $$ select public.record_stock_count(stock_item_id => current_setting('test.item')::uuid, counted_quantity => 1) $$,
  'P0002', null, 'a stranger cannot record a Stock Count');
select throws_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid) $$,
  'P0002', null, 'a stranger cannot save a Dose Schedule');
select throws_ok(
  $$ select public.set_dose_status(current_setting('test.dose')::uuid, 'taken') $$,
  'P0002', null, 'a stranger cannot confirm a Dose');
select throws_ok(
  $$ select public.take_doses(array[current_setting('test.dose')::uuid]) $$,
  'P0002', null, 'a stranger cannot take a Dose with All taken');
select throws_ok(
  $$ select public.log_as_needed_dose(current_setting('test.as_needed')::uuid, 1) $$,
  'P0002', null, 'a stranger cannot log an As Needed Dose');
select throws_ok(
  $$ select public.archive_stock_item(current_setting('test.item')::uuid) $$,
  'P0002', null, 'a stranger cannot archive a Stock Item');
select throws_ok(
  $$ select public.archive_authorization(current_setting('test.auth')::uuid) $$,
  'P0002', null, 'a stranger cannot archive an Authorization');
select throws_ok(
  $$ select public.cancel_appointment(current_setting('test.appt')::uuid) $$,
  'P0002', null, 'a stranger cannot cancel an Appointment');
select throws_ok(
  $$ select public.duplicate_appointment(current_setting('test.appt')::uuid,
       '2026-03-19 11:00+02', '2026-03-19 12:00+02') $$,
  'P0002', null, 'a stranger cannot duplicate an Appointment');

-- ... and for the owner with only aal1
select tests.as_owner_aal1();
select throws_ok(
  $$ select public.record_restock(stock_item_id => current_setting('test.item')::uuid, quantity => 1) $$,
  '42501', null, 'the owner with only aal1 cannot record a Restock');
select throws_ok(
  $$ select public.record_stock_count(stock_item_id => current_setting('test.item')::uuid, counted_quantity => 1) $$,
  '42501', null, 'the owner with only aal1 cannot record a Stock Count');
select throws_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid) $$,
  '42501', null, 'the owner with only aal1 cannot save a Dose Schedule');
select throws_ok(
  $$ select public.set_dose_status(current_setting('test.dose')::uuid, 'taken') $$,
  '42501', null, 'the owner with only aal1 cannot confirm a Dose');
select throws_ok(
  $$ select public.take_doses(array[current_setting('test.dose')::uuid]) $$,
  '42501', null, 'the owner with only aal1 cannot take a Dose with All taken');
select throws_ok(
  $$ select public.log_as_needed_dose(current_setting('test.as_needed')::uuid, 1) $$,
  '42501', null, 'the owner with only aal1 cannot log an As Needed Dose');
select throws_ok(
  $$ select public.archive_stock_item(current_setting('test.item')::uuid) $$,
  '42501', null, 'the owner with only aal1 cannot archive a Stock Item');
select throws_ok(
  $$ select public.archive_authorization(current_setting('test.auth')::uuid) $$,
  '42501', null, 'the owner with only aal1 cannot archive an Authorization');
select throws_ok(
  $$ select public.cancel_appointment(current_setting('test.appt')::uuid) $$,
  '42501', null, 'the owner with only aal1 cannot cancel an Appointment');
select throws_ok(
  $$ select public.duplicate_appointment(current_setting('test.appt')::uuid,
       '2026-03-19 11:00+02', '2026-03-19 12:00+02') $$,
  '42501', null, 'the owner with only aal1 cannot duplicate an Appointment');

-- each RPC still works for the owner with aal2
select tests.as_owner();
select tests.at('2026-01-05 08:05 Asia/Jerusalem');
select lives_ok(
  $$ select public.record_restock(stock_item_id => current_setting('test.item')::uuid, quantity => 1) $$,
  'the owner can record a Restock');
select lives_ok(
  $$ select public.record_stock_count(stock_item_id => current_setting('test.item')::uuid, counted_quantity => 20) $$,
  'the owner can record a Stock Count');
select lives_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00,20:00}') $$,
  'the owner can save a Dose Schedule');
select results_eq(
  $$ select status::text from public.take_doses(array[current_setting('test.dose')::uuid]) $$,
  $$ values ('taken') $$,
  'the owner can take a Dose with All taken'
);
select lives_ok(
  $$ select public.set_dose_status(current_setting('test.dose')::uuid, 'pending') $$,
  'the owner can confirm a Dose');
select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (20::numeric) $$,
  'the owner''s RPCs keep quantity in step'
);
select lives_ok(
  $$ select public.log_as_needed_dose(current_setting('test.as_needed')::uuid, 1) $$,
  'the owner can log an As Needed Dose');
select results_eq(
  $$ select archived_at from public.archive_stock_item(current_setting('test.item')::uuid) $$,
  $$ values ('2026-01-05 08:05+02'::timestamptz) $$,
  'the owner can archive a Stock Item');
select results_eq(
  $$ select archived_at from public.archive_authorization(current_setting('test.auth')::uuid) $$,
  $$ values ('2026-01-05 08:05+02'::timestamptz) $$,
  'the owner can archive an Authorization');
select results_eq(
  $$ select cancelled_at from public.cancel_appointment(current_setting('test.appt')::uuid) $$,
  $$ values ('2026-01-05 08:05+02'::timestamptz) $$,
  'the owner can cancel an Appointment');
select results_eq(
  $$ select owner_id, starts_at from public.duplicate_appointment(current_setting('test.appt')::uuid,
       '2026-03-19 11:00+02', '2026-03-19 12:00+02') $$,
  $$ values ('00000000-0000-4000-8000-00000000000a'::uuid, '2026-03-19 11:00+02'::timestamptz) $$,
  'the owner can duplicate an Appointment');
select results_eq(
  $$ select count(*)::int from public.restocks $$,
  $$ values (2) $$,
  'the owner still reads the rows the RPCs wrote'
);

-- the owner can still edit the unguarded columns directly
select lives_ok(
  $$ update public.stock_items set name = 'Medication C', low_stock_threshold = 3
     where id = current_setting('test.item')::uuid $$,
  'the owner can still edit a Stock Item''s other fields');
select lives_ok(
  $$ update public.appointments set notes = 'Bring the referral'
     where id = current_setting('test.appt')::uuid $$,
  'the owner can still edit an Appointment''s other fields');

select * from finish();
rollback;
