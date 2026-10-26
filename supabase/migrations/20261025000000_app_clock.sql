-- The `app` schema holds the domain functions; app.now() is the only clock.
-- Every function reads time through app.now(), never now(), current_timestamp
-- or clock_timestamp() directly (guarded by supabase/tests/lint/no_bare_now.test.sql).

create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- Returns the time set in the `app.now` setting (tests only; PostgREST clients
-- can't set it), or the real time when it isn't set.
create or replace function app.now()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('app.now', true), '')::timestamptz, pg_catalog.now());
$$;
