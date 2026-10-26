-- Settings: one app-wide row per owner. Authorization lead times are three
-- whole days, strictly decreasing, from 365 down to 0; 30, 7 and 0 by default.
begin;
select plan(7);

select tests.as_owner();

select results_eq(
  $$ insert into public.settings default values returning authorization_lead_days $$,
  $$ values ('{30,7,0}'::smallint[]) $$,
  'lead times default to 30, 7 and 0 days'
);

select throws_ok(
  $$ insert into public.settings default values $$,
  '23505', null,
  'there is one settings row per owner'
);

select lives_ok(
  $$ update public.settings set authorization_lead_days = '{60,14,1}' $$,
  'the owner changes the lead times'
);

select throws_ok(
  $$ update public.settings set authorization_lead_days = '{7,30,0}' $$,
  '23514', null,
  'lead times must be strictly decreasing'
);

select throws_ok(
  $$ update public.settings set authorization_lead_days = '{30,7}' $$,
  '23514', null,
  'there are exactly three lead times'
);

select throws_ok(
  $$ update public.settings set authorization_lead_days = '{400,7,-1}' $$,
  '23514', null,
  'lead times are between 0 and 365 days'
);

select tests.as_stranger();

select is_empty(
  $$ select 1 from public.settings $$,
  'a stranger cannot read the owner''s settings'
);

select * from finish();
rollback;
