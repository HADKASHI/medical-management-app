import { useState, type FormEvent } from 'react';
import type { RestockInput } from './stockChanges';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';

/**
 * Record a Restock in Units or in packs. Packs need the Stock Item's Pack
 * Size; the form shows the Units they come to, and the database converts them
 * the same way when it records the Restock. It can be filed under one of the
 * offered Authorizations.
 */
export function RestockForm({
  packSize,
  unit,
  today,
  authorizations = [],
  submitting = false,
  onSubmit,
}: {
  packSize: number | null;
  unit: string;
  /** Today's date (YYYY-MM-DD), the default Restock date. */
  today: string;
  /** The Authorizations this Restock may be filled under. */
  authorizations?: { id: string; label: string }[];
  submitting?: boolean;
  onSubmit: (input: RestockInput) => void;
}) {
  const [inPacks, setInPacks] = useState(false);
  const [amount, setAmount] = useState('');
  const [restockedOn, setRestockedOn] = useState(today);
  const [note, setNote] = useState('');
  const [authorizationId, setAuthorizationId] = useState('');
  const packsAllowed = packSize != null;
  const usePacks = inPacks && packsAllowed;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    onSubmit({
      ...(usePacks ? { packs: value } : { quantity: value }),
      restocked_on: restockedOn,
      note: note.trim() || null,
      ...(authorizationId ? { authorization_id: authorizationId } : {}),
    });
    setAmount('');
    setNote('');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <fieldset className="flex gap-4">
        <legend className="sr-only">Enter in</legend>
        <label>
          <input
            type="radio"
            name="restock-in"
            checked={!usePacks}
            onChange={() => setInPacks(false)}
          />{' '}
          Units
        </label>
        <label>
          <input
            type="radio"
            name="restock-in"
            disabled={!packsAllowed}
            checked={usePacks}
            onChange={() => setInPacks(true)}
          />{' '}
          Packs
        </label>
      </fieldset>
      {!packsAllowed && (
        <p className="text-sm text-gray-600">Set a Pack Size to restock in packs.</p>
      )}
      <label className="block">
        {usePacks ? 'Number of packs' : `Units (${unit})`}
        <input
          className={fieldClass}
          type="number"
          step="any"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </label>
      {usePacks && amount !== '' && (
        <p>
          = {Number(amount) * packSize!} {unit}
        </p>
      )}
      <label className="block">
        Date
        <input
          className={fieldClass}
          type="date"
          required
          value={restockedOn}
          onChange={(e) => setRestockedOn(e.target.value)}
        />
      </label>
      <label className="block">
        Note
        <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {authorizations.length > 0 && (
        <label className="block">
          Authorization
          <select
            className={fieldClass}
            value={authorizationId}
            onChange={(e) => setAuthorizationId(e.target.value)}
          >
            <option value="">None</option>
            {authorizations.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
      >
        Restock
      </button>
    </form>
  );
}
