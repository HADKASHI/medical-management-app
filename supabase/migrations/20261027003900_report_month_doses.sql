-- Reports, Doses tab: a month of Doses and the Dose Schedule versions in force
-- that month, read under the owner's RLS (security invoker). No report tables
-- or aggregates: the client counts and lays out the grid (ADR 0002).
-- `month` is any date in the month; months are Asia/Jerusalem calendar months.

-- Every Dose of the month: a scheduled Dose by its due time, an As Needed Dose
-- by when it was taken, with that moment's local date and time.
create or replace function public.month_doses(month date)
returns table (
  id uuid,
  stock_item_id uuid,
  dose_schedule_id uuid,
  due_at timestamptz,
  taken_at timestamptz,
  status public.dose_status,
  amount numeric,
  local_date date,
  local_time time
)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id, d.stock_item_id, d.dose_schedule_id, d.due_at, d.taken_at, d.status, d.amount,
         local.at::date, local.at::time
  from public.doses d
  cross join lateral (
    select coalesce(d.due_at, d.taken_at) at time zone app.time_zone() as at
  ) local
  where local.at >= date_trunc('month', month_doses.month)
    and local.at < date_trunc('month', month_doses.month) + interval '1 month'
  order by local.at, d.id;
$$;

revoke execute on function public.month_doses(date) from public, anon;
grant execute on function public.month_doses(date) to authenticated;

-- Every Dose Schedule version in force on at least one day of the month
-- (effective_from <= d < effective_to), with its Dose Times in time order.
create or replace function public.month_dose_schedules(month date)
returns table (
  id uuid,
  stock_item_id uuid,
  pattern public.dose_schedule_pattern,
  effective_from date,
  effective_to date,
  times time[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.stock_item_id, s.pattern, s.effective_from, s.effective_to,
         array(select t.time_of_day from public.dose_times t
               where t.dose_schedule_id = s.id order by t.time_of_day)
  from public.dose_schedules s
  where s.effective_from < (date_trunc('month', month_dose_schedules.month) + interval '1 month')::date
    and (s.effective_to is null
         or (s.effective_to > date_trunc('month', month_dose_schedules.month)::date
             and s.effective_to > s.effective_from))
  order by s.stock_item_id, s.effective_from;
$$;

revoke execute on function public.month_dose_schedules(date) from public, anon;
grant execute on function public.month_dose_schedules(date) to authenticated;
