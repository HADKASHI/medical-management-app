begin;
select plan(2);

select tests.at('2026-01-05 08:00 Asia/Jerusalem');

select lives_ok(
  'select app.tick()',
  'app.tick() runs with no data'
);

select results_eq(
  $$ select schedule, command, active from cron.job where jobname = 'app-tick' $$,
  $$ values ('* * * * *'::text, 'select app.tick()'::text, true) $$,
  'app.tick() is scheduled every minute'
);

select * from finish();
rollback;
