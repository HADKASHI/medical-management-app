-- Appointment status is derived: cancelled if cancelled_at is set, otherwise
-- done once ends_at has passed, otherwise scheduled.
begin;
select plan(6);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config(
  'test.appointment',
  tests.make_appointment(starts_at => '2026-03-12 10:00+02', ends_at => '2026-03-12 11:00+02')::text,
  true
);

select results_eq(
  $$ select a.status from public.appointments a where a.id = current_setting('test.appointment')::uuid $$,
  $$ values ('scheduled'::public.appointment_status) $$,
  'status is scheduled before ends_at'
);

select tests.at('2026-03-12 10:30+02');
select results_eq(
  $$ select a.status from public.appointments a where a.id = current_setting('test.appointment')::uuid $$,
  $$ values ('scheduled'::public.appointment_status) $$,
  'status is still scheduled while the Appointment is under way'
);

select tests.at('2026-03-12 11:00+02');
select results_eq(
  $$ select a.status from public.appointments a where a.id = current_setting('test.appointment')::uuid $$,
  $$ values ('done'::public.appointment_status) $$,
  'status is done once ends_at has passed'
);

select tests.at('2026-03-11 09:00+02');
select results_eq(
  $$ select a.cancelled_at, a.status
     from public.cancel_appointment(current_setting('test.appointment')::uuid) a $$,
  $$ values ('2026-03-11 09:00+02'::timestamptz, 'cancelled'::public.appointment_status) $$,
  'status is cancelled when cancelled_at is set, at now'
);

select tests.at('2026-03-13 09:00+02');
select results_eq(
  $$ select a.status from public.appointments a where a.id = current_setting('test.appointment')::uuid $$,
  $$ values ('cancelled'::public.appointment_status) $$,
  'a cancelled Appointment stays cancelled after ends_at'
);

select results_eq(
  $$ select a.cancelled_at
     from public.cancel_appointment(current_setting('test.appointment')::uuid) a $$,
  $$ values ('2026-03-11 09:00+02'::timestamptz) $$,
  'cancelling a cancelled Appointment keeps the first cancelled_at'
);

select * from finish();
rollback;
