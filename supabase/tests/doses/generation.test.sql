-- Dose generation by app.tick() from active Dose Schedule versions, at their
-- Asia/Jerusalem wall-clock times.
begin;
select plan(2);

-- a daily schedule with 08:00 and 20:00 generates two pending Doses per day
select tests.at('2026-01-05 07:00 Asia/Jerusalem');
select tests.as_owner();
select tests.make_schedule(tests.make_stock_item(), times => '{08:00,20:00}');

select tests.tick_at('2026-01-05 08:00 Asia/Jerusalem');
select tests.tick_at('2026-01-05 20:00 Asia/Jerusalem');
select tests.tick_at('2026-01-06 08:00 Asia/Jerusalem');
select tests.tick_at('2026-01-06 20:00 Asia/Jerusalem');

select results_eq(
  $$ select due_at, status::text, amount from public.doses order by due_at $$,
  $$ values ('2026-01-05 08:00+02'::timestamptz, 'pending', 1::numeric),
            ('2026-01-05 20:00+02'::timestamptz, 'pending', 1::numeric),
            ('2026-01-06 08:00+02'::timestamptz, 'pending', 1::numeric),
            ('2026-01-06 20:00+02'::timestamptz, 'pending', 1::numeric) $$,
  'a daily schedule with 08:00 and 20:00 generates two pending Doses per day'
);

select tests.tick_at('2026-01-07 07:59 Asia/Jerusalem');
select is(
  (select count(*)::int from public.doses),
  4,
  'no Dose is generated before its due time'
);

select * from finish();
rollback;
