-- Dose generation on the daylight-saving days in Asia/Jerusalem (2026):
-- spring forward Fri 27 March 02:00 -> 03:00, fall back Sun 25 October
-- 02:00 -> 01:00.
begin;
select plan(4);

select tests.as_owner();

-- spring forward: 02:30 becomes 03:30
select tests.at('2026-03-26 12:00 Asia/Jerusalem');
select tests.make_schedule(tests.make_stock_item(name => 'Medication S'), times => '{02:30}');
select tests.tick_at('2026-03-27 01:59+02');
select tests.tick_at('2026-03-27 03:29+03');

select is_empty(
  $$ select id from public.doses $$,
  'spring forward: no Dose before 03:30'
);

select tests.tick_at('2026-03-27 03:30+03');
select tests.tick_at('2026-03-27 03:31+03');

select results_eq(
  $$ select due_at from public.doses $$,
  $$ values ('2026-03-27 03:30+03'::timestamptz) $$,
  'spring forward: 02:30 becomes 03:30'
);

-- fall back: a repeated time gets one Dose, at the later occurrence
select tests.at('2026-10-24 12:00 Asia/Jerusalem');
select tests.make_schedule(tests.make_stock_item(name => 'Medication F'), times => '{01:30}');
select tests.tick_at('2026-10-25 01:30+03');  -- the first 01:30, still summer time

select is_empty(
  $$ select id from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication F') $$,
  'fall back: no Dose at the first occurrence'
);

select tests.tick_at('2026-10-25 01:30+02');  -- the second 01:30, winter time
select tests.tick_at('2026-10-25 01:31+02');
select tests.tick_at('2026-10-25 02:30+02');

select results_eq(
  $$ select due_at from public.doses
     where stock_item_id = (select id from public.stock_items where name = 'Medication F') $$,
  $$ values ('2026-10-25 01:30+02'::timestamptz) $$,
  'fall back: a repeated time gets one Dose, at the later occurrence'
);

select * from finish();
rollback;
