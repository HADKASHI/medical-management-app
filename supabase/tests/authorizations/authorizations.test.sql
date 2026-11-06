-- Authorizations: a prescription, Form 17 or Commitment with an expiry date.
-- Renewal inserts a new Authorization pointing at the old one, which is then
-- renewed (derived through the `renewed` computed field). Archiving keeps the
-- row.
begin;
select plan(13);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.item', tests.make_stock_item()::text, true);

select lives_ok(
  $$ insert into public.authorizations
       (type, reference_number, covers, stock_item_id, issued_on, expires_on)
     values ('prescription', 'RX-1001', 'Medication A, 3 months',
             current_setting('test.item')::uuid, '2026-01-01', '2026-04-01') $$,
  'the owner creates an Authorization for a Stock Item'
);
select set_config(
  'test.old',
  (select id from public.authorizations where reference_number = 'RX-1001')::text,
  true
);

-- reference_number may repeat across rows
select lives_ok(
  $$ insert into public.authorizations (type, reference_number, covers, expires_on)
     values ('prescription', 'RX-1001', 'Medication B, 3 months', '2026-04-01') $$,
  'reference_number may repeat across rows'
);

select results_eq(
  $$ select a.renewed from public.authorizations a where a.id = current_setting('test.old')::uuid $$,
  $$ values (false) $$,
  'a new Authorization is not renewed'
);

-- renewing points the new Authorization at the old one, which is then renewed
select set_config('test.new', tests.make_authorization(
  renews => current_setting('test.old')::uuid, expires_on => '2026-07-01')::text, true);

select results_eq(
  $$ select renews_authorization_id from public.authorizations
     where id = current_setting('test.new')::uuid $$,
  $$ values (current_setting('test.old')::uuid) $$,
  'renewing points the new Authorization at the old one'
);

select results_eq(
  $$ select a.id, a.renewed from public.authorizations a
     where a.id in (current_setting('test.old')::uuid, current_setting('test.new')::uuid)
     order by a.expires_on $$,
  $$ values (current_setting('test.old')::uuid, true), (current_setting('test.new')::uuid, false) $$,
  'the old Authorization is then renewed; the new one is not'
);

-- an Authorization can be renewed only once
select throws_ok(
  $$ select tests.make_authorization(renews => current_setting('test.old')::uuid) $$,
  '23505',
  null,
  'an Authorization can be renewed only once'
);

-- archiving keeps the row and its first timestamp
select results_eq(
  $$ select archived_at from public.archive_authorization(current_setting('test.new')::uuid) $$,
  $$ values ('2026-03-10 09:00+02'::timestamptz) $$,
  'archiving an Authorization sets archived_at to now'
);

select tests.at('2026-03-11 09:00+02');
select results_eq(
  $$ select archived_at from public.archive_authorization(current_setting('test.new')::uuid) $$,
  $$ values ('2026-03-10 09:00+02'::timestamptz) $$,
  'archiving an Archived Authorization keeps the first timestamp'
);

select throws_ok(
  $$ insert into public.authorizations (type, reference_number, covers, issued_on, expires_on)
     values ('form_17', 'F17-1', 'Physio at Clinic B', '2026-05-01', '2026-04-01') $$,
  '23514',
  null,
  'an Authorization cannot expire before it was issued'
);

-- owner-only + aal2 on the new table
select tests.as_stranger();

select is_empty(
  $$ select id from public.authorizations $$,
  'a stranger reads none of the owner''s Authorizations'
);

select throws_ok(
  $$ select tests.make_authorization(renews => current_setting('test.new')::uuid) $$,
  '23503',
  null,
  'a stranger cannot renew the owner''s Authorization'
);

select tests.as_owner_aal1();

select is_empty(
  $$ select id from public.authorizations $$,
  'the owner with only aal1 reads no Authorizations'
);

select throws_ok(
  $$ select tests.make_authorization() $$,
  '42501',
  null,
  'the owner with only aal1 cannot create an Authorization'
);

select * from finish();
rollback;
