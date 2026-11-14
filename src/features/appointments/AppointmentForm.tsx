import { useState, type FormEvent } from 'react';
import type { Authorization } from '@/features/authorizations/authorizations';
import { authorizationTitle } from '@/features/authorizations/labels';
import type { AppointmentInput } from './appointments';
import { fromLocalInput, toLocalInput } from './dateTime';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';

/**
 * Create or edit an Appointment. Start and end are entered in the device's
 * time; an end at or before the start is rejected here (and by the database).
 * It may use one current Authorization (neither renewed nor Archived); the one
 * already linked stays on offer even if it has since been renewed or Archived.
 */
export function AppointmentForm({
  initial,
  authorizations = [],
  submitting = false,
  onSubmit,
}: {
  initial?: AppointmentInput;
  /** The owner's Authorizations; the form offers the current ones. */
  authorizations?: Authorization[];
  submitting?: boolean;
  onSubmit: (input: AppointmentInput) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [startsAt, setStartsAt] = useState(initial ? toLocalInput(initial.starts_at) : '');
  const [endsAt, setEndsAt] = useState(initial ? toLocalInput(initial.ends_at) : '');
  const [provider, setProvider] = useState(initial?.provider ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [bufferBefore, setBufferBefore] = useState(String(initial?.buffer_before_minutes ?? 0));
  const [bufferAfter, setBufferAfter] = useState(String(initial?.buffer_after_minutes ?? 0));
  const [sendToWork, setSendToWork] = useState(initial?.send_to_work_calendar ?? true);
  const [authorizationId, setAuthorizationId] = useState(initial?.authorization_id ?? '');
  const offered = authorizations.filter(
    (a) => (!a.renewed && !a.archived_at) || a.id === initial?.authorization_id,
  );
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
    onSubmit({
      title: title.trim(),
      starts_at: starts,
      ends_at: ends,
      provider: provider.trim() || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      buffer_before_minutes: Number(bufferBefore),
      buffer_after_minutes: Number(bufferAfter),
      send_to_work_calendar: sendToWork,
      authorization_id: authorizationId || null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        Title
        <input
          className={fieldClass}
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="block">
        Start
        <input
          className={fieldClass}
          type="datetime-local"
          required
          value={startsAt}
          onChange={(e) => {
            setStartsAt(e.target.value);
            if (!endsAt && e.target.value) {
              setEndsAt(
                toLocalInput(
                  new Date(new Date(e.target.value).getTime() + 3_600_000).toISOString(),
                ),
              );
            }
          }}
        />
      </label>
      <label className="block">
        End
        <input
          className={fieldClass}
          type="datetime-local"
          required
          value={endsAt}
          onChange={(e) => setEndsAt(e.target.value)}
        />
      </label>
      <label className="block">
        Provider
        <input
          className={fieldClass}
          placeholder="Doctor, clinic or therapist"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
        />
      </label>
      <label className="block">
        Location
        <input
          className={fieldClass}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </label>
      <label className="block">
        Notes
        <textarea className={fieldClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <label className="block">
        Travel Buffer before (minutes)
        <input
          className={fieldClass}
          type="number"
          min="0"
          step="1"
          required
          value={bufferBefore}
          onChange={(e) => setBufferBefore(e.target.value)}
        />
      </label>
      <label className="block">
        Travel Buffer after (minutes)
        <input
          className={fieldClass}
          type="number"
          min="0"
          step="1"
          required
          value={bufferAfter}
          onChange={(e) => setBufferAfter(e.target.value)}
        />
      </label>
      <label className="block">
        Authorization
        <select
          className={fieldClass}
          value={authorizationId}
          onChange={(e) => setAuthorizationId(e.target.value)}
        >
          <option value="">None</option>
          {offered.map((a) => (
            <option key={a.id} value={a.id}>
              {`${authorizationTitle(a)}: ${a.covers}`}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={sendToWork}
          onChange={(e) => setSendToWork(e.target.checked)}
        />
        Send to work calendar
      </label>
      {invalid && (
        <p role="alert" className="text-red-700">
          {invalid}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}
