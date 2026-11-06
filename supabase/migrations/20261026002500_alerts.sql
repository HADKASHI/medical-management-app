-- The Alerts list: the source of truth for Alerts. It is derived, never
-- written, so an Alert trips and clears (and re-arms) the moment its condition
-- changes, through any write path. Phase B adds Authorization Alerts to it.
--
-- Low Stock: an unarchived Stock Item with quantity <= low_stock_threshold.
-- Negative stock raises no separate Alert; it reads as a prompt to count.

create view public.alerts
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
  s.quantity < 0 as needs_stock_count
from public.stock_items s
where s.archived_at is null
  and s.quantity <= s.low_stock_threshold;

-- Read under the caller's own RLS on stock_items (owner only, aal2).
revoke all on public.alerts from public, anon;
grant select on public.alerts to authenticated;
