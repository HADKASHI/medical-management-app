-- Restocks: record_restock() adds Units to a Stock Item's quantity and keeps
-- the Restock row, in one transaction.
begin;
select plan(9);

select tests.as_owner();
select tests.at('2026-03-10 09:00+02');
select set_config('test.item', tests.make_stock_item(quantity => 4)::text, true);

-- a Restock adds its units to quantity in one transaction
select results_eq(
  $$ select quantity, restocked_on, note from public.record_restock(
       stock_item_id => current_setting('test.item')::uuid,
       quantity => 30,
       restocked_on => '2026-03-09',
       note => 'Pharmacy A') $$,
  $$ values (30::numeric, '2026-03-09'::date, 'Pharmacy A'::text) $$,
  'a Restock is recorded with its Units, date and note'
);

select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (34::numeric) $$,
  'a Restock adds its units to quantity in one transaction'
);

select throws_ok(
  $$ select public.record_restock(
       stock_item_id => current_setting('test.item')::uuid, quantity => 0) $$,
  '22023',
  null,
  'a Restock must add a positive number of Units'
);

-- a Restock entered as 2 packs of 30 adds 60 units
update public.stock_items set quantity = 4, pack_size = 30
where id = current_setting('test.item')::uuid;

select results_eq(
  $$ select quantity from public.record_restock(
       stock_item_id => current_setting('test.item')::uuid, packs => 2) $$,
  $$ values (60::numeric) $$,
  'a Restock entered in packs is recorded in Units'
);

select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (64::numeric) $$,
  'a Restock entered as 2 packs of 30 adds 60 units'
);

select throws_ok(
  $$ select public.record_restock(
       stock_item_id => current_setting('test.item')::uuid, quantity => 30, packs => 1) $$,
  '22023',
  null,
  'a Restock is entered in Units or in packs, not both'
);

-- packs need a Pack Size; a rejected Restock leaves quantity unchanged
select set_config('test.no_pack', tests.make_stock_item('Supply A', 'supply', 10)::text, true);

select throws_ok(
  $$ select public.record_restock(
       stock_item_id => current_setting('test.no_pack')::uuid, packs => 2) $$,
  '22023',
  null,
  'a Restock in packs needs the Stock Item''s Pack Size'
);

select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.no_pack')::uuid $$,
  $$ values (10::numeric) $$,
  'a rejected Restock leaves quantity unchanged'
);

-- a stranger cannot restock the owner's Stock Item
select tests.as_stranger();

select throws_ok(
  $$ select public.record_restock(
       stock_item_id => current_setting('test.item')::uuid, quantity => 30) $$,
  'P0002',
  null,
  'a stranger cannot restock the owner''s Stock Item'
);

select * from finish();
rollback;
