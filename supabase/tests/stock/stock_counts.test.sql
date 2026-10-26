-- Stock Counts: record_stock_count() sets a Stock Item's quantity to what was
-- counted and keeps the quantity before, in one transaction.
begin;
select plan(5);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.item', tests.make_stock_item(quantity => 30)::text, true);

-- a Stock Count sets quantity and records previous_quantity
select results_eq(
  $$ select counted_quantity, previous_quantity, counted_at from public.record_stock_count(
       stock_item_id => current_setting('test.item')::uuid, counted_quantity => 27) $$,
  $$ values (27::numeric, 30::numeric, '2026-03-10 09:00+02'::timestamptz) $$,
  'a Stock Count records the counted and previous quantity at now'
);

select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (27::numeric) $$,
  'a Stock Count sets quantity and records previous_quantity'
);

-- a Stock Count from a negative quantity works
update public.stock_items set quantity = -2.5 where id = current_setting('test.item')::uuid;

select results_eq(
  $$ select counted_quantity, previous_quantity from public.record_stock_count(
       stock_item_id => current_setting('test.item')::uuid, counted_quantity => 12) $$,
  $$ values (12::numeric, -2.5::numeric) $$,
  'a Stock Count from a negative quantity works'
);

select throws_ok(
  $$ select public.record_stock_count(
       stock_item_id => current_setting('test.item')::uuid, counted_quantity => -1) $$,
  '22023',
  null,
  'a counted quantity cannot be negative'
);

-- a stranger cannot count the owner's Stock Item
select tests.as_stranger();

select throws_ok(
  $$ select public.record_stock_count(
       stock_item_id => current_setting('test.item')::uuid, counted_quantity => 0) $$,
  'P0002',
  null,
  'a stranger cannot count the owner''s Stock Item'
);

select * from finish();
rollback;
