-- The Confirmation Window: app.tick() marks a pending Dose missed at the
-- earlier of 24 hours after due_at or the due_at of the next Dose of the same
-- Stock Item.
begin;
select plan(12);

select tests.as_owner();

-- a Dose pending 24 h becomes missed (every other day: the next Dose is 48 h on)
select tests.at('2026-01-04 12:00 Asia/Jerusalem');
select set_config('test.item', tests.make_stock_item(name => 'Medication A', quantity => 10)::text, true);
select tests.make_schedule(current_setting('test.item')::uuid, times => '{08:00}',
  pattern => 'every_n_days', interval_days => 2, effective_from => '2026-01-05');
select tests.tick_at('2026-01-05 08:00 Asia/Jerusalem');
select tests.tick_at('2026-01-06 07:59 Asia/Jerusalem');

select results_eq(
  $$ select status::text from public.doses where stock_item_id = current_setting('test.item')::uuid $$,
  $$ values ('pending') $$,
  'a Dose is still pending just under 24 h after it was due'
);

select tests.tick_at('2026-01-06 08:00 Asia/Jerusalem');

select results_eq(
  $$ select status::text, status_changed_at from public.doses
     where stock_item_id = current_setting('test.item')::uuid $$,
  $$ values ('missed', '2026-01-06 08:00+02'::timestamptz) $$,
  'a Dose pending 24 h becomes missed'
);

-- becoming missed does not change quantity
select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (10::numeric) $$,
  'becoming missed does not change quantity'
);

-- a Dose becomes missed when the next Dose of the same item is due, if sooner
select tests.at('2026-01-04 12:00 Asia/Jerusalem');
select set_config('test.twice', tests.make_stock_item(name => 'Medication B')::text, true);
select set_config('test.other', tests.make_stock_item(name => 'Medication C')::text, true);
select tests.make_schedule(current_setting('test.twice')::uuid, times => '{08:00,20:00}',
  effective_from => '2026-01-05');
select tests.make_schedule(current_setting('test.other')::uuid, times => '{12:00}',
  effective_from => '2026-01-05');
select tests.tick_at('2026-01-05 19:59 Asia/Jerusalem');

select results_eq(
  $$ select status::text from public.doses
     where stock_item_id = current_setting('test.twice')::uuid order by due_at $$,
  $$ values ('pending') $$,
  'a Dose of another item does not end the window'
);

select tests.tick_at('2026-01-05 20:00 Asia/Jerusalem');

select results_eq(
  $$ select due_at, status::text from public.doses
     where stock_item_id = current_setting('test.twice')::uuid order by due_at $$,
  $$ values ('2026-01-05 08:00+02'::timestamptz, 'missed'),
            ('2026-01-05 20:00+02'::timestamptz, 'pending') $$,
  'a Dose becomes missed when the next Dose of the same item is due, if that is sooner'
);

-- a missed Dose changed to taken reduces quantity
select tests.at('2026-01-06 09:00 Asia/Jerusalem');
select results_eq(
  $$ select status::text, taken_at from public.set_dose_status(
       dose_id => (select id from public.doses
                   where stock_item_id = current_setting('test.item')::uuid),
       status => 'taken') $$,
  $$ values ('taken', '2026-01-06 09:00+02'::timestamptz) $$,
  'a missed Dose can still be changed to taken'
);
select results_eq(
  $$ select quantity from public.stock_items where id = current_setting('test.item')::uuid $$,
  $$ values (9::numeric) $$,
  'a missed Dose changed to taken reduces quantity'
);

-- Daylight-saving days in Asia/Jerusalem (2026): spring forward Fri 27 March
-- 02:00 -> 03:00 (a 23-hour day), fall back Sun 25 October 02:00 -> 01:00
-- (a 25-hour day). The 24 hours are real hours, not one calendar day.

-- spring forward: a daily Dose's next Dose is 23 h on, so that ends the window
select tests.at('2026-03-25 12:00 Asia/Jerusalem');
select set_config('test.spring', tests.make_stock_item(name => 'Medication S')::text, true);
select tests.make_schedule(current_setting('test.spring')::uuid, times => '{08:00}',
  effective_from => '2026-03-26');
select tests.tick_at('2026-03-26 08:00+02');
select tests.tick_at('2026-03-27 07:59+03');
select tests.tick_at('2026-03-27 08:00+03');

select results_eq(
  $$ select due_at, status::text, status_changed_at from public.doses
     where stock_item_id = current_setting('test.spring')::uuid order by due_at $$,
  $$ values ('2026-03-26 08:00+02'::timestamptz, 'missed', '2026-03-27 08:00+03'::timestamptz),
            ('2026-03-27 08:00+03'::timestamptz, 'pending', '2026-03-27 08:00+03'::timestamptz) $$,
  'spring forward: a daily Dose becomes missed at the next Dose, 23 h later'
);

-- spring forward: 24 h after 12:00 is 13:00 summer time the next day
select tests.at('2026-03-25 12:00 Asia/Jerusalem');
select set_config('test.spring2', tests.make_stock_item(name => 'Medication T')::text, true);
select tests.make_schedule(current_setting('test.spring2')::uuid, times => '{12:00}',
  pattern => 'every_n_days', interval_days => 2, effective_from => '2026-03-26');
select tests.tick_at('2026-03-26 12:00+02');
select tests.tick_at('2026-03-27 12:59+03');

select results_eq(
  $$ select status::text from public.doses where stock_item_id = current_setting('test.spring2')::uuid $$,
  $$ values ('pending') $$,
  'spring forward: a Dose is still pending 23 h 59 min after it was due'
);

select tests.tick_at('2026-03-27 13:00+03');

select results_eq(
  $$ select status::text from public.doses where stock_item_id = current_setting('test.spring2')::uuid $$,
  $$ values ('missed') $$,
  'spring forward: a Dose becomes missed 24 h after it was due'
);

-- fall back: a daily Dose's next Dose is 25 h on, so 24 h ends the window first
select tests.at('2026-10-23 12:00 Asia/Jerusalem');
select set_config('test.fall', tests.make_stock_item(name => 'Medication F')::text, true);
select tests.make_schedule(current_setting('test.fall')::uuid, times => '{08:00}',
  effective_from => '2026-10-24');
select tests.tick_at('2026-10-24 08:00+03');
select tests.tick_at('2026-10-25 06:59+02');

select results_eq(
  $$ select status::text from public.doses where stock_item_id = current_setting('test.fall')::uuid $$,
  $$ values ('pending') $$,
  'fall back: a daily Dose is still pending 23 h 59 min after it was due'
);

select tests.tick_at('2026-10-25 07:00+02');

select results_eq(
  $$ select due_at, status::text, status_changed_at from public.doses
     where stock_item_id = current_setting('test.fall')::uuid order by due_at $$,
  $$ values ('2026-10-24 08:00+03'::timestamptz, 'missed', '2026-10-25 07:00+02'::timestamptz) $$,
  'fall back: a daily Dose becomes missed 24 h after it was due, before the next Dose'
);

select * from finish();
rollback;
