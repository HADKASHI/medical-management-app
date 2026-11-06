-- Guard: every table in `public` has RLS enabled and a restrictive aal2
-- policy, i.e. was protected with app.protect_owned_table().
begin;
select plan(3);

-- Tables in public (other than extension-owned ones) missing RLS or a
-- restrictive policy that requires aal2 for every command.
create temporary view unprotected_tables as
select c.oid::regclass::text as tbl
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not exists (
    select 1 from pg_depend d
    where d.classid = 'pg_class'::regclass and d.objid = c.oid and d.deptype = 'e'
  )
  and not (
    c.relrowsecurity
    and exists (
      select 1 from pg_policy p
      where p.polrelid = c.oid
        and not p.polpermissive
        and p.polcmd = '*'
        and pg_get_expr(p.polqual, p.polrelid) ~ '''aal2''::text'
        and pg_get_expr(p.polwithcheck, p.polrelid) ~ '''aal2''::text'
    )
  );

select is_empty(
  'select tbl from unprotected_tables',
  'rls/every_table: every table in public has RLS enabled and an aal2 restrictive policy'
);

-- The guard itself flags a table with no RLS, and one with only the owner policy.
create table public.unprotected_probe (id int);
create table public.owner_only_probe (
  owner_id uuid not null default auth.uid()
);
alter table public.owner_only_probe enable row level security;
create policy owner_only on public.owner_only_probe
  for all to authenticated using (owner_id = auth.uid());

select results_eq(
  'select tbl from unprotected_tables order by tbl',
  $$ values ('owner_only_probe'), ('unprotected_probe') $$,
  'rls/every_table flags tables without RLS or without the aal2 restrictive policy'
);

create table public.protected_probe (
  owner_id uuid not null default auth.uid() references auth.users (id)
);
select app.protect_owned_table('public.protected_probe');

select ok(
  not exists (select 1 from unprotected_tables where tbl = 'protected_probe'),
  'rls/every_table accepts a table protected with app.protect_owned_table()'
);

select * from finish();
rollback;
