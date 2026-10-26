-- Dose Schedules (versioned), their Dose Times, and the Doses app.tick()
-- generates from them at Asia/Jerusalem wall-clock times.
--
-- A version is in force on local dates effective_from <= d < effective_to
-- (effective_to is exclusive; null = the current version). Editing goes
-- through save_dose_schedule(), which ends the current version and starts a
-- new one, so existing Doses keep pointing at the version they came from.

-- The owner's time zone: one app-wide setting.
create or replace function app.time_zone()
returns text
language sql
immutable
set search_path = ''
as $$ select 'Asia/Jerusalem' $$;

grant execute on function app.time_zone() to authenticated, service_role;

create type public.dose_schedule_pattern as enum ('daily', 'weekdays', 'every_n_days', 'as_needed');
create type public.dose_status as enum ('pending', 'taken', 'skipped', 'missed');

create table public.dose_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  stock_item_id uuid not null references public.stock_items (id),
  pattern public.dose_schedule_pattern not null,
  -- 0 = Sunday … 6 = Saturday, for `weekdays`
  weekdays smallint[] check (weekdays <@ '{0,1,2,3,4,5,6}' and cardinality(weekdays) > 0),
  -- for `every_n_days`, counted from effective_from
  interval_days int check (interval_days >= 1),
  effective_from date not null,
  effective_to date check (effective_to >= effective_from),
  -- when this version was saved: it generates no Dose due before this
  created_at timestamptz not null default app.now(),
  constraint weekdays_only_for_weekdays check ((pattern = 'weekdays') = (weekdays is not null)),
  constraint interval_only_for_every_n_days check ((pattern = 'every_n_days') = (interval_days is not null))
);

create index dose_schedules_owner_id_idx on public.dose_schedules (owner_id);
-- at most one current version per Stock Item
create unique index dose_schedules_one_current_idx
  on public.dose_schedules (stock_item_id) where effective_to is null;

select app.protect_owned_table('public.dose_schedules');

create table public.dose_times (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  dose_schedule_id uuid not null references public.dose_schedules (id),
  -- wall-clock time in app.time_zone()
  time_of_day time not null,
  amount numeric not null check (amount > 0),
  unique (dose_schedule_id, time_of_day)
);

create index dose_times_owner_id_idx on public.dose_times (owner_id);

select app.protect_owned_table('public.dose_times');

create table public.doses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  stock_item_id uuid not null references public.stock_items (id),
  -- null for As Needed Doses
  dose_schedule_id uuid references public.dose_schedules (id),
  -- null for As Needed Doses
  due_at timestamptz,
  amount numeric not null check (amount > 0),
  status public.dose_status not null default 'pending',
  taken_at timestamptz,
  status_changed_at timestamptz not null default app.now(),
  -- one Dose per schedule version and due time: makes app.tick() idempotent
  unique (dose_schedule_id, due_at)
);

create index doses_owner_id_idx on public.doses (owner_id);
create index doses_stock_item_due_at_idx on public.doses (stock_item_id, due_at);

select app.protect_owned_table('public.doses');

-- Save a medication's Dose Schedule: ends the current version and starts a new
-- one from effective_from (default: today in the owner's time zone).
-- times is a JSON array of {"time_of_day": "08:00", "amount": 1}.
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
security invoker
set search_path = ''
as $$
declare
  today date := (app.now() at time zone app.time_zone())::date;
  starts date := coalesce(save_dose_schedule.effective_from, today);
  saved public.dose_schedules;
begin
  if not exists (
    select 1 from public.stock_items s
    where s.id = save_dose_schedule.stock_item_id
  ) then
    raise exception 'Stock Item not found' using errcode = 'P0002';
  end if;

  update public.dose_schedules d
  set effective_to = greatest(d.effective_from, starts)
  where d.stock_item_id = save_dose_schedule.stock_item_id
    and d.effective_to is null;

  insert into public.dose_schedules (stock_item_id, pattern, weekdays, interval_days, effective_from)
  values (
    save_dose_schedule.stock_item_id,
    save_dose_schedule.pattern,
    save_dose_schedule.weekdays,
    save_dose_schedule.interval_days,
    starts
  )
  returning * into saved;

  insert into public.dose_times (dose_schedule_id, time_of_day, amount)
  select saved.id, (t ->> 'time_of_day')::time, (t ->> 'amount')::numeric
  from jsonb_array_elements(save_dose_schedule.times) t;

  return saved;
end;
$$;

revoke execute on function public.save_dose_schedule(uuid, public.dose_schedule_pattern, jsonb, smallint[], int, date)
  from public, anon;
grant execute on function public.save_dose_schedule(uuid, public.dose_schedule_pattern, jsonb, smallint[], int, date)
  to authenticated;

-- Create the pending Doses that are due by now from the versions in force,
-- looking back one day so a missed minute of the job catches up.
create or replace function app.generate_doses()
returns void
language plpgsql
set search_path = ''
as $$
declare
  now_ timestamptz := app.now();
  today date := (now_ at time zone app.time_zone())::date;
begin
  insert into public.doses (owner_id, stock_item_id, dose_schedule_id, due_at, amount, status, status_changed_at)
  select s.owner_id, s.stock_item_id, s.id, due.at, t.amount, 'pending', now_
  from public.dose_schedules s
  join public.stock_items i on i.id = s.stock_item_id and i.archived_at is null
  join public.dose_times t on t.dose_schedule_id = s.id
  cross join lateral (values (today - 1), (today)) as day (d)
  -- Postgres's own reading of a local time handles daylight-saving days.
  cross join lateral (select (day.d + t.time_of_day) at time zone app.time_zone() as at) due
  where day.d >= s.effective_from
    and (s.effective_to is null or day.d < s.effective_to)
    and case s.pattern
      when 'daily' then true
      when 'weekdays' then extract(dow from day.d)::smallint = any (s.weekdays)
      when 'every_n_days' then (day.d - s.effective_from) % s.interval_days = 0
      else false
    end
    and due.at <= now_
    and due.at >= s.created_at
  on conflict (dose_schedule_id, due_at) do nothing;
end;
$$;

revoke execute on function app.generate_doses() from public, anon, authenticated;

create or replace function app.tick()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform app.generate_doses();
end;
$$;

revoke execute on function app.tick() from public, anon, authenticated;
