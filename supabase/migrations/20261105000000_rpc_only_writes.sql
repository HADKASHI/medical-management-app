-- Domain events are written only through their RPCs.
--
-- app.protect_owned_table() grants the owner's session insert, update and
-- delete on every table. That would let the session skip the RPC that keeps a
-- Stock Item's quantity in step with its Doses, Restocks and Stock Counts, or
-- stamp a cancellation with the device's clock instead of app.now(). So:
--   * doses, restocks, stock_counts, dose_schedules and dose_times take no
--     direct writes at all;
--   * stock_items.quantity and archived_at, authorizations.archived_at and
--     appointments.cancelled_at and invite_sequence take no direct writes
--     (a Stock Item's initial quantity is still set on insert);
--   * the RPCs that write them run as security definer, past those grants
--     and past RLS, so each one checks for itself that the caller is the
--     signed-in owner of the row with aal2 (app.signed_in_owner()).
--
-- References from those tables to a Stock Item or a Dose Schedule become
-- composite (owner_id, id) keys, like every other link between owned rows.

-- The caller's user id, once they passed TOTP (aal2). Raises 42501 for anyone
-- else, before any row is read.
create or replace function app.signed_in_owner()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'Sign in with your authenticator first' using errcode = '42501';
  end if;
  return uid;
end;
$$;

revoke execute on function app.signed_in_owner() from public, anon, authenticated;

-- Composite owner keys --------------------------------------------------------

alter table public.dose_schedules
  add constraint dose_schedules_owner_id_id_key unique (owner_id, id);

alter table public.dose_schedules
  drop constraint dose_schedules_stock_item_id_fkey,
  add constraint dose_schedules_stock_item_fkey foreign key (owner_id, stock_item_id)
    references public.stock_items (owner_id, id);

alter table public.dose_times
  drop constraint dose_times_dose_schedule_id_fkey,
  add constraint dose_times_dose_schedule_fkey foreign key (owner_id, dose_schedule_id)
    references public.dose_schedules (owner_id, id);

alter table public.doses
  drop constraint doses_stock_item_id_fkey,
  drop constraint doses_dose_schedule_id_fkey,
  add constraint doses_stock_item_fkey foreign key (owner_id, stock_item_id)
    references public.stock_items (owner_id, id),
  -- null for As Needed Doses: a simple-match key then checks nothing
  add constraint doses_dose_schedule_fkey foreign key (owner_id, dose_schedule_id)
    references public.dose_schedules (owner_id, id);

alter table public.restocks
  drop constraint restocks_stock_item_id_fkey,
  add constraint restocks_stock_item_fkey foreign key (owner_id, stock_item_id)
    references public.stock_items (owner_id, id);

alter table public.stock_counts
  drop constraint stock_counts_stock_item_id_fkey,
  add constraint stock_counts_stock_item_fkey foreign key (owner_id, stock_item_id)
    references public.stock_items (owner_id, id);

-- Grants -------------------------------------------------------------------------

revoke insert, update, delete on
  public.doses, public.restocks, public.stock_counts, public.dose_schedules, public.dose_times
  from authenticated;

revoke insert, update on public.stock_items, public.authorizations, public.appointments
  from authenticated;

grant insert (name, kind, strength, unit, quantity, low_stock_threshold, pack_size)
  on public.stock_items to authenticated;
grant update (name, kind, strength, unit, low_stock_threshold, pack_size)
  on public.stock_items to authenticated;

grant insert (type, reference_number, covers, stock_item_id, issued_on, expires_on,
              renews_authorization_id),
      update (type, reference_number, covers, stock_item_id, issued_on, expires_on,
              renews_authorization_id)
  on public.authorizations to authenticated;

-- invite_uid stays writable so its trigger answers: replaced on insert,
-- rejected when an update changes it.
grant insert (title, starts_at, ends_at, provider, location, notes, visit_summary,
              authorization_id, buffer_before_minutes, buffer_after_minutes,
              send_to_work_calendar, invite_uid),
      update (title, starts_at, ends_at, provider, location, notes, visit_summary,
              authorization_id, buffer_before_minutes, buffer_after_minutes,
              send_to_work_calendar, invite_uid)
  on public.appointments to authenticated;

-- Stock ---------------------------------------------------------------------------

create or replace function public.archive_stock_item(stock_item_id uuid)
returns public.stock_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  now_ timestamptz := app.now();
  item public.stock_items;
begin
  update public.stock_items s
  set archived_at = coalesce(s.archived_at, now_)
  where s.id = archive_stock_item.stock_item_id
    and s.owner_id = owner
  returning * into item;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  end if;

  update public.doses d
  set status = 'skipped',
      status_changed_at = now_
  where d.stock_item_id = item.id
    and d.owner_id = owner
    and d.status = 'pending';

  return item;
end;
$$;

revoke execute on function public.archive_stock_item(uuid) from public, anon;
grant execute on function public.archive_stock_item(uuid) to authenticated;

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
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
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
    and s.owner_id = owner
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

  -- the composite key keeps authorization_id to the owner's own Authorizations
  insert into public.restocks (owner_id, stock_item_id, quantity, restocked_on, note, authorization_id)
  values (
    owner,
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

create or replace function public.record_stock_count(
  stock_item_id uuid,
  counted_quantity numeric
)
returns public.stock_counts
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  before numeric;
  saved public.stock_counts;
begin
  if record_stock_count.counted_quantity is null or record_stock_count.counted_quantity < 0 then
    raise exception 'A counted quantity cannot be negative' using errcode = '22023';
  end if;

  select s.quantity into before
  from public.stock_items s
  where s.id = record_stock_count.stock_item_id
    and s.owner_id = owner
  for update;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  end if;

  update public.stock_items s
  set quantity = record_stock_count.counted_quantity
  where s.id = record_stock_count.stock_item_id;

  insert into public.stock_counts (owner_id, stock_item_id, counted_quantity, previous_quantity)
  values (owner, record_stock_count.stock_item_id, record_stock_count.counted_quantity, before)
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.record_stock_count(uuid, numeric) from public, anon;
grant execute on function public.record_stock_count(uuid, numeric) to authenticated;

-- Dosing --------------------------------------------------------------------------

create or replace function public.save_dose_schedule(
  stock_item_id uuid,
  pattern public.dose_schedule_pattern,
  times jsonb default '[]',
  weekdays smallint[] default null,
  interval_days int default null,
  effective_from date default null
)
returns public.dose_schedules
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  today date := (app.now() at time zone app.time_zone())::date;
  starts date := coalesce(save_dose_schedule.effective_from, today);
  item_kind public.stock_item_kind;
  saved public.dose_schedules;
begin
  select s.kind into item_kind
  from public.stock_items s
  where s.id = save_dose_schedule.stock_item_id
    and s.owner_id = owner;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  elsif item_kind <> 'medication' then
    raise exception 'Only medications have Dose Schedules' using errcode = '22023';
  elsif save_dose_schedule.pattern = 'as_needed' and jsonb_array_length(save_dose_schedule.times) > 0 then
    raise exception 'An As Needed schedule has no Dose Times' using errcode = '22023';
  elsif save_dose_schedule.pattern <> 'as_needed' and jsonb_array_length(save_dose_schedule.times) = 0 then
    raise exception 'A schedule needs at least one Dose Time' using errcode = '22023';
  elsif starts < today then
    raise exception 'A schedule cannot start in the past' using errcode = '22023';
  end if;

  update public.dose_schedules d
  set effective_to = greatest(d.effective_from, starts)
  where d.stock_item_id = save_dose_schedule.stock_item_id
    and d.owner_id = owner
    and d.effective_to is null;

  insert into public.dose_schedules (owner_id, stock_item_id, pattern, weekdays, interval_days, effective_from)
  values (
    owner,
    save_dose_schedule.stock_item_id,
    save_dose_schedule.pattern,
    save_dose_schedule.weekdays,
    save_dose_schedule.interval_days,
    starts
  )
  returning * into saved;

  insert into public.dose_times (owner_id, dose_schedule_id, time_of_day, amount)
  select owner, saved.id, (t ->> 'time_of_day')::time, (t ->> 'amount')::numeric
  from jsonb_array_elements(save_dose_schedule.times) t;

  return saved;
end;
$$;

revoke execute on function public.save_dose_schedule(uuid, public.dose_schedule_pattern, jsonb, smallint[], int, date)
  from public, anon;
grant execute on function public.save_dose_schedule(uuid, public.dose_schedule_pattern, jsonb, smallint[], int, date)
  to authenticated;

-- Taken / Skip / undo for one Dose. The allowed changes:
--   pending -> taken | skipped   (Taken / Skip)
--   skipped -> taken             (changed my mind)
--   missed  -> taken             (a late fix)
--   taken   -> pending           (undo of a just-taken Dose)
-- Setting the status a Dose already has changes nothing. Only the
-- Confirmation Window marks a Dose missed.
create or replace function public.set_dose_status(dose_id uuid, status public.dose_status)
returns public.doses
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  now_ timestamptz := app.now();
  dose public.doses;
begin
  if set_dose_status.status = 'missed' then
    raise exception 'Only the Confirmation Window marks a Dose missed' using errcode = '22023';
  end if;

  -- Stock Item first, then the Dose: the same order as take_doses().
  perform 1
  from public.stock_items s
  where s.id = (
    select d.stock_item_id from public.doses d
    where d.id = set_dose_status.dose_id and d.owner_id = owner
  )
  for update;

  select * into dose
  from public.doses d
  where d.id = set_dose_status.dose_id
    and d.owner_id = owner
  for update;

  if not found then
    raise exception 'Dose not found' using errcode = 'P0002';
  elsif dose.status = set_dose_status.status then
    return dose;
  elsif dose.status::text || '>' || set_dose_status.status::text
        not in ('pending>taken', 'pending>skipped', 'skipped>taken', 'missed>taken', 'taken>pending') then
    raise exception 'A % Dose cannot become %', dose.status, set_dose_status.status
      using errcode = '22023';
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
-- transaction. Listed Doses already answered are left as they are; a listed
-- Dose that isn't the caller's fails the whole call.
create or replace function public.take_doses(dose_ids uuid[])
returns setof public.doses
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  pending_id uuid;
begin
  if exists (
    select 1 from unnest(take_doses.dose_ids) listed (id)
    where not exists (
      select 1 from public.doses d where d.id = listed.id and d.owner_id = owner
    )
  ) then
    raise exception 'Dose not found' using errcode = 'P0002';
  end if;

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
-- schedule or due time, and subtracted from quantity. Only for an unarchived
-- medication whose schedule version in force today is As Needed.
create or replace function public.log_as_needed_dose(stock_item_id uuid, amount numeric)
returns public.doses
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  now_ timestamptz := app.now();
  today date := (now_ at time zone app.time_zone())::date;
  item public.stock_items;
  saved public.doses;
begin
  select * into item
  from public.stock_items s
  where s.id = log_as_needed_dose.stock_item_id
    and s.owner_id = owner
  for update;

  if not found then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  elsif item.kind <> 'medication' then
    raise exception 'Only medications have Doses' using errcode = '22023';
  elsif item.archived_at is not null then
    raise exception 'An Archived Stock Item takes no Doses' using errcode = '22023';
  elsif not exists (
    select 1 from public.dose_schedules d
    where d.stock_item_id = item.id
      and d.owner_id = owner
      and d.pattern = 'as_needed'
      and d.effective_from <= today
      and (d.effective_to is null or today < d.effective_to)
  ) then
    raise exception 'Only an As Needed schedule takes an As Needed Dose' using errcode = '22023';
  elsif log_as_needed_dose.amount is null or log_as_needed_dose.amount <= 0 then
    raise exception 'A Dose must be a positive number of Units' using errcode = '22023';
  end if;

  update public.stock_items s
  set quantity = s.quantity - log_as_needed_dose.amount
  where s.id = item.id;

  insert into public.doses (owner_id, stock_item_id, amount, status, taken_at, status_changed_at)
  values (owner, item.id, log_as_needed_dose.amount, 'taken', now_, now_)
  returning * into saved;

  return saved;
end;
$$;

revoke execute on function public.log_as_needed_dose(uuid, numeric) from public, anon;
grant execute on function public.log_as_needed_dose(uuid, numeric) to authenticated;

-- Authorizations and Appointments -------------------------------------------------

create or replace function public.archive_authorization(authorization_id uuid)
returns public.authorizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  saved public.authorizations;
begin
  update public.authorizations a
  set archived_at = coalesce(a.archived_at, app.now())
  where a.id = archive_authorization.authorization_id
    and a.owner_id = owner
  returning * into saved;

  if not found then
    raise exception 'Authorization not found' using errcode = 'P0002';
  end if;
  return saved;
end;
$$;

revoke execute on function public.archive_authorization(uuid) from public, anon;
grant execute on function public.archive_authorization(uuid) to authenticated;

create or replace function public.cancel_appointment(appointment_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  saved public.appointments;
begin
  update public.appointments a
  set cancelled_at = coalesce(a.cancelled_at, app.now())
  where a.id = cancel_appointment.appointment_id
    and a.owner_id = owner
  returning * into saved;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  return saved;
end;
$$;

revoke execute on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

create or replace function public.duplicate_appointment(
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid := app.signed_in_owner();
  saved public.appointments;
begin
  insert into public.appointments (
    owner_id, title, starts_at, ends_at, provider, location, notes, authorization_id,
    buffer_before_minutes, buffer_after_minutes, send_to_work_calendar
  )
  select
    owner, a.title, duplicate_appointment.starts_at, duplicate_appointment.ends_at, a.provider,
    a.location, a.notes, a.authorization_id, a.buffer_before_minutes,
    a.buffer_after_minutes, a.send_to_work_calendar
  from public.appointments a
  where a.id = duplicate_appointment.appointment_id
    and a.owner_id = owner
  returning * into saved;

  if not found then
    raise exception 'Appointment not found' using errcode = 'P0002';
  end if;
  return saved;
end;
$$;

revoke execute on function public.duplicate_appointment(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.duplicate_appointment(uuid, timestamptz, timestamptz) to authenticated;
