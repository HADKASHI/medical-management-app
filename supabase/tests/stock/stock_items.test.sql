-- Stock Items: create, edit, archive, owner-only.
begin;
select plan(12);

-- a Stock Item can be created and edited by the owner only
select tests.as_owner();

select lives_ok(
  $$ insert into public.stock_items (name, kind, strength, unit, quantity, low_stock_threshold, pack_size)
     values ('Medication A', 'medication', '50 mg', 'pill', 30, 10, 30) $$,
  'the owner can create a Stock Item'
);

select results_eq(
  $$ update public.stock_items set name = 'Medication B', low_stock_threshold = 5
     returning name, low_stock_threshold $$,
  $$ values ('Medication B'::text, 5::numeric) $$,
  'the owner can edit a Stock Item'
);

select tests.as_stranger();

select is_empty(
  $$ update public.stock_items set name = 'Medication C' returning id $$,
  'a stranger cannot edit the owner''s Stock Item'
);

select throws_ok(
  $$ insert into public.stock_items (owner_id, name, kind, unit, quantity, low_stock_threshold)
     values ('00000000-0000-4000-8000-00000000000a', 'Supply A', 'supply', 'strip', 50, 10) $$,
  '42501',
  null,
  'a stranger cannot create a Stock Item for the owner'
);

select tests.as_owner();
select set_config('test.medication_id', (select id::text from public.stock_items), true);
select tests.as_stranger();

select is_empty(
  $$ select id from public.archive_stock_item(current_setting('test.medication_id')::uuid)
     where id is not null $$,
  'a stranger cannot archive the owner''s Stock Item'
);

-- strength is rejected on a supply
select tests.as_owner();

select throws_ok(
  $$ insert into public.stock_items (name, kind, strength, unit, quantity, low_stock_threshold)
     values ('Supply A', 'supply', '50 mg', 'strip', 50, 10) $$,
  '23514',
  null,
  'strength is rejected on a supply'
);

select lives_ok(
  $$ insert into public.stock_items (name, kind, unit, quantity, low_stock_threshold)
     values ('Supply A', 'supply', 'strip', 50, 10) $$,
  'a supply without strength is accepted'
);

select throws_ok(
  $$ update public.stock_items set strength = '5 mg' where name = 'Supply A' $$,
  '23514',
  null,
  'strength cannot be added to an existing supply'
);

-- an Archived item keeps its row and has archived_at set
select tests.at('2026-03-10 09:00+02');

select results_eq(
  $$ select archived_at from public.archive_stock_item(
       (select id from public.stock_items where name = 'Supply A')) $$,
  $$ values ('2026-03-10 09:00+02'::timestamptz) $$,
  'archiving returns the item with archived_at set to now'
);

select results_eq(
  $$ select name, archived_at from public.stock_items where name = 'Supply A' $$,
  $$ values ('Supply A'::text, '2026-03-10 09:00+02'::timestamptz) $$,
  'an Archived item keeps its row and has archived_at set'
);

select tests.at('2026-03-11 09:00+02');

select results_eq(
  $$ select archived_at from public.archive_stock_item(
       (select id from public.stock_items where name = 'Supply A')) $$,
  $$ values ('2026-03-10 09:00+02'::timestamptz) $$,
  'archiving an Archived item keeps the first archived_at'
);

-- quantity may be negative
select results_eq(
  $$ update public.stock_items set quantity = -2.5 where name = 'Medication B' returning quantity $$,
  $$ values (-2.5::numeric) $$,
  'quantity may be negative'
);

select * from finish();
rollback;
