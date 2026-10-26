import type { RouteObject } from 'react-router';
import { RequireAal2 } from './components/RequireAal2';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { SignInPage } from './pages/SignInPage';

export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    path: '/',
    element: (
      <RequireAal2>
        <HomePage />
      </RequireAal2>
    ),
  },
  {
    path: '/settings',
    element: (
      <RequireAal2>
        <SettingsPage />
      </RequireAal2>
    ),
  },
];
