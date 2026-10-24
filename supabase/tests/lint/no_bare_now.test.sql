-- Guard: every function in `app` and `public` reads the time through app.now().
begin;
select plan(2);

-- Functions in app/public (other than app.now() itself and extension-owned
-- ones) whose source calls the clock directly.
create temporary view bare_now_functions as
select p.oid::regprocedure::text as fn
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('app', 'public')
  and p.oid <> 'app.now()'::regprocedure
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e'
  )
  and regexp_replace(lower(p.prosrc), 'app\.now\s*\(', '', 'g')
      ~ '(\mnow\s*\(|\mcurrent_timestamp\M|\mclock_timestamp\s*\()';

select is_empty(
  'select fn from bare_now_functions',
  'no_bare_now: no function in app or public calls now(), current_timestamp or clock_timestamp()'
);

-- The guard itself catches each form of a direct clock read.
create function public.reads_clock_directly() returns timestamptz language sql
  as $$ select greatest(now(), current_timestamp, clock_timestamp(), app.now()) $$;

select results_eq(
  'select fn from bare_now_functions',
  $$ values ('reads_clock_directly()') $$,
  'no_bare_now flags a function that reads the clock directly'
);

select * from finish();
rollback;
