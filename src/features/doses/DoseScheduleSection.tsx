import { useState } from 'react';
import { DoseScheduleForm } from './DoseScheduleForm';
import { useCurrentDoseSchedule, useSaveDoseSchedule } from './doseSchedules';

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
      {saved && <p role="status">Schedule saved.</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
    </section>
  );
}
