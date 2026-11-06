-- Reports, Doses tab: the month query returns that month's Doses (by
-- Asia/Jerusalem local date) and the Dose Schedule versions in force that month.
begin;
select plan(5);

select tests.as_owner();
select tests.at('2026-01-29 12:00 Asia/Jerusalem');
select set_config('test.a', tests.make_stock_item(name => 'Medication A')::text, true);
select set_config('test.b', tests.make_stock_item(name => 'Medication B')::text, true);
select set_config('test.v1',
  tests.make_schedule(current_setting('test.a')::uuid, times => '{00:30,08:00}',
    effective_from => '2026-01-31')::text, true);
select tests.make_schedule(current_setting('test.b')::uuid, times => '{}',
  pattern => 'as_needed');

-- January 31 and February 1 under v1.
select tests.tick_at('2026-01-31 09:00 Asia/Jerusalem');
select tests.tick_at('2026-02-01 09:00 Asia/Jerusalem');

-- From February 2 the schedule is one Dose at 20:00 (v2).
select set_config('test.v2',
  tests.make_schedule(current_setting('test.a')::uuid, times => '{20:00}',
    effective_from => '2026-02-02')::text, true);
select tests.tick_at('2026-02-02 21:00 Asia/Jerusalem');

-- As Needed Doses either side of midnight between the months.
select tests.at('2026-01-31 23:50 Asia/Jerusalem');
select public.log_as_needed_dose(current_setting('test.b')::uuid, 1);
select tests.at('2026-02-01 00:10 Asia/Jerusalem');
select public.log_as_needed_dose(current_setting('test.b')::uuid, 1);

select tests.at('2026-02-03 12:00 Asia/Jerusalem');

select results_eq(
  $$ select local_date, to_char(local_time, 'HH24:MI'), status::text,
            dose_schedule_id is null
     from public.month_doses('2026-01-01')
     order by local_date, local_time $$,
  $$ values ('2026-01-31'::date, '00:30', 'missed', false),
            ('2026-01-31'::date, '08:00', 'missed', false),
            ('2026-01-31'::date, '23:50', 'taken', true) $$,
  'month_doses: January holds the Doses due (or As Needed taken) on its local dates'
);

select results_eq(
  $$ select local_date, to_char(local_time, 'HH24:MI'), dose_schedule_id is null
     from public.month_doses('2026-02-15')
     order by local_date, local_time $$,
  $$ values ('2026-02-01'::date, '00:10', true),
            ('2026-02-01'::date, '00:30', false),
            ('2026-02-01'::date, '08:00', false),
            ('2026-02-02'::date, '20:00', false) $$,
  'month_doses: any date in the month selects the whole month'
);

select results_eq(
  $$ select id::text, pattern::text, effective_from, effective_to,
            array(select to_char(t, 'HH24:MI') from unnest(times) t)
     from public.month_dose_schedules('2026-02-01')
     where stock_item_id = current_setting('test.a')::uuid
     order by effective_from $$,
  $$ values (current_setting('test.v1'), 'daily', '2026-01-31'::date, '2026-02-02'::date,
             array['00:30', '08:00']),
            (current_setting('test.v2'), 'daily', '2026-02-02'::date, null::date,
             array['20:00']) $$,
  'month_dose_schedules: every version in force in the month, with its Dose Times'
);

select results_eq(
  $$ select s.id::text, cardinality(s.times)
     from public.month_dose_schedules('2026-01-01') s
     order by s.effective_from $$,
  $$ values ((select id::text from public.dose_schedules
              where stock_item_id = current_setting('test.b')::uuid), 0),
            (current_setting('test.v1'), 2) $$,
  'month_dose_schedules: a version that starts after the month is left out'
);

select tests.as_stranger();
select is_empty(
  $$ select 1 from public.month_doses('2026-02-01') $$,
  'month_doses: a stranger sees no Doses'
);

select * from finish();
rollback;
