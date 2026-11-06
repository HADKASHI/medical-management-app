-- Stock Counts: the quantity the owner physically counted, and the quantity
-- before it (the difference is the drift). Written only through
-- record_stock_count(), which sets stock_items.quantity in the same
-- transaction.

create table public.stock_counts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  stock_item_id uuid not null references public.stock_items (id),
  counted_quantity numeric not null check (counted_quantity >= 0),
  -- may be negative: a count is how negative stock gets fixed
  previous_quantity numeric not null,
  counted_at timestamptz not null default app.now()
);

create index stock_counts_owner_id_idx on public.stock_counts (owner_id);
create index stock_counts_stock_item_id_idx on public.stock_counts (stock_item_id);

select app.protect_owned_table('public.stock_counts');

-- Record a Stock Count now: set the Stock Item's quantity to counted_quantity
-- and keep the quantity it replaced.
create or replace function public.record_stock_count(
  stock_item_id uuid,
  counted_quantity numeric
)
returns public.stock_counts
language plpgsql
security invoker
set search_path = ''
as $$
declare
  before numeric;
  saved public.stock_counts;
begin
  if record_stock_count.counted_quantity is null or record_stock_count.counted_quantity < 0 then
    raise exception 'A counted quantity cannot be negative' using errcode = '22023';
  end if;

  select s.quantity into before
  from public.stock_items s
  where s.id = record_stock_count.stock_item_id
  for update;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  end if;

  update public.stock_items s
  set quantity = record_stock_count.counted_quantity
  where s.id = record_stock_count.stock_item_id;

  insert into public.stock_counts (stock_item_id, counted_quantity, previous_quantity)
  values (record_stock_count.stock_item_id, record_stock_count.counted_quantity, before)
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.record_stock_count(uuid, numeric) from public, anon;
grant execute on function public.record_stock_count(uuid, numeric) to authenticated;
