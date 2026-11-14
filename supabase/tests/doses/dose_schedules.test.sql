-- Dose Schedules are versioned and saved through save_dose_schedule().
begin;
select plan(9);

select tests.as_owner();
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item()::text, true);
select set_config('test.v1', tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00,20:00}')::text, true);
select tests.tick_at('2026-01-05 08:00 Asia/Jerusalem');

-- editing a schedule ends the old version, and existing Doses keep pointing at it
select tests.at('2026-01-05 12:00 Asia/Jerusalem');
select set_config('test.v2', tests.make_schedule(current_setting('test.item')::uuid, times => '{21:00}')::text, true);
select tests.tick_at('2026-01-05 21:00 Asia/Jerusalem');

select results_eq(
  $$ select id, effective_from, effective_to from public.dose_schedules order by effective_to nulls last $$,
  $$ values (current_setting('test.v1')::uuid, '2026-01-05'::date, '2026-01-05'::date),
            (current_setting('test.v2')::uuid, '2026-01-05'::date, null::date) $$,
  'editing a schedule ends the old version and starts a new one'
);

select results_eq(
  $$ select dose_schedule_id, due_at from public.doses order by due_at $$,
  $$ values (current_setting('test.v1')::uuid, '2026-01-05 08:00+02'::timestamptz),
            (current_setting('test.v2')::uuid, '2026-01-05 21:00+02'::timestamptz) $$,
  'editing a schedule ends the old version, and existing Doses keep pointing at it'
);

-- a new version generates no Dose due before it was saved
select tests.at('2026-01-06 10:00 Asia/Jerusalem');
select tests.make_schedule(current_setting('test.item')::uuid, times => '{09:00,22:00}');
select tests.tick_at('2026-01-06 22:00 Asia/Jerusalem');

select results_eq(
  $$ select due_at from public.doses where due_at >= '2026-01-06' order by due_at $$,
  $$ values ('2026-01-06 22:00+02'::timestamptz) $$,
  'a new version generates no Dose due before it was saved'
);

-- a version starting later keeps the old one in force until then
select tests.at('2026-01-07 07:00 Asia/Jerusalem');
select tests.make_schedule(current_setting('test.item')::uuid, times => '{07:30}', effective_from => '2026-01-09');
select tests.tick_at((d::date + t) at time zone 'Asia/Jerusalem')
from generate_series('2026-01-07'::date, '2026-01-09', '1 day') d, (values (time '07:30'), (time '22:00')) v (t);

select results_eq(
  $$ select (due_at at time zone 'Asia/Jerusalem')::text from public.doses
     where due_at >= '2026-01-07' order by due_at $$,
  $$ values ('2026-01-07 09:00:00'), ('2026-01-07 22:00:00'),
            ('2026-01-08 09:00:00'), ('2026-01-08 22:00:00'),
            ('2026-01-09 07:30:00') $$,
  'a version starting later keeps the old one in force until then'
);

-- only medications have Dose Schedules
select throws_ok(
  $$ select tests.make_schedule(tests.make_stock_item(name => 'Supply A', kind => 'supply')) $$,
  '22023',
  'Only medications have Dose Schedules',
  'only medications have Dose Schedules'
);

-- As Needed has no Dose Times; the other patterns need at least one
select throws_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00}', pattern => 'as_needed') $$,
  '22023',
  'An As Needed schedule has no Dose Times',
  'an As Needed schedule takes no Dose Times'
);

select throws_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid, times => '{}') $$,
  '22023',
  'A schedule needs at least one Dose Time',
  'a daily schedule needs at least one Dose Time'
);

select throws_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid, effective_from => '2026-01-06') $$,
  '22023',
  'A schedule cannot start in the past',
  'a schedule cannot start in the past'
);

-- a stranger cannot save a schedule for the owner's Stock Item
select tests.as_stranger();

select throws_ok(
  $$ select tests.make_schedule(current_setting('test.item')::uuid) $$,
  'P0002',
  'Stock Item not found',
  'a stranger cannot save a schedule for the owner''s Stock Item'
);

select * from finish();
rollback;
