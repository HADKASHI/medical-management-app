import { useState, type FormEvent } from 'react';
import type { StockItem } from '@/features/stock/stockItems';
import type { AuthorizationInput, AuthorizationType } from './authorizations';
import { authorizationTypeLabels } from './labels';

const fieldClass = 'block w-full rounded border border-gray-300 px-3 py-2';

/** The form's starting values; an empty expiry date leaves the field blank. */
export type AuthorizationDraft = Omit<AuthorizationInput, 'expires_on'> & {
  expires_on: string | null;
};

/**
 * Create, edit or renew an Authorization. The Stock Item is optional; the
 * reference number may repeat across Authorizations.
 */
export function AuthorizationForm({
  initial,
  stockItems,
  submitting = false,
  onSubmit,
}: {
  initial?: AuthorizationDraft;
  /** The Stock Items the Authorization may cover. */
  stockItems: StockItem[];
  submitting?: boolean;
  onSubmit: (input: AuthorizationInput) => void;
}) {
  const [type, setType] = useState<AuthorizationType>(initial?.type ?? 'prescription');
  const [referenceNumber, setReferenceNumber] = useState(initial?.reference_number ?? '');
  const [covers, setCovers] = useState(initial?.covers ?? '');
  const [stockItemId, setStockItemId] = useState(initial?.stock_item_id ?? '');
  const [issuedOn, setIssuedOn] = useState(initial?.issued_on ?? '');
  const [expiresOn, setExpiresOn] = useState(initial?.expires_on ?? '');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit({
      type,
      reference_number: referenceNumber.trim(),
      covers: covers.trim(),
      stock_item_id: stockItemId || null,
      issued_on: issuedOn || null,
      expires_on: expiresOn,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        Type
        <select
          className={fieldClass}
          value={type}
          onChange={(e) => setType(e.target.value as AuthorizationType)}
        >
          {Object.entries(authorizationTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Reference number
        <input
          className={fieldClass}
          required
          value={referenceNumber}
          onChange={(e) => setReferenceNumber(e.target.value)}
        />
      </label>
      <label className="block">
        Covers
        <input
          className={fieldClass}
          required
          placeholder="Medication A, 3 months"
          value={covers}
          onChange={(e) => setCovers(e.target.value)}
        />
      </label>
      <label className="block">
        Stock Item
        <select
          className={fieldClass}
          value={stockItemId}
          onChange={(e) => setStockItemId(e.target.value)}
        >
          <option value="">None</option>
          {stockItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.strength ? `${item.name} ${item.strength}` : item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Issued on
        <input
          className={fieldClass}
          type="date"
          value={issuedOn}
          onChange={(e) => setIssuedOn(e.target.value)}
        />
      </label>
      <label className="block">
        Expires on
        <input
          className={fieldClass}
          type="date"
          required
          value={expiresOn}
          onChange={(e) => setExpiresOn(e.target.value)}
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
