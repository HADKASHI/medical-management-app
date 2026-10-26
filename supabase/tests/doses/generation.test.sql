-- Dose generation by app.tick() from active Dose Schedule versions, at their
-- Asia/Jerusalem wall-clock times.
begin;
select plan(7);

-- a daily schedule with 08:00 and 20:00 generates two Doses per day (earlier
-- ones become missed through the Confirmation Window, tested on its own)
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select tests.as_owner();
select tests.make_schedule(tests.make_stock_item(), times => '{08:00,20:00}');

select tests.tick_at('2026-01-05 08:00 Asia/Jerusalem');
select tests.tick_at('2026-01-05 20:00 Asia/Jerusalem');
select tests.tick_at('2026-01-06 08:00 Asia/Jerusalem');
select tests.tick_at('2026-01-06 20:00 Asia/Jerusalem');

select results_eq(
  $$ select due_at, amount from public.doses order by due_at $$,
  $$ values ('2026-01-05 08:00+02'::timestamptz, 1::numeric),
            ('2026-01-05 20:00+02'::timestamptz, 1::numeric),
            ('2026-01-06 08:00+02'::timestamptz, 1::numeric),
            ('2026-01-06 20:00+02'::timestamptz, 1::numeric) $$,
  'a daily schedule with 08:00 and 20:00 generates two Doses per day'
);

select tests.tick_at('2026-01-07 07:59 Asia/Jerusalem');
select is(
  (select count(*)::int from public.doses),
  4,
  'no Dose is generated before its due time'
);

-- a weekdays schedule generates Doses only on its weekdays
select tests.at('2026-01-04 07:00 Asia/Jerusalem');  -- a Sunday
select tests.make_schedule(
  tests.make_stock_item(name => 'Medication W'),
  pattern => 'weekdays', weekdays => '{1,3}'  -- Monday and Wednesday
);
select tests.tick_at((d::date + time '08:00') at time zone 'Asia/Jerusalem')
from generate_series('2026-01-04'::date, '2026-01-10', '1 day') d;

select results_eq(
  $$ select due_at from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication W')
     order by due_at $$,
  $$ values ('2026-01-05 08:00+02'::timestamptz), ('2026-01-07 08:00+02'::timestamptz) $$,
  'a weekdays schedule generates Doses only on its weekdays'
);

-- an every-N-days schedule counts from effective_from
select tests.at('2026-01-04 07:00 Asia/Jerusalem');
select tests.make_schedule(
  tests.make_stock_item(name => 'Medication N'),
  pattern => 'every_n_days', interval_days => 3, effective_from => '2026-01-06'
);
select tests.tick_at((d::date + time '08:00') at time zone 'Asia/Jerusalem')
from generate_series('2026-01-04'::date, '2026-01-15', '1 day') d;

select results_eq(
  $$ select due_at from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication N')
     order by due_at $$,
  $$ values ('2026-01-06 08:00+02'::timestamptz), ('2026-01-09 08:00+02'::timestamptz),
            ('2026-01-12 08:00+02'::timestamptz), ('2026-01-15 08:00+02'::timestamptz) $$,
  'an every-N-days schedule counts from effective_from'
);

-- an As Needed schedule generates no Doses
select tests.at('2026-01-04 07:00 Asia/Jerusalem');
select tests.make_schedule(
  tests.make_stock_item(name => 'Medication P'), times => '{}', pattern => 'as_needed'
);
select tests.tick_at((d::date + time '08:00') at time zone 'Asia/Jerusalem')
from generate_series('2026-01-04'::date, '2026-01-06', '1 day') d;

select is_empty(
  $$ select id from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication P') $$,
  'an As Needed schedule generates no Doses'
);

-- tick is idempotent: running it twice creates no duplicates
select tests.at('2026-02-01 07:00 Asia/Jerusalem');
select tests.make_schedule(tests.make_stock_item(name => 'Medication I'), times => '{09:00}');
select tests.tick_at('2026-02-01 09:00 Asia/Jerusalem');
select tests.tick_at('2026-02-01 09:00 Asia/Jerusalem');
select tests.tick_at('2026-02-01 09:01 Asia/Jerusalem');

select results_eq(
  $$ select due_at from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication I') $$,
  $$ values ('2026-02-01 09:00+02'::timestamptz) $$,
  'tick is idempotent: running it twice creates no duplicates'
);

-- an Archived Stock Item gets no new Doses
select tests.at('2026-02-01 07:00 Asia/Jerusalem');
select tests.make_schedule(tests.make_stock_item(name => 'Medication X'), times => '{08:00,20:00}');
select tests.tick_at('2026-02-01 08:00 Asia/Jerusalem');
select tests.at('2026-02-01 12:00 Asia/Jerusalem');
select public.archive_stock_item((select id from public.stock_items where name = 'Medication X'));
select tests.tick_at('2026-02-01 20:00 Asia/Jerusalem');
select tests.tick_at('2026-02-02 08:00 Asia/Jerusalem');

select results_eq(
  $$ select due_at from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication X') $$,
  $$ values ('2026-02-01 08:00+02'::timestamptz) $$,
  'an Archived Stock Item gets no new Doses'
);

select * from finish();
rollback;
