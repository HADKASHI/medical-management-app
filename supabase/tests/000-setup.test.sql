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

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(4);
select has_function('tests', 'at', array['timestamp with time zone'], 'tests.at(timestamptz) exists');
select has_function('tests', 'as_owner', 'tests.as_owner() exists');
select has_function('tests', 'as_owner_aal1', 'tests.as_owner_aal1() exists');
select has_function('tests', 'as_stranger', 'tests.as_stranger() exists');
select * from finish();
rollback;
