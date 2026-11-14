-- Low Stock Alert text with the Unit pluralised: "4 pills left", "1 pill
-- left", "-2 pills, do a Stock Count". The rest of the Alerts list is as in
-- 20261027003100_authorization_alerts.sql.

-- A quantity and its Unit, with an "s" added for any quantity but exactly 1,
-- except for ml and for a Unit that already ends in "s" ("0.5 ml", "3 pieces").
create or replace function app.quantity_with_unit(quantity numeric, unit text)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.trim_scale(quantity)::text || ' ' || unit ||
    case
      when quantity = 1 or lower(unit) = 'ml' or right(lower(unit), 1) = 's' then ''
      else 's'
    end;
$$;

grant execute on function app.quantity_with_unit(numeric, text) to authenticated, service_role;

create or replace view public.alerts
with (security_invoker = true)
as
select
  'low_stock'::text as kind,
  s.id as stock_item_id,
  concat_ws(' ', s.name, s.strength) || ': ' ||
    app.quantity_with_unit(s.quantity, s.unit) ||
      case when s.quantity < 0 then ', do a Stock Count' else ' left' end as message,
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
