-- Authorization Alert: an Authorization neither renewed nor archived enters
-- the Alerts list at its first lead time (30, 7, 0 days before expires_on by
-- default), at its current tier, and stays as Expired after expires_on. The
-- list is derived, so renewal, archive and edits re-evaluate at once.
begin;
select plan(14);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.auth', tests.make_authorization(
  reference_number => 'RX-1001', expires_on => '2026-04-10')::text, true);

select is_empty(
  $$ select 1 from public.alerts where authorization_id is not null $$,
  'an Authorization 31 days from expiry is not listed'
);

select tests.at('2026-03-11 09:00+02');

select results_eq(
  $$ select kind, authorization_id, lead_days, message from public.alerts $$,
  $$ values ('authorization_expiring'::text, current_setting('test.auth')::uuid, 30,
             'Prescription RX-1001: expires in 30 days'::text) $$,
  'an Authorization 30 days from expiry enters the Alerts list'
);

select tests.at('2026-04-03 23:30+03');

select results_eq(
  $$ select lead_days, message from public.alerts $$,
  $$ values (7, 'Prescription RX-1001: expires in 7 days'::text) $$,
  'it moves to the 7-day tier on its day, in Asia/Jerusalem'
);

select tests.at('2026-04-10 08:00+03');

select results_eq(
  $$ select kind, lead_days, message from public.alerts $$,
  $$ values ('authorization_expiring'::text, 0, 'Prescription RX-1001: expires today'::text) $$,
  'on expires_on it is at the 0-day tier'
);

select tests.at('2026-04-11 00:30+03');

select results_eq(
  $$ select kind, lead_days, message from public.alerts $$,
  $$ values ('authorization_expired'::text, null::int, 'Prescription RX-1001: Expired'::text) $$,
  'after expires_on it shows as Expired'
);

select tests.at('2026-09-01 09:00+03');

select results_eq(
  $$ select kind from public.alerts $$,
  $$ values ('authorization_expired'::text) $$,
  'an unrenewed Authorization stays Expired'
);

-- Renewal: the old one leaves at once; the new one runs its own lead times.
select set_config('test.new', tests.make_authorization(
  reference_number => 'RX-1002', renews => current_setting('test.auth')::uuid,
  expires_on => '2026-12-01')::text, true);

select is_empty(
  $$ select 1 from public.alerts $$,
  'renewing removes it from the list at once'
);

-- Created late: inside a lead time it is listed at its current tier.
select set_config('test.late', tests.make_authorization(
  type => 'form_17', reference_number => 'F17-2001', expires_on => '2026-09-05')::text, true);

select results_eq(
  $$ select authorization_id, lead_days, message from public.alerts $$,
  $$ values (current_setting('test.late')::uuid, 7, 'Form 17 F17-2001: expires in 4 days'::text) $$,
  'an Authorization created inside a lead time is listed at its current tier'
);

select public.archive_authorization(current_setting('test.late')::uuid);

select is_empty(
  $$ select 1 from public.alerts $$,
  'archiving removes it from the list at once'
);

-- Edits: changing expires_on re-evaluates at once.
select set_config('test.edit', tests.make_authorization(
  type => 'commitment', reference_number => 'C-3001', expires_on => '2026-12-31')::text, true);

select is_empty(
  $$ select 1 from public.alerts $$,
  'an Authorization far from expiry is not listed'
);

update public.authorizations set expires_on = '2026-09-02'
where id = current_setting('test.edit')::uuid;

select results_eq(
  $$ select lead_days, message from public.alerts $$,
  $$ values (7, 'Commitment C-3001: expires tomorrow'::text) $$,
  'changing expires_on re-evaluates at once'
);

-- Lead times come from the app-wide settings row.
insert into public.settings (authorization_lead_days) values ('{14,3,0}');

select results_eq(
  $$ select lead_days from public.alerts $$,
  $$ values (3) $$,
  'the tiers follow the lead-time setting'
);

update public.authorizations set expires_on = '2026-09-20'
where id = current_setting('test.edit')::uuid;

select is_empty(
  $$ select 1 from public.alerts $$,
  'beyond the first configured lead time it is not listed'
);

update public.authorizations set expires_on = '2026-08-01'
where id = current_setting('test.edit')::uuid;
select tests.as_stranger();

select is_empty(
  $$ select 1 from public.alerts $$,
  'a stranger sees none of the owner''s Authorization Alerts'
);

select * from finish();
rollback;
