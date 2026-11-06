import { Link } from 'react-router';
import { useStockItems, type StockItem } from '@/features/stock/stockItems';

export function StockPage() {
  const { data, isPending, error } = useStockItems();
  const active = data?.filter((item) => !item.archived_at) ?? [];
  const archived = data?.filter((item) => item.archived_at) ?? [];

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Stock</h1>
      <Link to="/stock/new" className="underline">
        Add Stock Item
      </Link>
      {isPending && <p>Loading…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      <StockList label="Active" items={active} />
      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Archived</h2>
          <StockList label="Archived" items={archived} />
        </section>
      )}
      <Link to="/" className="underline">
        Home
      </Link>
    </main>
  );
}

function StockList({ label, items }: { label: string; items: StockItem[] }) {
  return (
    <ul aria-label={label} className="divide-y divide-gray-200">
      {items.map((item) => (
        <StockRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function StockRow({ item }: { item: StockItem }) {
  const title = item.strength ? `${item.name} ${item.strength}` : item.name;
  const negative = item.quantity < 0;
  return (
    <li aria-label={title} className="flex items-center justify-between gap-2 py-2">
      <Link to={`/stock/${item.id}`} className="underline">
        {title}
      </Link>
      <span className="text-right">
        <span className={negative ? 'font-semibold text-red-700' : undefined}>
          {item.quantity} {item.unit}
        </span>
        {negative && <span className="block text-sm text-red-700">Negative: do a Stock Count</span>}
      </span>
    </li>
  );
}
