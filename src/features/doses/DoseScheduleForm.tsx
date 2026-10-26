import { useState, type FormEvent } from 'react';
import type { DoseScheduleInput, DoseSchedulePattern } from './doseSchedules';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';
const buttonClass = 'rounded border border-gray-300 px-4 py-2 disabled:opacity-50';
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type TimeRow = { time_of_day: string; amount: string };

/**
 * Edit a medication's Dose Schedule. Saving makes a new version; the database
 * ends the current one. Only the fields of the chosen pattern are submitted.
 */
export function DoseScheduleForm({
  initial,
  submitting = false,
  onSubmit,
}: {
  initial?: DoseScheduleInput | null;
  submitting?: boolean;
  onSubmit: (input: DoseScheduleInput) => void;
}) {
  const [pattern, setPattern] = useState<DoseSchedulePattern>(initial?.pattern ?? 'daily');
  const [times, setTimes] = useState<TimeRow[]>(
    initial?.times.length
      ? initial.times.map((t) => ({ time_of_day: t.time_of_day, amount: String(t.amount) }))
      : [{ time_of_day: '08:00', amount: '1' }],
  );
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [intervalDays, setIntervalDays] = useState(String(initial?.interval_days ?? 2));
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effective_from ?? '');

  function updateTime(index: number, change: Partial<TimeRow>) {
    setTimes((rows) => rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  function toggleWeekday(day: number) {
    setWeekdays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      pattern,
      times:
        pattern === 'as_needed'
          ? []
          : times.map((t) => ({ time_of_day: t.time_of_day, amount: Number(t.amount) })),
      weekdays: pattern === 'weekdays' ? [...weekdays].sort((a, b) => a - b) : null,
      interval_days: pattern === 'every_n_days' ? Number(intervalDays) : null,
      effective_from: effectiveFrom || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        Pattern
        <select
          className={fieldClass}
          value={pattern}
          onChange={(e) => setPattern(e.target.value as DoseSchedulePattern)}
        >
          <option value="daily">Daily</option>
          <option value="weekdays">Certain weekdays</option>
          <option value="every_n_days">Every N days</option>
          <option value="as_needed">As Needed</option>
        </select>
      </label>
      {pattern === 'weekdays' && (
        <fieldset className="flex flex-wrap gap-3">
          <legend>Weekdays</legend>
          {weekdayNames.map((name, day) => (
            <label key={name} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={weekdays.includes(day)}
                onChange={() => toggleWeekday(day)}
              />
              {name}
            </label>
          ))}
        </fieldset>
      )}
      {pattern === 'every_n_days' && (
        <label className="block">
          Every N days
          <input
            className={fieldClass}
            type="number"
            min="1"
            step="1"
            required
            value={intervalDays}
            onChange={(e) => setIntervalDays(e.target.value)}
          />
        </label>
      )}
      {pattern !== 'as_needed' && (
        <fieldset className="space-y-2">
          <legend>Dose Times (Israel time)</legend>
          {times.map((row, index) => (
            <div key={index} className="flex items-end gap-2">
              <label className="block flex-1">
                Time
                <input
                  className={fieldClass}
                  type="time"
                  required
                  value={row.time_of_day}
                  onChange={(e) => updateTime(index, { time_of_day: e.target.value })}
                />
              </label>
              <label className="block flex-1">
                Amount
                <input
                  className={fieldClass}
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={row.amount}
                  onChange={(e) => updateTime(index, { amount: e.target.value })}
                />
              </label>
              {times.length > 1 && (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setTimes((rows) => rows.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className={buttonClass}
            onClick={() => setTimes((rows) => [...rows, { time_of_day: '', amount: '1' }])}
          >
            Add time
          </button>
        </fieldset>
      )}
      <label className="block">
        Starts on
        <input
          className={fieldClass}
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </label>
      <button type="submit" disabled={submitting} className={buttonClass}>
        Save schedule
      </button>
    </form>
  );
}
