import { Link } from 'react-router';
import { formatDateTime } from '@/features/appointments/dateTime';
import { useAppointments, type Appointment } from '@/features/appointments/appointments';

/** Upcoming Appointments soonest first; past and cancelled ones newest first. */
export function AppointmentsPage() {
  const { data, isPending, error } = useAppointments();
  const upcoming = (data ?? []).filter((a) => a.status === 'scheduled').reverse();
  const past = (data ?? []).filter((a) => a.status !== 'scheduled');

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Appointments</h1>
      <Link to="/appointments/new" className="underline">
        Add Appointment
      </Link>
      {isPending && <p>Loading…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      <AppointmentList label="Upcoming" appointments={upcoming} />
      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Past and cancelled</h2>
          <AppointmentList label="Past and cancelled" appointments={past} />
        </section>
      )}
      <Link to="/" className="block underline">
        Home
      </Link>
    </main>
  );
}

const statusLabel = { scheduled: 'Scheduled', done: 'Done', cancelled: 'Cancelled' } as const;

function AppointmentList({ label, appointments }: { label: string; appointments: Appointment[] }) {
  return (
    <ul aria-label={label} className="divide-y divide-gray-200">
      {appointments.map((a) => (
        <li
          key={a.id}
          aria-label={a.title}
          className="flex items-center justify-between gap-2 py-2"
        >
          <span>
            <Link to={`/appointments/${a.id}`} className="underline">
              {a.title}
            </Link>
            <span className="block text-sm text-gray-600">
              {formatDateTime(a.starts_at)}
              {a.provider && ` · ${a.provider}`}
            </span>
          </span>
          {a.status && <span className="text-sm">{statusLabel[a.status]}</span>}
        </li>
      ))}
    </ul>
  );
}
