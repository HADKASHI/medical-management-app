import { Link } from 'react-router';
import { useAuthorizations, type Authorization } from '@/features/authorizations/authorizations';
import { authorizationTitle } from '@/features/authorizations/labels';

/** Current Authorizations, then renewed and Archived ones, soonest expiry first. */
export function AuthorizationsPage() {
  const { data, isPending, error } = useAuthorizations();
  const all = data ?? [];
  const current = all.filter((a) => !a.renewed && !a.archived_at);
  const renewed = all.filter((a) => a.renewed && !a.archived_at);
  const archived = all.filter((a) => a.archived_at);

  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Authorizations</h1>
      <Link to="/authorizations/new" className="underline">
        Add Authorization
      </Link>
      {isPending && <p>Loading…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error.message}
        </p>
      )}
      <AuthorizationList label="Current" items={current} />
      {renewed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Renewed</h2>
          <AuthorizationList label="Renewed" items={renewed} />
        </section>
      )}
      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Archived</h2>
          <AuthorizationList label="Archived" items={archived} />
        </section>
      )}
      <Link to="/" className="underline">
        Home
      </Link>
    </main>
  );
}

function AuthorizationList({ label, items }: { label: string; items: Authorization[] }) {
  return (
    <ul aria-label={label} className="divide-y divide-gray-200">
      {items.map((a) => {
        const title = authorizationTitle(a);
        return (
          <li key={a.id} aria-label={`${title}: ${a.covers}`} className="py-2">
            <Link to={`/authorizations/${a.id}`} className="underline">
              {title}
            </Link>
            <span className="block text-sm text-gray-600">
              {a.covers} · expires {a.expires_on}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
