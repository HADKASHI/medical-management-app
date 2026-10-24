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

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(1);
select has_function('tests', 'at', array['timestamp with time zone'], 'tests.at(timestamptz) exists');
select * from finish();
rollback;
