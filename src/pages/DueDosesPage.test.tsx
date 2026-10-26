import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { DueDose } from '@/features/doses/dueDoses';
import { DueDosesPage } from './DueDosesPage';

const doses: DueDose[] = [
  dueDose({ id: 'd1', due_at: '2026-01-05T06:00:00Z', name: 'Medication A', amount: 1 }),
  dueDose({ id: 'd2', due_at: '2026-01-05T06:00:00Z', name: 'Medication B', amount: 2 }),
];

const takeDoses = vi.fn();
const setDoseStatus = vi.fn();

vi.mock('@/features/doses/dueDoses', () => ({
  useDueDoses: () => ({ data: doses, isPending: false, error: null }),
  useTakeDoses: () => ({ mutate: takeDoses, isPending: false, error: null }),
  useSetDoseStatus: () => ({ mutate: setDoseStatus, isPending: false, error: null }),
}));

function dueDose({
  id,
  due_at,
  name,
  amount,
}: {
  id: string;
  due_at: string;
  name: string;
  amount: number;
}): DueDose {
  return { id, due_at, amount, stock_item: { name, strength: null, unit: 'pill' } };
}

function renderPage() {
  render(
    <MemoryRouter>
      <DueDosesPage />
    </MemoryRouter>,
  );
}

describe('Due Doses', () => {
  it('All taken calls the RPC with every pending Dose', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'All taken' }));

    expect(takeDoses).toHaveBeenCalledWith(['d1', 'd2'], expect.anything());
  });

  it('takes or skips one Dose', () => {
    renderPage();

    const second = screen.getByRole('listitem', { name: /Medication B/ });
    expect(within(second).getByText('2 pill')).toBeInTheDocument();
    fireEvent.click(within(second).getByRole('button', { name: 'Taken' }));
    expect(setDoseStatus).toHaveBeenLastCalledWith(
      { doseId: 'd2', status: 'taken' },
      expect.anything(),
    );

    fireEvent.click(within(second).getByRole('button', { name: 'Skip' }));
    expect(setDoseStatus).toHaveBeenLastCalledWith(
      { doseId: 'd2', status: 'skipped' },
      expect.anything(),
    );
  });
});
