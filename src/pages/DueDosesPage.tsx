import { useState } from 'react';
import { Link } from 'react-router';
import {
  useDueDoses,
  useSetDoseStatus,
  useTakeDoses,
  type DueDose,
  type DoseStatus,
} from '@/features/doses/dueDoses';

const buttonClass = 'rounded border border-gray-300 px-3 py-1 disabled:opacity-50';

/** A Dose's due time on the owner's Asia/Jerusalem wall clock. */
function formatDueAt(dueAt: string | null): string {
  if (!dueAt) return 'As Needed';
  return new Date(dueAt).toLocaleString('en-GB', {
    timeZone: 'Asia/Jerusalem',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Every pending Dose, each with Taken / Skip, plus All taken (the Dose Reminder's target). */
export function DueDosesPage() {
  const { data, isPending, error } = useDueDoses();
  const setStatus = useSetDoseStatus();
  const takeAll = useTakeDoses();
  const [done, setDone] = useState<string | null>(null);
  const doses = data ?? [];
  const busy = setStatus.isPending || takeAll.isPending;
  const mutationError = setStatus.error ?? takeAll.error;

  function change(dose: DueDose, status: DoseStatus) {
    setDone(null);
    setStatus.mutate(
      { doseId: dose.id, status },
      {
        onSuccess: () =>
          setDone(`${dose.stock_item.name} ${status === 'taken' ? 'taken' : 'skipped'}.`),
      },
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Due Doses</h1>
      {isPending && <p>Loading…</p>}
      {(error ?? mutationError) && (
        <p role="alert" className="text-red-700">
          {(error ?? mutationError)?.message}
        </p>
      )}
      {!isPending && doses.length === 0 && <p>No Doses due.</p>}
      {doses.length > 0 && (
        <>
          <ul aria-label="Pending Doses" className="divide-y divide-gray-200">
            {doses.map((dose) => {
              const { name, strength, unit } = dose.stock_item;
              const title = strength ? `${name} ${strength}` : name;
              return (
                <li key={dose.id} aria-label={title} className="space-y-1 py-2">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-gray-600">
                    <span>
                      {dose.amount} {unit}
                    </span>{' '}
                    · due {formatDueAt(dose.due_at)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={busy}
                      onClick={() => change(dose, 'taken')}
                    >
                      Taken
                    </button>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={busy}
                      onClick={() => change(dose, 'skipped')}
                    >
                      Skip
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            className={buttonClass}
            disabled={busy}
            onClick={() => {
              setDone(null);
              takeAll.mutate(
                doses.map((dose) => dose.id),
                { onSuccess: () => setDone('All taken.') },
              );
            }}
          >
            All taken
          </button>
        </>
      )}
      {done && <p role="status">{done}</p>}
      <Link to="/" className="block underline">
        Home
      </Link>
    </main>
  );
}
