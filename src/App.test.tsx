import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('App', () => {
  it('runs in the jsdom project and renders the home page', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(<RouterProvider router={router} />);

    expect(screen.getByRole('heading', { name: 'Medical Management' })).toBeInTheDocument();
  });
});
