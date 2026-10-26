import { Link } from 'react-router';

export function HomePage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Medical Management</h1>
      <Link to="/settings" className="underline">
        Settings
      </Link>
    </main>
  );
}
