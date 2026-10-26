-- Test-only helpers. Runs first (sorted name) and is never a migration, so
-- production never has the `tests` schema; `supabase db reset` removes it.
-- Everything here is created outside a transaction so later test files see it.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Set the clock that app.now() reads, for the rest of the current transaction.
-- Every test file runs inside begin; ... rollback;, so the clock never leaks.
create or replace function tests.at(at timestamptz)
returns timestamptz
language sql
as $$
  select set_config('app.now', at::text, true)::timestamptz;
$$;

-- Act as a signed-in user for the rest of the current transaction: switch to
-- the `authenticated` role with `request.jwt.claims` for that user at the given
-- assurance level. Creates the user in auth.users on first use. Callable from
-- any role in a test because `reset role` returns to the session user first.
create or replace function tests.as_user(user_id uuid, email text, aal text)
returns void
language plpgsql
as $$
begin
  reset role;
  insert into auth.users (id, email, aud, role)
  values (user_id, email, 'authenticated', 'authenticated')
  on conflict (id) do nothing;
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'email', email, 'role', 'authenticated', 'aal', aal)::text,
    true
  );
  perform set_config('role', 'authenticated', true);
end;
$$;

-- The owner after password + TOTP (aal2): the only session that sees data.
create or replace function tests.as_owner()
returns void
language sql
as $$ select tests.as_user('00000000-0000-4000-8000-00000000000a', 'user@example.com', 'aal2') $$;

-- The owner after the password step only (aal1): may only enrol or verify a factor.
create or replace function tests.as_owner_aal1()
returns void
language sql
as $$ select tests.as_user('00000000-0000-4000-8000-00000000000a', 'user@example.com', 'aal1') $$;

-- Another signed-in user with full aal2. Sign-up is off, so this models a
-- leaked account or a misconfiguration.
create or replace function tests.as_stranger()
returns void
language sql
as $$ select tests.as_user('00000000-0000-4000-8000-00000000000b', 'stranger@example.com', 'aal2') $$;

-- Builders: insert a valid row as the current role, taking only what the test
-- cares about, and return its id. plpgsql so they bind late to the schema.

create or replace function tests.make_stock_item(
  name text default 'Medication A',
  kind public.stock_item_kind default 'medication',
  quantity numeric default 30
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.stock_items (name, kind, unit, quantity, low_stock_threshold)
  values (make_stock_item.name, make_stock_item.kind, 'pill', make_stock_item.quantity, 0)
  returning id into new_id;
  return new_id;
end;
$$;

-- An Authorization; `renews` makes it the Renewal of that one.
create or replace function tests.make_authorization(
  type public.authorization_type default 'prescription',
  reference_number text default 'RX-1001',
  stock_item uuid default null,
  expires_on date default '2026-06-01',
  renews uuid default null
)
returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.authorizations
    (type, reference_number, covers, stock_item_id, expires_on, renews_authorization_id)
  values (
    make_authorization.type, make_authorization.reference_number, 'Medication A, 3 months',
    make_authorization.stock_item, make_authorization.expires_on, make_authorization.renews
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- A Dose Schedule version through save_dose_schedule(), one Unit at each time.
create or replace function tests.make_schedule(
  stock_item uuid,
  times text[] default '{08:00}',
  pattern public.dose_schedule_pattern default 'daily',
  weekdays smallint[] default null,
  interval_days int default null,
  effective_from date default null
)
returns uuid
language plpgsql
as $$
begin
  return (
    public.save_dose_schedule(
      stock_item_id => stock_item,
      pattern => make_schedule.pattern,
      times => coalesce(
        (select jsonb_agg(jsonb_build_object('time_of_day', t, 'amount', 1))
         from unnest(make_schedule.times) t),
        '[]'::jsonb
      ),
      weekdays => make_schedule.weekdays,
      interval_days => make_schedule.interval_days,
      effective_from => make_schedule.effective_from
    )
  ).id;
end;
$$;

-- One minute of the per-minute job at the given time, run as the cron job's
-- role. Returns to the owner afterwards so the test keeps reading under RLS.
create or replace function tests.tick_at(at timestamptz)
returns void
language plpgsql
as $$
begin
  perform tests.at(at);
  reset role;
  perform app.tick();
  perform tests.as_owner();
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(4);
select has_function('tests', 'at', array['timestamp with time zone'], 'tests.at(timestamptz) exists');
select has_function('tests', 'as_owner', 'tests.as_owner() exists');
select has_function('tests', 'as_owner_aal1', 'tests.as_owner_aal1() exists');
select has_function('tests', 'as_stranger', 'tests.as_stranger() exists');
select * from finish();
rollback;
