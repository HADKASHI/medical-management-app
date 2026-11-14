-- Confirming Doses: Taken / Skip / undo from Due Doses, "All taken", and
-- logging an As Needed Dose. A Dose's status and its Stock Item's quantity
-- change in one transaction: moving into `taken` subtracts the Dose's amount,
-- moving out of `taken` gives it back. Quantity may go negative.

-- Taken / Skip / undo for one Dose: move it to `status` (`pending`, `taken`
-- or `skipped`; only the Confirmation Window marks a Dose missed).
create or replace function public.set_dose_status(dose_id uuid, status public.dose_status)
returns public.doses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  now_ timestamptz := app.now();
  dose public.doses;
begin
  if set_dose_status.status = 'missed' then
    raise exception 'Only the Confirmation Window marks a Dose missed' using errcode = '22023';
  end if;

  -- Stock Item first, then the Dose: the same order as take_doses().
  perform 1
  from public.stock_items s
  where s.id = (select d.stock_item_id from public.doses d where d.id = set_dose_status.dose_id)
  for update;

  select * into dose
  from public.doses d
  where d.id = set_dose_status.dose_id
  for update;

  if not found then
    raise exception 'Dose not found' using errcode = 'P0002';
  elsif dose.status = set_dose_status.status then
    return dose;
  end if;

  update public.stock_items s
  set quantity = s.quantity + case
    when set_dose_status.status = 'taken' then -dose.amount
    when dose.status = 'taken' then dose.amount
    else 0
  end
  where s.id = dose.stock_item_id;

  update public.doses d
  set status = set_dose_status.status,
      taken_at = case when set_dose_status.status = 'taken' then now_ end,
      status_changed_at = now_
  where d.id = dose.id
  returning * into dose;

  return dose;
end;
$$;

revoke execute on function public.set_dose_status(uuid, public.dose_status) from public, anon;
grant execute on function public.set_dose_status(uuid, public.dose_status) to authenticated;

-- "All taken": takes every listed Dose that is still pending, in one
-- transaction. Listed Doses already answered are left as they are.
create or replace function public.take_doses(dose_ids uuid[])
returns setof public.doses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  pending_id uuid;
begin
  -- Lock every Stock Item involved up front, in id order, so concurrent
  -- calls can't deadlock.
  perform 1
  from public.stock_items s
  where s.id in (select d.stock_item_id from public.doses d where d.id = any (take_doses.dose_ids))
  order by s.id
  for update;

  for pending_id in
    select d.id from public.doses d
    where d.id = any (take_doses.dose_ids) and d.status = 'pending'
    order by d.due_at, d.id
  loop
    return next public.set_dose_status(pending_id, 'taken');
  end loop;
end;
$$;

revoke execute on function public.take_doses(uuid[]) from public, anon;
grant execute on function public.take_doses(uuid[]) to authenticated;

-- Log an As Needed Dose of `amount` Units: created as taken, now, with no
-- schedule or due time, and subtracted from quantity.
create or replace function public.log_as_needed_dose(stock_item_id uuid, amount numeric)
returns public.doses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  now_ timestamptz := app.now();
  item_kind public.stock_item_kind;
  saved public.doses;
begin
  select s.kind into item_kind
  from public.stock_items s
  where s.id = log_as_needed_dose.stock_item_id
  for update;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  elsif item_kind <> 'medication' then
    raise exception 'Only medications have Doses' using errcode = '22023';
  elsif log_as_needed_dose.amount is null or log_as_needed_dose.amount <= 0 then
    raise exception 'A Dose must be a positive number of Units' using errcode = '22023';
  end if;

  update public.stock_items s
  set quantity = s.quantity - log_as_needed_dose.amount
  where s.id = log_as_needed_dose.stock_item_id;

  insert into public.doses (stock_item_id, amount, status, taken_at, status_changed_at)
  values (log_as_needed_dose.stock_item_id, log_as_needed_dose.amount, 'taken', now_, now_)
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.log_as_needed_dose(uuid, numeric) from public, anon;
grant execute on function public.log_as_needed_dose(uuid, numeric) to authenticated;
