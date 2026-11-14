-- Low Stock Alert: listed in public.alerts while quantity <= threshold, and
-- gone as soon as quantity rises above it. The list is read, never written.
begin;
select plan(11);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.item', tests.make_stock_item(name => 'Medication A', quantity => 5)::text, true);
update public.stock_items set low_stock_threshold = 5
where id = current_setting('test.item')::uuid;

select results_eq(
  $$ select kind, stock_item_id, message, needs_stock_count from public.alerts $$,
  $$ values ('low_stock'::text, current_setting('test.item')::uuid,
             'Medication A: 5 pills left'::text, false) $$,
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
  $$ values (current_setting('test.item')::uuid, 'Medication A: 6 pills left'::text) $$,
  'raising the threshold above quantity trips it'
);

-- A taken Dose that wasn't in stock leaves quantity negative.
select tests.set_quantity(current_setting('test.item')::uuid, -2);

select results_eq(
  $$ select message, needs_stock_count from public.alerts $$,
  $$ values ('Medication A: -2 pills, do a Stock Count'::text, true) $$,
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

-- the Unit is pluralised for any quantity but 1, except ml (or a Unit already ending in s)
insert into public.stock_items (name, kind, unit, quantity, low_stock_threshold) values
  ('Medication D', 'medication', 'pill', 1, 5),
  ('Medication E', 'medication', 'pill', 4, 5),
  ('Medication F', 'medication', 'ml', 0.5, 5),
  ('Supply G', 'supply', 'pieces', 3, 5);

select results_eq(
  $$ select message from public.alerts order by message $$,
  $$ values ('Medication D: 1 pill left'::text),
            ('Medication E: 4 pills left'::text),
            ('Medication F: 0.5 ml left'::text),
            ('Supply G: 3 pieces left'::text) $$,
  'the Unit is pluralised for any quantity but 1, except ml'
);
select tests.set_quantity((select id from public.stock_items where name = 'Medication F'), -2);
select results_eq(
  $$ select message from public.alerts where message like 'Medication F%' $$,
  $$ values ('Medication F: -2 ml, do a Stock Count'::text) $$,
  'ml stays singular when negative'
);
select tests.set_quantity((select id from public.stock_items where name = 'Medication D'), 0);
select results_eq(
  $$ select message from public.alerts where message like 'Medication D%' $$,
  $$ values ('Medication D: 0 pills left'::text) $$,
  'zero is plural'
);
select tests.set_quantity((select id from public.stock_items where name = 'Medication E'), 1.5);
select results_eq(
  $$ select message from public.alerts where message like 'Medication E%' $$,
  $$ values ('Medication E: 1.5 pills left'::text) $$,
  'a fractional quantity is plural'
);

select tests.make_stock_item(name => 'Medication B', quantity => 0);
select tests.as_stranger();

select is_empty(
  $$ select 1 from public.alerts $$,
  'a stranger sees none of the owner''s Alerts'
);

select * from finish();
rollback;
