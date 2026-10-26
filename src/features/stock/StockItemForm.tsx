import { useState, type FormEvent } from 'react';
import type { StockItemInput, StockItemKind } from './stockItems';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';

/**
 * Create or edit a Stock Item. Strength is only for medications, so it is
 * hidden (and submitted as null) for a supply; the database rejects it too.
 */
export function StockItemForm({
  initial,
  submitting = false,
  onSubmit,
}: {
  initial?: StockItemInput;
  submitting?: boolean;
  onSubmit: (input: StockItemInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<StockItemKind>(initial?.kind ?? 'medication');
  const [strength, setStrength] = useState(initial?.strength ?? '');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [quantity, setQuantity] = useState(String(initial?.quantity ?? 0));
  const [threshold, setThreshold] = useState(String(initial?.low_stock_threshold ?? 0));
  const [packSize, setPackSize] = useState(
    initial?.pack_size == null ? '' : String(initial.pack_size),
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      kind,
      strength: kind === 'medication' && strength.trim() ? strength.trim() : null,
      unit: unit.trim(),
      quantity: Number(quantity),
      low_stock_threshold: Number(threshold),
      pack_size: packSize.trim() ? Number(packSize) : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        Name
        <input
          className={fieldClass}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block">
        Kind
        <select
          className={fieldClass}
          value={kind}
          onChange={(e) => setKind(e.target.value as StockItemKind)}
        >
          <option value="medication">Medication</option>
          <option value="supply">Supply</option>
        </select>
      </label>
      {kind === 'medication' && (
        <label className="block">
          Strength
          <input
            className={fieldClass}
            placeholder="50 mg"
            value={strength}
            onChange={(e) => setStrength(e.target.value)}
          />
        </label>
      )}
      <label className="block">
        Unit
        <input
          className={fieldClass}
          required
          placeholder="pill, ml, strip, piece"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </label>
      <label className="block">
        Quantity
        <input
          className={fieldClass}
          type="number"
          step="any"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label className="block">
        Low-Stock Threshold
        <input
          className={fieldClass}
          type="number"
          step="any"
          min="0"
          required
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
      </label>
      <label className="block">
        Pack Size
        <input
          className={fieldClass}
          type="number"
          step="any"
          min="0"
          value={packSize}
          onChange={(e) => setPackSize(e.target.value)}
        />
      </label>
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
