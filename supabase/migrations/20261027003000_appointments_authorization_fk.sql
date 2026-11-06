-- An Appointment uses at most one Authorization (the Form 17 or Commitment
-- covering it; any type is allowed). Like every reference between owned rows,
-- the key is composite (owner_id, id) so it can only point at the same
-- owner's Authorization. Deleting the Authorization (a mistake fix) unlinks
-- the Appointment and keeps it: only authorization_id is set to null.

alter table public.appointments
  add constraint appointments_authorization_fkey foreign key (owner_id, authorization_id)
    references public.authorizations (owner_id, id)
    on delete set null (authorization_id);

create index appointments_authorization_id_idx on public.appointments (authorization_id);
