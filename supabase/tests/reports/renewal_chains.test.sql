-- Reports, Renewals tab: the chain query returns each current Authorization
-- (archived ones included) followed by its predecessors, newest to oldest,
-- with the Restocks filled under each.
begin;
select plan(4);

select tests.as_owner();
select tests.at('2026-01-10 12:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item(name => 'Medication A')::text, true);
select set_config('test.first',
  tests.make_authorization(reference_number => 'RX-1001',
    stock_item => current_setting('test.item')::uuid, expires_on => '2026-02-01')::text, true);
select set_config('test.second',
  tests.make_authorization(reference_number => 'RX-1002',
    stock_item => current_setting('test.item')::uuid, expires_on => '2026-05-01',
    renews => current_setting('test.first')::uuid)::text, true);
select set_config('test.third',
  tests.make_authorization(reference_number => 'RX-1003',
    stock_item => current_setting('test.item')::uuid, expires_on => '2026-08-01',
    renews => current_setting('test.second')::uuid)::text, true);
-- A Form 17 with no Stock Item, archived: still a current Authorization.
select set_config('test.form',
  tests.make_authorization(type => 'form_17', reference_number => 'F17-2001',
    expires_on => '2026-03-01')::text, true);
select public.archive_authorization(current_setting('test.form')::uuid);

select public.record_restock(current_setting('test.item')::uuid, quantity => 30,
  restocked_on => '2026-01-05', authorization_id => current_setting('test.first')::uuid);
select public.record_restock(current_setting('test.item')::uuid, quantity => 30,
  restocked_on => '2026-02-03', authorization_id => current_setting('test.second')::uuid);
select public.record_restock(current_setting('test.item')::uuid, quantity => 60,
  restocked_on => '2026-03-04', authorization_id => current_setting('test.second')::uuid);
-- Not filled under an Authorization: not in reports.
select public.record_restock(current_setting('test.item')::uuid, quantity => 10,
  restocked_on => '2026-03-05');

select results_eq(
  $$ select current_id::text, depth, reference_number, renewed
     from public.renewal_chains()
     where current_id = current_setting('test.third')::uuid
     order by depth $$,
  $$ values (current_setting('test.third'), 0, 'RX-1003', false),
            (current_setting('test.third'), 1, 'RX-1002', true),
            (current_setting('test.third'), 2, 'RX-1001', true) $$,
  'renewal_chains: a current Authorization, then its predecessors newest to oldest'
);

select results_eq(
  $$ select reference_number, archived_at is not null, depth
     from public.renewal_chains()
     where depth = 0
     order by reference_number $$,
  $$ values ('F17-2001', true, 0), ('RX-1003', false, 0) $$,
  'renewal_chains: one chain per current Authorization, archived ones included'
);

select results_eq(
  $$ select reference_number,
            (select array_agg(r ->> 'restocked_on' || ' ' || (r ->> 'quantity') || ' ' || (r ->> 'unit'))
             from jsonb_array_elements(restocks) r)
     from public.renewal_chains()
     where current_id = current_setting('test.third')::uuid
     order by depth $$,
  $$ values ('RX-1003', null::text[]),
            ('RX-1002', array['2026-03-04 60 pill', '2026-02-03 30 pill']),
            ('RX-1001', array['2026-01-05 30 pill']) $$,
  'renewal_chains: each Authorization carries the Restocks filled under it, newest first'
);

select tests.as_stranger();
select is_empty(
  $$ select 1 from public.renewal_chains() $$,
  'renewal_chains: a stranger sees no Authorizations'
);

select * from finish();
rollback;
