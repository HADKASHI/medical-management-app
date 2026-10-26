import { Link } from 'react-router';

export function HomePage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Medical Management</h1>
      <Link to="/stock" className="block underline">
        Stock
      </Link>
      <Link to="/appointments" className="block underline">
        Appointments
      </Link>
      <Link to="/settings" className="block underline">
        Settings
      </Link>
    </main>
  );
}
