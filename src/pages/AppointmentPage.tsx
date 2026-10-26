import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AppointmentForm } from '@/features/appointments/AppointmentForm';
import {
  useAppointments,
  useCancelAppointment,
  useDeleteAppointment,
  useDuplicateAppointment,
  useSaveAppointment,
  type Appointment,
  type AppointmentInput,
} from '@/features/appointments/appointments';
import { formatDateTime, fromLocalInput, toLocalInput } from '@/features/appointments/dateTime';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';
const buttonClass = 'rounded border border-gray-300 px-4 py-2 disabled:opacity-50';
const WEEK_MS = 7 * 24 * 3_600_000;

/**
 * Create an Appointment (`/appointments/new`), or edit, cancel, duplicate,
 * delete and write the Visit Summary of one (`/appointments/:id`).
 */
export function AppointmentPage() {
  const { id } = useParams();
  // A fresh screen per Appointment (e.g. after Duplicate opens the copy), so
  // the forms start from that Appointment's values.
  return <AppointmentScreen key={id ?? 'new'} id={id} />;
}

function AppointmentScreen({ id }: { id: string | undefined }) {
  const navigate = useNavigate();
  const appointments = useAppointments();
  const save = useSaveAppointment();
  const cancel = useCancelAppointment();
  const remove = useDeleteAppointment();
  const appointment = id ? appointments.data?.find((a) => a.id === id) : undefined;
  const error = save.error ?? cancel.error ?? remove.error;

  if (id && appointments.isPending) return <p className="p-4">Loading…</p>;
  if (id && !appointment) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <p>Appointment not found.</p>
        <Link to="/appointments" className="underline">
          Appointments
        </Link>
      </main>
    );
  }

  function handleSubmit(input: AppointmentInput) {
    save.mutate({ id: appointment?.id, input }, { onSuccess: () => navigate('/appointments') });
  }

  const cancelled = appointment?.status === 'cancelled';

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">
        {appointment ? 'Edit Appointment' : 'New Appointment'}
      </h1>
      {cancelled && <p className="text-gray-600">Cancelled</p>}
      {appointment?.status === 'done' && <p className="text-gray-600">Done</p>}
      <AppointmentForm initial={appointment} submitting={save.isPending} onSubmit={handleSubmit} />
      {appointment && (
        <div className="flex flex-wrap gap-2">
          {!cancelled && (
            <button
              type="button"
              disabled={cancel.isPending}
              className={buttonClass}
              onClick={() => cancel.mutate(appointment.id)}
            >
              Cancel Appointment
            </button>
          )}
          <button
            type="button"
            disabled={remove.isPending}
            className={buttonClass}
            onClick={() => {
              if (window.confirm('Delete this Appointment for good?')) {
                remove.mutate(appointment.id, { onSuccess: () => navigate('/appointments') });
              }
            }}
          >
            Delete
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      {appointment?.status === 'done' && <VisitSummarySection appointment={appointment} />}
      {appointment && <DuplicateSection appointment={appointment} />}
      <Link to="/appointments" className="block underline">
        Appointments
      </Link>
    </main>
  );
}

/** The owner's notes on what happened, written after the visit. */
function VisitSummarySection({ appointment }: { appointment: Appointment }) {
  const save = useSaveAppointment();
  const [summary, setSummary] = useState(appointment.visit_summary ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    save.mutate({ id: appointment.id, input: { visit_summary: summary.trim() || null } });
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Visit Summary</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block">
          What happened at the visit
          <textarea
            className={fieldClass}
            rows={4}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <button type="submit" disabled={save.isPending} className={buttonClass}>
          Save Visit Summary
        </button>
        {save.isSuccess && <p role="status">Visit Summary saved.</p>}
        {save.error && (
          <p role="alert" className="text-red-700">
            {save.error.message}
          </p>
        )}
      </form>
    </section>
  );
}

/** Copy the Appointment to new times, a week later by default. */
function DuplicateSection({ appointment }: { appointment: Appointment }) {
  const navigate = useNavigate();
  const duplicate = useDuplicateAppointment();
  const later = (iso: string) => new Date(new Date(iso).getTime() + WEEK_MS).toISOString();
  const [startsAt, setStartsAt] = useState(toLocalInput(later(appointment.starts_at)));
  const [endsAt, setEndsAt] = useState(toLocalInput(later(appointment.ends_at)));
  const [invalid, setInvalid] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const starts = fromLocalInput(startsAt);
    const ends = fromLocalInput(endsAt);
    if (ends <= starts) {
      setInvalid('The end must be after the start.');
      return;
    }
    setInvalid(null);
    duplicate.mutate(
      { id: appointment.id, starts_at: starts, ends_at: ends },
      { onSuccess: (copyId) => navigate(`/appointments/${copyId}`) },
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Duplicate</h2>
      <p className="text-gray-600">
        Copies this Appointment from {formatDateTime(appointment.starts_at)} to new times, without
        its Visit Summary.
      </p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label className="block">
          New start
          <input
            className={fieldClass}
            type="datetime-local"
            required
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </label>
        <label className="block">
          New end
          <input
            className={fieldClass}
            type="datetime-local"
            required
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </label>
        {(invalid ?? duplicate.error) && (
          <p role="alert" className="text-red-700">
            {invalid ?? duplicate.error?.message}
          </p>
        )}
        <button type="submit" disabled={duplicate.isPending} className={buttonClass}>
          Duplicate
        </button>
      </form>
    </section>
  );
}
