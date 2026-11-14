import { useState, type FormEvent } from 'react';
import { leadDaysError, type LeadDays } from './leadDays';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';

const fields = ['First notice', 'Second notice', 'Last notice'] as const;

/**
 * The Authorization lead times: the Alert enters the Alerts list at the first
 * and is pushed at the Daily Alert Time on each.
 */
export function LeadTimesForm({
  value,
  submitting = false,
  onSubmit,
}: {
  value: LeadDays;
  submitting?: boolean;
  onSubmit: (days: LeadDays) => void;
}) {
  const [days, setDays] = useState<string[]>(value.map(String));
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = days.map((d) => (d.trim() === '' ? NaN : Number(d)));
    const message = leadDaysError(parsed);
    setError(message);
    if (!message) onSubmit(parsed as LeadDays);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      {fields.map((label, i) => (
        <label key={label} className="block">
          {label} (days before expiry)
          <input
            className={fieldClass}
            type="number"
            inputMode="numeric"
            min="0"
            max="365"
            step="1"
            value={days[i]}
            onChange={(e) => setDays((prev) => prev.map((d, j) => (j === i ? e.target.value : d)))}
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
      >
        Save lead times
      </button>
    </form>
  );
}
