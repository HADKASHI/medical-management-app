-- Owner-only RLS with enforced TOTP, on a table protected the way every
-- domain table is: app.protect_owned_table().
begin;
select plan(13);

create table public.rls_probe (
  id bigint generated always as identity primary key,
  owner_id uuid not null default auth.uid() references auth.users (id),
  note text not null
);
select app.protect_owned_table('public.rls_probe');

-- the owner with aal2 can read and write a table
select tests.as_owner();

select lives_ok(
  $$ insert into public.rls_probe (note) values ('Medication A') $$,
  'the owner with aal2 can insert a row'
);

select results_eq(
  $$ update public.rls_probe set note = 'Medication B' returning note $$,
  $$ values ('Medication B') $$,
  'the owner with aal2 can update their row'
);

select results_eq(
  $$ select note from public.rls_probe $$,
  $$ values ('Medication B') $$,
  'the owner with aal2 can read their row'
);

-- a stranger reads and writes nothing
select tests.as_stranger();

select is_empty(
  $$ select * from public.rls_probe $$,
  'a stranger reads none of the owner''s rows'
);

select is_empty(
  $$ update public.rls_probe set note = 'Medication C' returning id $$,
  'a stranger updates none of the owner''s rows'
);

select is_empty(
  $$ delete from public.rls_probe returning id $$,
  'a stranger deletes none of the owner''s rows'
);

select throws_ok(
  $$ insert into public.rls_probe (owner_id, note)
     values ('00000000-0000-4000-8000-00000000000a', 'Medication C') $$,
  '42501',
  null,
  'a stranger cannot insert a row for the owner'
);

select tests.as_owner();

select results_eq(
  $$ select note from public.rls_probe $$,
  $$ values ('Medication B') $$,
  'the owner''s row is unchanged after the stranger''s attempts'
);

-- the owner with only aal1 reads and writes nothing
select tests.as_owner_aal1();

select is_empty(
  $$ select * from public.rls_probe $$,
  'the owner with only aal1 reads nothing'
);

select is_empty(
  $$ update public.rls_probe set note = 'Medication C' returning id $$,
  'the owner with only aal1 updates nothing'
);

select is_empty(
  $$ delete from public.rls_probe returning id $$,
  'the owner with only aal1 deletes nothing'
);

select throws_ok(
  $$ insert into public.rls_probe (note) values ('Medication C') $$,
  '42501',
  null,
  'the owner with only aal1 cannot insert'
);

select tests.as_owner();

select results_eq(
  $$ select note from public.rls_probe $$,
  $$ values ('Medication B') $$,
  'the owner''s row is unchanged after the aal1 attempts'
);

select * from finish();
rollback;
