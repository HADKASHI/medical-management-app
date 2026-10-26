import { Link } from 'react-router';
import { useAlerts } from '@/features/alerts/alerts';

export function AlertsPage() {
  const { data, isPending, error } = useAlerts();

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Alerts</h1>
      {isPending && <p>Loading…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      {data?.length === 0 && <p>No Alerts.</p>}
      <ul aria-label="Alerts" className="divide-y divide-gray-200">
        {data?.map((alert) => (
          <li key={`${alert.kind}-${alert.stock_item_id}`} className="py-2">
            <Link
              to={`/stock/${alert.stock_item_id}`}
              className={
                alert.needs_stock_count ? 'font-semibold text-red-700 underline' : 'underline'
              }
            >
              {alert.message}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/" className="underline">
        Home
      </Link>
    </main>
  );
}
