-- Authorizations: a prescription, Form 17 or Commitment from the HMO, with a
-- reference number (which may repeat), what it covers, at most one Stock Item
-- and an expiry date. Create, edit and delete go straight to the table under
-- owner-only RLS; archiving goes through archive_authorization() so it reads
-- app.now().
--
-- Renewal is a plain insert whose renews_authorization_id points at the old
-- Authorization. The pointer is unique, so an Authorization is renewed once.
-- *Renewed* is derived: the `renewed` computed field is true when another row
-- points at this one.
--
-- References between owned rows are composite (owner_id, id) foreign keys, so
-- a row can only point at a row of the same owner.

create type public.authorization_type as enum ('prescription', 'form_17', 'commitment');

alter table public.stock_items
  add constraint stock_items_owner_id_id_key unique (owner_id, id);

create table public.authorizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  type public.authorization_type not null,
  -- may repeat across rows: one paper prescription, several medications
  reference_number text not null check (btrim(reference_number) <> ''),
  covers text not null check (btrim(covers) <> ''),
  stock_item_id uuid,
  issued_on date,
  expires_on date not null,
  renews_authorization_id uuid unique,
  archived_at timestamptz,
  created_at timestamptz not null default app.now(),
  constraint authorizations_owner_id_id_key unique (owner_id, id),
  constraint authorizations_stock_item_fkey foreign key (owner_id, stock_item_id)
    references public.stock_items (owner_id, id),
  constraint authorizations_renews_fkey foreign key (owner_id, renews_authorization_id)
    references public.authorizations (owner_id, id),
  constraint expires_on_or_after_issued_on check (issued_on is null or expires_on >= issued_on),
  constraint does_not_renew_itself check (renews_authorization_id <> id)
);

create index authorizations_stock_item_id_idx on public.authorizations (stock_item_id);

select app.protect_owned_table('public.authorizations');

-- Renewed: another Authorization points at this one. A computed field, so
-- PostgREST selects it as `renewed` and SQL reads it as `a.renewed`.
create or replace function public.renewed(public.authorizations)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.authorizations r where r.renews_authorization_id = $1.id
  );
$$;

revoke execute on function public.renewed(public.authorizations) from public, anon;
grant execute on function public.renewed(public.authorizations) to authenticated;

-- Archive an Authorization: it keeps its row and leaves daily views. Archiving
-- an already Archived one keeps the first timestamp.
create or replace function public.archive_authorization(authorization_id uuid)
returns public.authorizations
language sql
security invoker
set search_path = ''
as $$
  update public.authorizations
  set archived_at = coalesce(archived_at, app.now())
  where id = authorization_id
  returning *;
$$;

revoke execute on function public.archive_authorization(uuid) from public, anon;
grant execute on function public.archive_authorization(uuid) to authenticated;

-- Restocks: the Authorization a Restock was filled under.
alter table public.restocks
  add column authorization_id uuid,
  add constraint restocks_authorization_fkey foreign key (owner_id, authorization_id)
    references public.authorizations (owner_id, id);

create index restocks_authorization_id_idx on public.restocks (authorization_id);

-- record_restock() gains an optional Authorization; otherwise unchanged.
drop function public.record_restock(uuid, numeric, numeric, date, text);

create or replace function public.record_restock(
  stock_item_id uuid,
  quantity numeric default null,
  packs numeric default null,
  restocked_on date default null,
  note text default null,
  authorization_id uuid default null
)
returns public.restocks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item_pack_size numeric;
  units numeric := record_restock.quantity;
  saved public.restocks;
begin
  if (record_restock.quantity is null) = (record_restock.packs is null) then
    raise exception 'A Restock is entered in Units or in packs' using errcode = '22023';
  end if;

  select s.pack_size into item_pack_size
  from public.stock_items s
  where s.id = record_restock.stock_item_id
  for update;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  end if;

  if record_restock.packs is not null then
    if item_pack_size is null then
      raise exception 'A Restock in packs needs the Stock Item''s Pack Size' using errcode = '22023';
    end if;
    units := record_restock.packs * item_pack_size;
  end if;

  if units <= 0 then
    raise exception 'A Restock must add a positive number of Units' using errcode = '22023';
  end if;

  update public.stock_items s
  set quantity = s.quantity + units
  where s.id = record_restock.stock_item_id;

  insert into public.restocks (stock_item_id, quantity, restocked_on, note, authorization_id)
  values (
    record_restock.stock_item_id,
    units,
    coalesce(record_restock.restocked_on, (app.now() at time zone app.time_zone())::date),
    nullif(btrim(record_restock.note), ''),
    record_restock.authorization_id
  )
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.record_restock(uuid, numeric, numeric, date, text, uuid) from public, anon;
grant execute on function public.record_restock(uuid, numeric, numeric, date, text, uuid) to authenticated;
