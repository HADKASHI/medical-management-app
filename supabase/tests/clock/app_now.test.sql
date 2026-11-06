begin;
select plan(2);

select ok(
  app.now() = now(),
  'app.now() returns the real time when app.now is not set'
);

select tests.at('2026-01-05 08:00 Asia/Jerusalem');

select is(
  app.now(),
  '2026-01-05 06:00+00'::timestamptz,
  'app.now() returns the time set by tests.at()'
);

select * from finish();
rollback;
