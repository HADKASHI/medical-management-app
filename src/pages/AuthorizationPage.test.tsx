import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Authorization } from '@/features/authorizations/authorizations';
import type { StockItem } from '@/features/stock/stockItems';
import { AuthorizationPage } from './AuthorizationPage';

const old: Authorization = {
  id: 'a1',
  owner_id: '00000000-0000-4000-8000-00000000000a',
  type: 'form_17',
  reference_number: 'F17-2001',
  covers: '6 physio sessions at Clinic B',
  stock_item_id: 's1',
  issued_on: '2026-01-01',
  expires_on: '2026-04-01',
  renews_authorization_id: null,
  archived_at: null,
  created_at: '2026-01-01T07:00:00Z',
  renewed: false,
};

const item: StockItem = {
  id: 's1',
  owner_id: '00000000-0000-4000-8000-00000000000a',
  name: 'Medication A',
  kind: 'medication',
  strength: '50 mg',
  unit: 'pill',
  quantity: 10,
  low_stock_threshold: 5,
  pack_size: null,
  archived_at: null,
  created_at: '2026-01-01T07:00:00Z',
};

const save = vi.fn();

vi.mock('@/features/authorizations/authorizations', () => ({
  useAuthorizations: () => ({ data: [old], isPending: false, error: null }),
  useSaveAuthorization: () => ({ mutate: save, isPending: false, error: null }),
  useArchiveAuthorization: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useDeleteAuthorization: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock('@/features/stock/stockItems', () => ({
  useStockItems: () => ({ data: [item], isPending: false, error: null }),
}));

describe('Authorization page', () => {
  it('Renew pre-fills the form from the old Authorization', () => {
    render(
      <MemoryRouter initialEntries={['/authorizations/a1/renew']}>
        <Routes>
          <Route path="/authorizations/:id/renew" element={<AuthorizationPage renew />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Renew Authorization' })).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toHaveValue('form_17');
    expect(screen.getByLabelText('Reference number')).toHaveValue('F17-2001');
    expect(screen.getByLabelText('Covers')).toHaveValue('6 physio sessions at Clinic B');
    expect(screen.getByLabelText('Stock Item')).toHaveValue('s1');
    expect(screen.getByLabelText('Issued on')).toHaveValue('');
    expect(screen.getByLabelText('Expires on')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Issued on'), { target: { value: '2026-03-20' } });
    fireEvent.change(screen.getByLabelText('Expires on'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(save).toHaveBeenCalledWith(
      {
        input: {
          type: 'form_17',
          reference_number: 'F17-2001',
          covers: '6 physio sessions at Clinic B',
          stock_item_id: 's1',
          issued_on: '2026-03-20',
          expires_on: '2026-07-01',
          renews_authorization_id: 'a1',
        },
      },
      expect.anything(),
    );
  });
});
