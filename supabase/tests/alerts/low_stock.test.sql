-- Low Stock Alert: listed in public.alerts while quantity <= threshold, and
-- gone as soon as quantity rises above it. The list is read, never written.
begin;
select plan(7);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.item', tests.make_stock_item(name => 'Medication A', quantity => 5)::text, true);
update public.stock_items set low_stock_threshold = 5
where id = current_setting('test.item')::uuid;

select results_eq(
  $$ select kind, stock_item_id, message, needs_stock_count from public.alerts $$,
  $$ values ('low_stock'::text, current_setting('test.item')::uuid,
             'Medication A: 5 pill left'::text, false) $$,
  'an item at its threshold is in the Alerts list'
);

select public.record_restock(stock_item_id => current_setting('test.item')::uuid, quantity => 1);

select is_empty(
  $$ select 1 from public.alerts $$,
  'a Restock above the threshold clears it'
);

update public.stock_items set low_stock_threshold = 10
where id = current_setting('test.item')::uuid;

select results_eq(
  $$ select stock_item_id, message from public.alerts $$,
  $$ values (current_setting('test.item')::uuid, 'Medication A: 6 pill left'::text) $$,
  'raising the threshold above quantity trips it'
);

-- A taken Dose that wasn't in stock leaves quantity negative.
update public.stock_items set quantity = -2
where id = current_setting('test.item')::uuid;

select results_eq(
  $$ select message, needs_stock_count from public.alerts $$,
  $$ values ('Medication A: -2 pill, do a Stock Count'::text, true) $$,
  'a negative quantity reads as "do a Stock Count"'
);

select public.record_stock_count(stock_item_id => current_setting('test.item')::uuid, counted_quantity => 11);

select is_empty(
  $$ select 1 from public.alerts $$,
  'a Stock Count above the threshold clears it'
);

select public.record_stock_count(stock_item_id => current_setting('test.item')::uuid, counted_quantity => 0);
select public.archive_stock_item(current_setting('test.item')::uuid);

select is_empty(
  $$ select 1 from public.alerts $$,
  'an Archived item is not listed'
);

select tests.make_stock_item(name => 'Medication B', quantity => 0);
select tests.as_stranger();

select is_empty(
  $$ select 1 from public.alerts $$,
  'a stranger sees none of the owner''s Alerts'
);

select * from finish();
rollback;
