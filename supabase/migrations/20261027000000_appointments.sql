-- Appointments: a scheduled medical visit with a start and an end. Single-row
-- create, edit and delete go straight to the table under owner-only RLS;
-- cancelling goes through cancel_appointment() so it reads app.now(). Status
-- is never stored: appointments.status is derived from cancelled_at, ends_at
-- and app.now(). Reminders and Work Calendar Invites come in Phase C.

create type public.appointment_status as enum ('scheduled', 'done', 'cancelled');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id),
  -- the real title, shown only in the app; invites use "Personal appointment"
  title text not null check (btrim(title) <> ''),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  provider text,
  location text,
  -- before the visit
  notes text,
  -- after the visit
  visit_summary text,
  -- the Form 17 or Commitment it uses (no session counting); the foreign key
  -- to authorizations is added by the Authorizations slice
  authorization_id uuid,
  buffer_before_minutes int not null default 0 check (buffer_before_minutes >= 0),
  buffer_after_minutes int not null default 0 check (buffer_after_minutes >= 0),
  send_to_work_calendar boolean not null default true,
  cancelled_at timestamptz,
  -- stable iCalendar UID for the Work Calendar Invite (ADR 0001): set once on
  -- creation, never changed
  invite_uid text not null default gen_random_uuid()::text,
  -- increased on every update or cancellation sent (Phase C)
  invite_sequence int not null default 0,
  created_at timestamptz not null default app.now(),
  constraint ends_after_start check (ends_at > starts_at)
);

create index appointments_owner_id_idx on public.appointments (owner_id);
create index appointments_starts_at_idx on public.appointments (starts_at);

select app.protect_owned_table('public.appointments');

-- invite_uid is the server's: a fresh one on every insert, whatever the client
-- sends, and an update may not change it.
create or replace function app.fix_appointment_invite_uid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.invite_uid := gen_random_uuid()::text;
  elsif new.invite_uid is distinct from old.invite_uid then
    raise exception 'An Appointment''s invite_uid never changes' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger fix_invite_uid
before insert or update of invite_uid on public.appointments
for each row execute function app.fix_appointment_invite_uid();

-- Derived status, readable as a column (`appointments.status`, and `status`
-- in a PostgREST select): cancelled if cancelled_at is set, otherwise done
-- once ends_at has passed, otherwise scheduled.
create or replace function public.status(appointment public.appointments)
returns public.appointment_status
language sql
stable
set search_path = ''
as $$
  select case
    when appointment.cancelled_at is not null then 'cancelled'::public.appointment_status
    when appointment.ends_at <= app.now() then 'done'::public.appointment_status
    else 'scheduled'::public.appointment_status
  end;
$$;

revoke execute on function public.status(public.appointments) from public, anon;
grant execute on function public.status(public.appointments) to authenticated;

-- Cancel an Appointment: it keeps its row as cancelled. Cancelling a
-- cancelled Appointment keeps the first timestamp.
create or replace function public.cancel_appointment(appointment_id uuid)
returns public.appointments
language sql
security invoker
set search_path = ''
as $$
  update public.appointments
  set cancelled_at = coalesce(cancelled_at, app.now())
  where id = appointment_id
  returning *;
$$;

revoke execute on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

-- Duplicate an Appointment at new times (there are no repeating
-- Appointments). The copy keeps everything else, but not the Visit Summary or
-- the cancellation, and gets its own invite_uid and a fresh invite_sequence.
create or replace function public.duplicate_appointment(
  appointment_id uuid,
  starts_at timestamptz,
  ends_at timestamptz
)
returns public.appointments
language sql
security invoker
set search_path = ''
as $$
  insert into public.appointments (
    title, starts_at, ends_at, provider, location, notes, authorization_id,
    buffer_before_minutes, buffer_after_minutes, send_to_work_calendar
  )
  select
    a.title, duplicate_appointment.starts_at, duplicate_appointment.ends_at, a.provider,
    a.location, a.notes, a.authorization_id, a.buffer_before_minutes,
    a.buffer_after_minutes, a.send_to_work_calendar
  from public.appointments a
  where a.id = duplicate_appointment.appointment_id
  returning *;
$$;

revoke execute on function public.duplicate_appointment(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.duplicate_appointment(uuid, timestamptz, timestamptz) to authenticated;
