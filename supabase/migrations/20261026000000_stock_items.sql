-- Stock Items: a medication or supply the owner keeps on hand, counted in one
-- Unit. Single-row create and edit go straight to the table under owner-only
-- RLS; archiving goes through archive_stock_item() so it reads app.now().

create type public.stock_item_kind as enum ('medication', 'supply');

create table public.stock_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  name text not null check (btrim(name) <> ''),
  kind public.stock_item_kind not null,
  strength text,
  unit text not null check (btrim(unit) <> ''),
  -- may go negative (flagged in the UI): a Dose really taken is still recorded
  quantity numeric not null default 0,
  low_stock_threshold numeric not null default 0 check (low_stock_threshold >= 0),
  pack_size numeric check (pack_size > 0),
  archived_at timestamptz,
  created_at timestamptz not null default app.now(),
  constraint strength_only_on_medications check (kind = 'medication' or strength is null)
);

create index stock_items_owner_id_idx on public.stock_items (owner_id);

select app.protect_owned_table('public.stock_items');

-- Archive a Stock Item: it keeps its row (and its history) and leaves daily
-- views. Archiving an already Archived item keeps the first timestamp.
create or replace function public.archive_stock_item(stock_item_id uuid)
returns public.stock_items
language sql
security invoker
set search_path = ''
as $$
  update public.stock_items
  set archived_at = coalesce(archived_at, app.now())
  where id = stock_item_id
  returning *;
$$;

revoke execute on function public.archive_stock_item(uuid) from public, anon;
grant execute on function public.archive_stock_item(uuid) to authenticated;
