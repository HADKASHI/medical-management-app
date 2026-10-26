import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RestockForm } from './RestockForm';

describe('Restock form', () => {
  it('converts packs to units', () => {
    const onSubmit = vi.fn();
    render(<RestockForm packSize={30} unit="pill" today="2026-03-10" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByLabelText('Packs'));
    fireEvent.change(screen.getByLabelText('Number of packs'), { target: { value: '2' } });

    expect(screen.getByText('= 60 pill')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Pharmacy A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restock' }));

    expect(onSubmit).toHaveBeenCalledWith({
      packs: 2,
      restocked_on: '2026-03-10',
      note: 'Pharmacy A',
    });
  });

  it('submits a Restock in units', () => {
    const onSubmit = vi.fn();
    render(<RestockForm packSize={30} unit="pill" today="2026-03-10" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Units (pill)'), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-08' } });
    fireEvent.click(screen.getByRole('button', { name: 'Restock' }));

    expect(onSubmit).toHaveBeenCalledWith({
      quantity: 15,
      restocked_on: '2026-03-08',
      note: null,
    });
  });

  it('needs Pack Size for packs', () => {
    render(<RestockForm packSize={null} unit="pill" today="2026-03-10" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Packs')).toBeDisabled();
    expect(screen.getByText('Set a Pack Size to restock in packs.')).toBeInTheDocument();
  });
});
