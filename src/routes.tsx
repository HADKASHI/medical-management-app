import type { RouteObject } from 'react-router';
import { RequireAal2 } from './components/RequireAal2';
import { AlertsPage } from './pages/AlertsPage';
import { AuthorizationPage } from './pages/AuthorizationPage';
import { AuthorizationsPage } from './pages/AuthorizationsPage';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { SignInPage } from './pages/SignInPage';
import { StockItemPage } from './pages/StockItemPage';
import { StockPage } from './pages/StockPage';

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
    path: '/alerts',
    element: (
      <RequireAal2>
        <AlertsPage />
      </RequireAal2>
    ),
  },
  {
    path: '/stock',
    element: (
      <RequireAal2>
        <StockPage />
      </RequireAal2>
    ),
  },
  {
    path: '/stock/new',
    element: (
      <RequireAal2>
        <StockItemPage />
      </RequireAal2>
    ),
  },
  {
    path: '/stock/:id',
    element: (
      <RequireAal2>
        <StockItemPage />
      </RequireAal2>
    ),
  },
  {
    path: '/authorizations',
    element: (
      <RequireAal2>
        <AuthorizationsPage />
      </RequireAal2>
    ),
  },
  {
    path: '/authorizations/new',
    element: (
      <RequireAal2>
        <AuthorizationPage />
      </RequireAal2>
    ),
  },
  {
    path: '/authorizations/:id',
    element: (
      <RequireAal2>
        <AuthorizationPage />
      </RequireAal2>
    ),
  },
  {
    path: '/authorizations/:id/renew',
    element: (
      <RequireAal2>
        <AuthorizationPage renew />
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
