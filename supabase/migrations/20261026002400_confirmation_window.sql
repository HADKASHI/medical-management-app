-- The Confirmation Window: app.tick() marks a pending Dose missed at the
-- earlier of 24 hours after its due_at or the due_at of the next Dose of the
-- same Stock Item. Becoming missed leaves quantity alone; a missed Dose can
-- still be changed to taken through set_dose_status().

create or replace function app.mark_missed_doses()
returns void
language plpgsql
set search_path = ''
as $$
declare
  now_ timestamptz := app.now();
begin
  update public.doses d
  set status = 'missed',
      status_changed_at = now_
  where d.status = 'pending'
    and d.due_at is not null
    and (
      -- an absolute 24 hours, so a daylight-saving day doesn't stretch it
      d.due_at + interval '24 hours' <= now_
      -- the next Dose of the same item is due: generate_doses() has just
      -- created every Dose due by now, so it exists as a row
      or exists (
        select 1 from public.doses next_
        where next_.stock_item_id = d.stock_item_id
          and next_.due_at > d.due_at
          and next_.due_at <= now_
      )
    );
end;
$$;

revoke execute on function app.mark_missed_doses() from public, anon, authenticated;

-- Archiving a Stock Item also marks its still-pending Doses skipped (no
-- quantity change). The Stock Item is updated first, then its Doses: the same
-- lock order as set_dose_status().
create or replace function public.archive_stock_item(stock_item_id uuid)
returns public.stock_items
language plpgsql
security invoker
set search_path = ''
as $$
declare
  now_ timestamptz := app.now();
  item public.stock_items;
begin
  update public.stock_items s
  set archived_at = coalesce(s.archived_at, now_)
  where s.id = archive_stock_item.stock_item_id
  returning * into item;

  update public.doses d
  set status = 'skipped',
      status_changed_at = now_
  where d.stock_item_id = item.id
    and d.status = 'pending';

  return item;
end;
$$;

revoke execute on function public.archive_stock_item(uuid) from public, anon;
grant execute on function public.archive_stock_item(uuid) to authenticated;

create or replace function app.tick()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform app.generate_doses();
  perform app.mark_missed_doses();
end;
$$;

revoke execute on function app.tick() from public, anon, authenticated;
