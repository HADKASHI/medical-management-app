import { useState, type FormEvent } from 'react';
import { RestockForm } from './RestockForm';
import { useRecordRestock, useRecordStockCount } from './stockChanges';
import type { StockItem } from './stockItems';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';

/** Today's date on this device, as YYYY-MM-DD. */
function localToday(): string {
  return new Date().toLocaleDateString('en-CA');
}

/** A Stock Item's quantity, and the two ways the owner changes it: Restock and Stock Count. */
export function StockChangesSection({ item }: { item: StockItem }) {
  const restock = useRecordRestock(item.id);
  const count = useRecordStockCount(item.id);
  const [counted, setCounted] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const error = restock.error ?? count.error;
  const negative = item.quantity < 0;

  function handleCount(event: FormEvent) {
    event.preventDefault();
    setDone(null);
    count.mutate(Number(counted), {
      onSuccess: () => {
        setCounted('');
        setDone('Stock Count saved.');
      },
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Stock</h2>
      <p>
        In stock:{' '}
        <span className={negative ? 'font-semibold text-red-700' : undefined}>
          {item.quantity} {item.unit}
        </span>
        {negative && <span className="block text-sm text-red-700">Negative: do a Stock Count</span>}
      </p>

      <h3 className="text-lg font-semibold">Restock</h3>
      <RestockForm
        packSize={item.pack_size}
        unit={item.unit}
        today={localToday()}
        submitting={restock.isPending}
        onSubmit={(input) => {
          setDone(null);
          restock.mutate(input, { onSuccess: () => setDone('Restock saved.') });
        }}
      />

      <h3 className="text-lg font-semibold">Stock Count</h3>
      <form onSubmit={handleCount} className="space-y-3">
        <label className="block">
          Counted ({item.unit})
          <input
            className={fieldClass}
            type="number"
            step="any"
            min="0"
            required
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={count.isPending}
          className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
        >
          Save Stock Count
        </button>
      </form>

      {done && <p role="status">{done}</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
    </section>
  );
}
