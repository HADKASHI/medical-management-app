-- Confirming Doses: set_dose_status() and take_doses() change a Dose's status
-- and the Stock Item's quantity together; moving out of taken gives the Units back.
begin;
select plan(16);

select tests.as_owner();
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item(quantity => 10)::text, true);
select tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00,20:00}');
select tests.tick_at('2026-01-05 20:00 Asia/Jerusalem');
select set_config('test.morning',
  (select id from public.doses where due_at = '2026-01-05 08:00+02')::text, true);
select set_config('test.evening',
  (select id from public.doses where due_at = '2026-01-05 20:00+02')::text, true);

create temporary view item_quantity as
select quantity from public.stock_items where id = current_setting('test.item')::uuid;

-- taking a Dose reduces quantity by its amount
select tests.at('2026-01-05 08:05 Asia/Jerusalem');
select results_eq(
  $$ select status::text, taken_at, status_changed_at from public.set_dose_status(
       dose_id => current_setting('test.morning')::uuid, status => 'taken') $$,
  $$ values ('taken', '2026-01-05 08:05+02'::timestamptz, '2026-01-05 08:05+02'::timestamptz) $$,
  'a taken Dose records when it was taken'
);
select results_eq(
  'select quantity from item_quantity',
  $$ values (9::numeric) $$,
  'taking a Dose reduces quantity by its amount'
);

-- undoing taken restores quantity
select results_eq(
  $$ select status::text, taken_at from public.set_dose_status(
       dose_id => current_setting('test.morning')::uuid, status => 'pending') $$,
  $$ values ('pending', null::timestamptz) $$,
  'an undone Dose is pending again'
);
select results_eq(
  'select quantity from item_quantity',
  $$ values (10::numeric) $$,
  'undoing taken restores quantity'
);

-- skipping a Dose leaves quantity unchanged
select results_eq(
  $$ select status::text, taken_at from public.set_dose_status(
       dose_id => current_setting('test.morning')::uuid, status => 'skipped') $$,
  $$ values ('skipped', null::timestamptz) $$,
  'a skipped Dose is recorded as skipped'
);
select results_eq(
  'select quantity from item_quantity',
  $$ values (10::numeric) $$,
  'skipping a Dose leaves quantity unchanged'
);

-- skipping a taken Dose gives its units back
select public.set_dose_status(current_setting('test.evening')::uuid, 'taken');
select public.set_dose_status(current_setting('test.evening')::uuid, 'skipped');
select results_eq(
  'select quantity from item_quantity',
  $$ values (10::numeric) $$,
  'skipping a taken Dose gives its units back'
);

select throws_ok(
  $$ select public.set_dose_status(current_setting('test.evening')::uuid, 'missed') $$,
  '22023',
  null,
  'only the Confirmation Window marks a Dose missed'
);

-- All taken takes every listed pending Dose in one transaction
select tests.at('2026-01-06 07:00 Asia/Jerusalem');
select set_config('test.other', tests.make_stock_item(name => 'Medication B', quantity => 5)::text, true);
select tests.make_schedule(current_setting('test.other')::uuid, times => '{08:00}');
select tests.tick_at('2026-01-06 08:00 Asia/Jerusalem');
select tests.at('2026-01-06 08:10 Asia/Jerusalem');

select results_eq(
  $$ select count(*)::int from public.take_doses(
       (select array_agg(id) from public.doses where due_at = '2026-01-06 08:00+02')) $$,
  $$ values (2) $$,
  'All taken takes every listed pending Dose'
);
select results_eq(
  $$ select s.name, s.quantity, d.status::text, d.taken_at
     from public.doses d join public.stock_items s on s.id = d.stock_item_id
     where d.due_at = '2026-01-06 08:00+02' order by s.name $$,
  $$ values ('Medication A', 9::numeric, 'taken', '2026-01-06 08:10+02'::timestamptz),
            ('Medication B', 4::numeric, 'taken', '2026-01-06 08:10+02'::timestamptz) $$,
  'All taken takes every listed pending Dose in one transaction'
);

select results_eq(
  $$ select count(*)::int from public.take_doses(array[current_setting('test.morning')::uuid]) $$,
  $$ values (0) $$,
  'All taken leaves an already answered Dose as it is'
);

-- logging an As Needed Dose creates it as taken and reduces quantity
select set_config('test.as_needed', tests.make_stock_item(name => 'Medication C', quantity => 3)::text, true);
select tests.make_schedule(current_setting('test.as_needed')::uuid, times => '{}', pattern => 'as_needed');
select tests.at('2026-01-06 14:30 Asia/Jerusalem');

select results_eq(
  $$ select status::text, amount, taken_at, due_at, dose_schedule_id
     from public.log_as_needed_dose(
       stock_item_id => current_setting('test.as_needed')::uuid, amount => 2) $$,
  $$ values ('taken', 2::numeric, '2026-01-06 14:30+02'::timestamptz, null::timestamptz, null::uuid) $$,
  'logging an As Needed Dose creates it as taken'
);
select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.as_needed')::uuid $$,
  $$ values (1::numeric) $$,
  'logging an As Needed Dose reduces quantity'
);

-- taking a Dose may make quantity negative
select public.log_as_needed_dose(current_setting('test.as_needed')::uuid, 2);
select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.as_needed')::uuid $$,
  $$ values (-1::numeric) $$,
  'taking a Dose may make quantity negative'
);

-- a stranger cannot confirm the owner's Doses
select tests.as_stranger();
select throws_ok(
  $$ select public.set_dose_status(current_setting('test.evening')::uuid, 'taken') $$,
  'P0002',
  null,
  'a stranger cannot confirm the owner''s Dose'
);
select throws_ok(
  $$ select public.log_as_needed_dose(current_setting('test.as_needed')::uuid, 1) $$,
  'P0002',
  null,
  'a stranger cannot log a Dose of the owner''s medication'
);

select * from finish();
rollback;
