-- Settings and Authorization Alerts.
--
-- Settings: one app-wide row per owner, created on first save. Until then the
-- defaults apply. This slice holds the Authorization lead times; the Daily
-- Alert Time joins with the Daily Alert Time push.
--
-- Authorization Alerts join the Alerts list (public.alerts) through a
-- `union all`, with a nullable authorization_id. Like Low Stock they are
-- derived, never written: renewal, archive and an edited expires_on
-- re-evaluate at once.

-- Three whole days, strictly decreasing, each from 365 down to 0.
create or replace function app.valid_lead_days(lead_days smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(lead_days) = 3
    and array_position(lead_days, null) is null
    and lead_days[1] <= 365
    and lead_days[1] > lead_days[2]
    and lead_days[2] > lead_days[3]
    and lead_days[3] >= 0;
$$;

grant execute on function app.valid_lead_days(smallint[]) to authenticated, service_role;

create table public.settings (
  owner_id uuid primary key default auth.uid() references auth.users (id),
  -- days before expires_on: the Alert enters the list at the first and is
  -- pushed on each (pushes come with the Daily Alert Time push)
  authorization_lead_days smallint[] not null default '{30,7,0}'
    constraint authorization_lead_days_valid check (app.valid_lead_days(authorization_lead_days))
);

select app.protect_owned_table('public.settings');

-- The lead times in force for an owner: their saved setting, else the default.
create or replace function app.authorization_lead_days(owner uuid)
returns smallint[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    (select s.authorization_lead_days from public.settings s where s.owner_id = owner),
    '{30,7,0}'::smallint[]
  );
$$;

grant execute on function app.authorization_lead_days(uuid) to authenticated, service_role;

-- The Alerts list, now with Authorization Alerts.
--
-- Authorization: only current ones (neither renewed nor archived). With
-- `days_left` = expires_on minus today (Asia/Jerusalem), it is listed from the
-- first lead time on, at its current tier `lead_days` (the smallest lead time
-- not below days_left), and as Expired (`lead_days` null) after expires_on.
create or replace view public.alerts
with (security_invoker = true)
as
select
  'low_stock'::text as kind,
  s.id as stock_item_id,
  concat_ws(' ', s.name, s.strength) || ': ' ||
    case
      when s.quantity < 0
        then trim_scale(s.quantity)::text || ' ' || s.unit || ', do a Stock Count'
      else trim_scale(s.quantity)::text || ' ' || s.unit || ' left'
    end as message,
  s.quantity < 0 as needs_stock_count,
  null::uuid as authorization_id,
  null::int as lead_days
from public.stock_items s
where s.archived_at is null
  and s.quantity <= s.low_stock_threshold

union all

select
  case when d.days_left < 0 then 'authorization_expired' else 'authorization_expiring' end,
  a.stock_item_id,
  case a.type
    when 'prescription' then 'Prescription'
    when 'form_17' then 'Form 17'
    when 'commitment' then 'Commitment'
  end || ' ' || a.reference_number || ': ' ||
    case
      when d.days_left < 0 then 'Expired'
      when d.days_left = 0 then 'expires today'
      when d.days_left = 1 then 'expires tomorrow'
      else 'expires in ' || d.days_left || ' days'
    end,
  false,
  a.id,
  case when d.days_left >= 0 then
    (select min(l) from unnest(d.lead) l where l >= d.days_left)::int
  end
from public.authorizations a
cross join lateral (
  select
    a.expires_on - (app.now() at time zone app.time_zone())::date as days_left,
    app.authorization_lead_days(a.owner_id) as lead
) d
where a.archived_at is null
  and not a.renewed
  and d.days_left <= d.lead[1];

-- Read under the caller's own RLS on each source table (owner only, aal2).
revoke all on public.alerts from public, anon;
grant select on public.alerts to authenticated;
