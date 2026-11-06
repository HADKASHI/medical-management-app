-- Archiving a Stock Item marks its pending Doses skipped and leaves its
-- answered Doses, other items' Doses and quantity alone.
begin;
select plan(3);

select tests.as_owner();
select tests.at('2026-01-04 12:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item(name => 'Medication A', quantity => 10)::text, true);
select set_config('test.other', tests.make_stock_item(name => 'Medication B')::text, true);
select tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00,12:00,20:00}',
  effective_from => '2026-01-05');
select tests.make_schedule(current_setting('test.other')::uuid, times => '{08:00}',
  effective_from => '2026-01-05');
select tests.tick_at('2026-01-05 12:00 Asia/Jerusalem');

select tests.at('2026-01-05 12:05 Asia/Jerusalem');
select public.set_dose_status(
  dose_id => (select id from public.doses
              where stock_item_id = current_setting('test.item')::uuid
                and due_at = '2026-01-05 08:00+02'),
  status => 'taken');

select tests.at('2026-01-05 12:10 Asia/Jerusalem');
select public.archive_stock_item(current_setting('test.item')::uuid);

select results_eq(
  $$ select due_at, status::text, status_changed_at from public.doses
     where stock_item_id = current_setting('test.item')::uuid order by due_at $$,
  $$ values ('2026-01-05 08:00+02'::timestamptz, 'taken', '2026-01-05 12:05+02'::timestamptz),
            ('2026-01-05 12:00+02'::timestamptz, 'skipped', '2026-01-05 12:10+02'::timestamptz) $$,
  'archiving a Stock Item marks its pending Doses skipped'
);

select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (9::numeric) $$,
  'archiving does not change quantity'
);

select results_eq(
  $$ select status::text from public.doses where stock_item_id = current_setting('test.other')::uuid $$,
  $$ values ('pending') $$,
  'archiving leaves other items'' Doses alone'
);

select * from finish();
rollback;
