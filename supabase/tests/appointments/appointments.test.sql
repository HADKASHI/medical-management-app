-- Appointments: create, edit, invite_uid, duplicate, owner-only.
begin;
select plan(13);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');

-- the owner can create an Appointment with every field
select lives_ok(
  $$ insert into public.appointments (
       title, starts_at, ends_at, provider, location, notes,
       buffer_before_minutes, buffer_after_minutes, send_to_work_calendar)
     values (
       'Physiotherapy', '2026-03-12 10:00+02', '2026-03-12 10:45+02', 'Clinic A',
       'Example Street 1', 'Bring the referral', 20, 30, false) $$,
  'the owner can create an Appointment'
);

select throws_ok(
  $$ insert into public.appointments (title, starts_at, ends_at)
     values ('Physiotherapy', '2026-03-12 10:00+02', '2026-03-12 09:00+02') $$,
  '23514',
  null,
  'an Appointment cannot end before it starts'
);

-- invite_uid is set once on creation and never changes
select set_config('test.appointment', (select id::text from public.appointments), true);
select set_config('test.invite_uid', (select invite_uid from public.appointments), true);

select ok(
  current_setting('test.invite_uid') <> '',
  'invite_uid is set on creation'
);

select isnt(
  (select invite_uid from public.appointments where id = tests.make_appointment()),
  current_setting('test.invite_uid'),
  'each Appointment gets its own invite_uid'
);

insert into public.appointments (title, starts_at, ends_at, invite_uid)
values ('Blood test', '2026-03-13 08:00+02', '2026-03-13 08:15+02', 'chosen-by-client');

select isnt(
  (select invite_uid from public.appointments where title = 'Blood test'),
  'chosen-by-client',
  'a client cannot choose the invite_uid'
);

select results_eq(
  $$ update public.appointments
     set title = 'Physiotherapy session', starts_at = '2026-03-12 11:00+02',
         ends_at = '2026-03-12 11:45+02'
     where id = current_setting('test.appointment')::uuid
     returning title, invite_uid $$,
  $$ values ('Physiotherapy session'::text, current_setting('test.invite_uid')) $$,
  'editing an Appointment keeps its invite_uid'
);

select throws_ok(
  $$ update public.appointments set invite_uid = 'another-uid'
     where id = current_setting('test.appointment')::uuid $$,
  '22023',
  null,
  'invite_uid cannot be changed'
);

-- duplicating copies everything except times, Visit Summary, cancellation and invite_uid
update public.appointments
set visit_summary = 'Exercises for the knee', authorization_id = '00000000-0000-4000-8000-0000000000f1'
where id = current_setting('test.appointment')::uuid;
select public.cancel_appointment(current_setting('test.appointment')::uuid);

select set_config(
  'test.copy',
  (public.duplicate_appointment(
     current_setting('test.appointment')::uuid,
     starts_at => '2026-03-19 11:00+02',
     ends_at => '2026-03-19 11:45+02')).id::text,
  true
);

select results_eq(
  $$ select title, starts_at, ends_at, provider, location, notes, visit_summary,
            authorization_id, buffer_before_minutes, buffer_after_minutes,
            send_to_work_calendar, cancelled_at, invite_sequence
     from public.appointments where id = current_setting('test.copy')::uuid $$,
  $$ values ('Physiotherapy session'::text, '2026-03-19 11:00+02'::timestamptz,
             '2026-03-19 11:45+02'::timestamptz, 'Clinic A'::text, 'Example Street 1'::text,
             'Bring the referral'::text, null::text,
             '00000000-0000-4000-8000-0000000000f1'::uuid, 20, 30, false,
             null::timestamptz, 0) $$,
  'duplicating copies everything except times, Visit Summary and cancellation'
);

select isnt(
  (select invite_uid from public.appointments where id = current_setting('test.copy')::uuid),
  current_setting('test.invite_uid'),
  'a duplicate gets its own invite_uid'
);

select throws_ok(
  $$ select public.duplicate_appointment(
       current_setting('test.appointment')::uuid,
       starts_at => '2026-03-19 11:00+02',
       ends_at => '2026-03-19 10:00+02') $$,
  '23514',
  null,
  'a duplicate cannot end before it starts'
);

-- owner-only + aal2
select tests.as_stranger();

select is_empty(
  $$ select id from public.appointments $$,
  'a stranger sees none of the owner''s Appointments'
);

select is_empty(
  $$ select id from public.cancel_appointment(current_setting('test.copy')::uuid)
     where id is not null $$,
  'a stranger cannot cancel the owner''s Appointment'
);

select tests.as_owner_aal1();

select is_empty(
  $$ select id from public.appointments $$,
  'the owner without TOTP (aal1) sees no Appointments'
);

select * from finish();
rollback;
