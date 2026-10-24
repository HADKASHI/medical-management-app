-- The per-minute job. Later slices add Dose generation, missed marking,
-- Reminder enqueueing, the heartbeat and the outbox call, all reading the
-- time through app.now().

create extension if not exists pg_cron;

create or replace function app.tick()
returns void
language plpgsql
set search_path = ''
as $$
begin
  -- Nothing to do yet.
  return;
end;
$$;

revoke execute on function app.tick() from public, anon, authenticated;

-- Idempotent: cron.schedule() with an existing job name updates that job.
select cron.schedule('app-tick', '* * * * *', 'select app.tick()');
