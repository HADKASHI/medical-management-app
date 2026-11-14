-- Restocks: Units added to a Stock Item, with a date and an optional note.
-- Written only through record_restock(), which raises stock_items.quantity in
-- the same transaction. Linking to an Authorization comes with that slice.

create table public.restocks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  stock_item_id uuid not null references public.stock_items (id),
  -- Units added (packs × pack_size, converted at entry)
  quantity numeric not null check (quantity > 0),
  restocked_on date not null,
  note text,
  created_at timestamptz not null default app.now()
);

create index restocks_owner_id_idx on public.restocks (owner_id);
create index restocks_stock_item_id_idx on public.restocks (stock_item_id);

select app.protect_owned_table('public.restocks');

-- Record a Restock on restocked_on (default: today in the owner's time zone)
-- and add its Units to the Stock Item's quantity. It is entered either as
-- `quantity` Units or as a number of `packs`, converted with the Stock Item's
-- Pack Size, never both.
create or replace function public.record_restock(
  stock_item_id uuid,
  quantity numeric default null,
  packs numeric default null,
  restocked_on date default null,
  note text default null
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

  insert into public.restocks (stock_item_id, quantity, restocked_on, note)
  values (
    record_restock.stock_item_id,
    units,
    coalesce(record_restock.restocked_on, (app.now() at time zone app.time_zone())::date),
    nullif(btrim(record_restock.note), '')
  )
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.record_restock(uuid, numeric, numeric, date, text) from public, anon;
grant execute on function public.record_restock(uuid, numeric, numeric, date, text) to authenticated;
