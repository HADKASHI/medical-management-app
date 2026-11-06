-- An Appointment may use one of the owner's Authorizations (a Form 17 or a
-- Commitment, usually). Deleting that Authorization unlinks the Appointment.
begin;
select plan(5);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.auth', tests.make_authorization(type => 'form_17', reference_number => 'F17-2001')::text, true);
select set_config('test.appt', tests.make_appointment()::text, true);

select lives_ok(
  $$ update public.appointments set authorization_id = current_setting('test.auth')::uuid
     where id = current_setting('test.appt')::uuid $$,
  'an Appointment can use an Authorization'
);

select throws_ok(
  $$ update public.appointments set authorization_id = gen_random_uuid()
     where id = current_setting('test.appt')::uuid $$,
  '23503',
  null,
  'an Appointment cannot use an Authorization that does not exist'
);

delete from public.authorizations where id = current_setting('test.auth')::uuid;

select results_eq(
  $$ select authorization_id, owner_id from public.appointments
     where id = current_setting('test.appt')::uuid $$,
  $$ values (null::uuid, '00000000-0000-4000-8000-00000000000a'::uuid) $$,
  'deleting the Authorization unlinks the Appointment and keeps it'
);

-- a stranger's Appointment cannot use the owner's Authorization
select set_config('test.auth2', tests.make_authorization(type => 'commitment')::text, true);
select tests.as_stranger();
select set_config('test.stranger_appt', tests.make_appointment()::text, true);

select throws_ok(
  $$ update public.appointments set authorization_id = current_setting('test.auth2')::uuid
     where id = current_setting('test.stranger_appt')::uuid $$,
  '23503',
  null,
  'a stranger''s Appointment cannot use the owner''s Authorization'
);

select tests.as_owner();
select results_eq(
  $$ select count(*)::int from public.appointments where authorization_id is not null $$,
  $$ values (0) $$,
  'no Appointment of the owner is linked after the stranger''s attempt'
);

select * from finish();
rollback;
