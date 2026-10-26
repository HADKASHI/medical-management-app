import { Link, useNavigate, useParams } from 'react-router';
import { StockItemForm } from '@/features/stock/StockItemForm';
import {
  useArchiveStockItem,
  useSaveStockItem,
  useStockItems,
  type StockItemInput,
} from '@/features/stock/stockItems';

/** Create a Stock Item (`/stock/new`) or edit and archive one (`/stock/:id`). */
export function StockItemPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const items = useStockItems();
  const save = useSaveStockItem();
  const archive = useArchiveStockItem();
  const item = id ? items.data?.find((i) => i.id === id) : undefined;
  const error = save.error ?? archive.error;

  if (id && items.isPending) return <p className="p-4">Loading…</p>;
  if (id && !item) {
    return (
      <main className="mx-auto max-w-xl space-y-4 p-4">
        <p>Stock Item not found.</p>
        <Link to="/stock" className="underline">
          Stock
        </Link>
      </main>
    );
  }

  function handleSubmit(input: StockItemInput) {
    save.mutate({ id, input }, { onSuccess: () => navigate('/stock') });
  }

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">{item ? 'Edit Stock Item' : 'New Stock Item'}</h1>
      {item?.archived_at && <p className="text-gray-600">Archived</p>}
      <StockItemForm initial={item} submitting={save.isPending} onSubmit={handleSubmit} />
      {item && !item.archived_at && (
        <button
          type="button"
          disabled={archive.isPending}
          className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
          onClick={() => archive.mutate(item.id, { onSuccess: () => navigate('/stock') })}
        >
          Archive
        </button>
      )}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      <Link to="/stock" className="block underline">
        Stock
      </Link>
    </main>
  );
}
