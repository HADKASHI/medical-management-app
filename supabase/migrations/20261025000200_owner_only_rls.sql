-- Owner-only RLS with enforced TOTP. Every table in `public` is protected by
-- calling app.protect_owned_table() in the migration that creates it; the
-- guard test supabase/tests/rls/every_table.test.sql fails for any table that
-- isn't. The table needs an `owner_id uuid not null default auth.uid()` column.
--
-- Two policies:
--   owner_only    (permissive)  rows whose owner_id is the signed-in user;
--   aal2_required (restrictive) only sessions that passed TOTP (aal2). A
--                 session after the password step alone (aal1) can enrol or
--                 verify a factor through Supabase Auth and do nothing else.

create or replace function app.protect_owned_table(target regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table %s enable row level security', target);
  execute format('revoke all on table %s from anon', target);
  execute format(
    'grant select, insert, update, delete on table %s to authenticated',
    target
  );
  execute format(
    'create policy owner_only on %s as permissive for all to authenticated '
    'using (owner_id = (select auth.uid())) '
    'with check (owner_id = (select auth.uid()))',
    target
  );
  execute format(
    'create policy aal2_required on %s as restrictive for all to authenticated '
    'using ((select auth.jwt() ->> ''aal'') = ''aal2'') '
    'with check ((select auth.jwt() ->> ''aal'') = ''aal2'')',
    target
  );
end;
$$;

revoke execute on function app.protect_owned_table(regclass) from public, anon, authenticated;
