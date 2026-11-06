import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { StockItem } from '@/features/stock/stockItems';
import { StockPage } from './StockPage';

const items: StockItem[] = [
  stockItem({ id: '1', name: 'Medication A', strength: '50 mg', quantity: -2.5, unit: 'pill' }),
  stockItem({ id: '2', name: 'Supply A', kind: 'supply', quantity: 40, unit: 'strip' }),
  stockItem({ id: '3', name: 'Medication B', archived_at: '2026-03-10T07:00:00Z' }),
];

vi.mock('@/features/stock/stockItems', () => ({
  useStockItems: () => ({ data: items, isPending: false, error: null }),
}));

function stockItem(overrides: Partial<StockItem>): StockItem {
  return {
    id: '0',
    owner_id: '00000000-0000-4000-8000-00000000000a',
    name: 'Item',
    kind: 'medication',
    strength: null,
    unit: 'pill',
    quantity: 10,
    low_stock_threshold: 5,
    pack_size: null,
    archived_at: null,
    created_at: '2026-03-01T07:00:00Z',
    ...overrides,
  };
}

function renderPage() {
  render(
    <MemoryRouter>
      <StockPage />
    </MemoryRouter>,
  );
}

describe('Stock list', () => {
  it('flags a negative quantity', () => {
    renderPage();

    const negative = screen.getByRole('listitem', { name: /Medication A/ });
    expect(within(negative).getByText('-2.5 pill')).toBeInTheDocument();
    expect(within(negative).getByText('Negative: do a Stock Count')).toBeInTheDocument();

    const positive = screen.getByRole('listitem', { name: /Supply A/ });
    expect(within(positive).getByText('40 strip')).toBeInTheDocument();
    expect(within(positive).queryByText(/Negative/)).not.toBeInTheDocument();
  });

  it('shows Archived items separately from active ones', () => {
    renderPage();

    const active = screen.getByRole('list', { name: 'Active' });
    const archived = screen.getByRole('list', { name: 'Archived' });
    expect(within(active).queryByText(/Medication B/)).not.toBeInTheDocument();
    expect(within(archived).getByText(/Medication B/)).toBeInTheDocument();
  });
});
