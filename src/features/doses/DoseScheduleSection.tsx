import { useState, type FormEvent } from 'react';
import { DoseScheduleForm } from './DoseScheduleForm';
import { useCurrentDoseSchedule, useSaveDoseSchedule } from './doseSchedules';
import { useLogAsNeededDose } from './dueDoses';

/** A medication's current Dose Schedule; saving starts a new version. */
export function DoseScheduleSection({ stockItemId }: { stockItemId: string }) {
  const schedule = useCurrentDoseSchedule(stockItemId);
  const save = useSaveDoseSchedule();
  const [saved, setSaved] = useState(false);
  const error = schedule.error ?? save.error;

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Dose Schedule</h2>
      {schedule.isPending ? (
        <p>Loading…</p>
      ) : (
        <DoseScheduleForm
          initial={schedule.data}
          submitting={save.isPending}
          onSubmit={(input) => {
            setSaved(false);
            save.mutate({ stockItemId, input }, { onSuccess: () => setSaved(true) });
          }}
        />
      )}
      {schedule.data?.pattern === 'as_needed' && <LogDoseForm stockItemId={stockItemId} />}
      {saved && <p role="status">Schedule saved.</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
    </section>
  );
}

/** As Needed medications: log a Dose when it is taken (created as taken, now). */
function LogDoseForm({ stockItemId }: { stockItemId: string }) {
  const log = useLogAsNeededDose(stockItemId);
  const [amount, setAmount] = useState('1');
  const [logged, setLogged] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLogged(false);
    log.mutate(Number(amount), { onSuccess: () => setLogged(true) });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-lg font-semibold">Log a dose</h3>
      <label className="block">
        Amount taken
        <input
          className="block w-full rounded border border-gray-300 px-3 py-2"
          type="number"
          step="any"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={log.isPending}
        className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
      >
        Log a dose
      </button>
      {logged && <p role="status">Dose logged.</p>}
      {log.error && (
        <p role="alert" className="text-red-700">
          {log.error.message}
        </p>
      )}
    </form>
  );
}
