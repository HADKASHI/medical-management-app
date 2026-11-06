-- Reports, Renewals tab: every current Authorization (one nobody renews,
-- archived ones included) with its chain of predecessors and the Restocks
-- filled under each, read under the owner's RLS (security invoker). No report
-- tables or aggregates (ADR 0002); the client groups rows by current_id and
-- applies the Stock Item filter.
--
-- One row per Authorization in a chain: depth 0 is the current one, 1 the
-- one it renewed, and so on back to the oldest. Chains are ordered newest
-- expiry first. Restocks with no Authorization are not part of any chain.
create or replace function public.renewal_chains()
returns table (
  current_id uuid,
  depth int,
  id uuid,
  type public.authorization_type,
  reference_number text,
  covers text,
  stock_item_id uuid,
  issued_on date,
  expires_on date,
  archived_at timestamptz,
  renewed boolean,
  -- [{id, restocked_on, quantity, unit}], newest first
  restocks jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with recursive chain as (
    select a.id as current_id, a.expires_on as current_expires_on, 0 as depth, a.*
    from public.authorizations a
    where not exists (
      select 1 from public.authorizations r where r.renews_authorization_id = a.id
    )
    union all
    select c.current_id, c.current_expires_on, c.depth + 1, p.*
    from chain c
    join public.authorizations p on p.id = c.renews_authorization_id
  )
  select c.current_id, c.depth, c.id, c.type, c.reference_number, c.covers,
         c.stock_item_id, c.issued_on, c.expires_on, c.archived_at, c.depth > 0,
         coalesce(
           (select jsonb_agg(jsonb_build_object(
                     'id', r.id, 'restocked_on', r.restocked_on,
                     'quantity', r.quantity, 'unit', s.unit)
                   order by r.restocked_on desc, r.created_at desc)
            from public.restocks r
            join public.stock_items s on s.id = r.stock_item_id
            where r.authorization_id = c.id),
           '[]'::jsonb)
  from chain c
  order by c.current_expires_on desc, c.current_id, c.depth;
$$;

revoke execute on function public.renewal_chains() from public, anon;
grant execute on function public.renewal_chains() to authenticated;
