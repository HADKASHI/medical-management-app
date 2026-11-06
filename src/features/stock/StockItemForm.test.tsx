import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StockItemForm } from './StockItemForm';

describe('Stock Item form', () => {
  it('hides strength for a supply', () => {
    render(<StockItemForm onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Strength')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'supply' } });

    expect(screen.queryByLabelText('Strength')).not.toBeInTheDocument();
  });

  it('submits a supply without the strength typed before switching Kind', () => {
    const onSubmit = vi.fn();
    render(<StockItemForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Supply A' } });
    fireEvent.change(screen.getByLabelText('Strength'), { target: { value: '50 mg' } });
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'supply' } });
    fireEvent.change(screen.getByLabelText('Unit'), { target: { value: 'strip' } });
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText('Low-Stock Threshold'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Supply A',
      kind: 'supply',
      strength: null,
      unit: 'strip',
      quantity: 12.5,
      low_stock_threshold: 10,
      pack_size: null,
    });
  });

  it('sets quantity only at creation; an edit points to Stock Count', () => {
    const onSubmit = vi.fn();
    render(
      <StockItemForm
        initial={{
          name: 'Medication A',
          kind: 'medication',
          strength: '50 mg',
          unit: 'pill',
          quantity: 30,
          low_stock_threshold: 10,
          pack_size: 30,
        }}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByLabelText('Quantity')).not.toBeInTheDocument();
    expect(screen.getByText(/Stock Count/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ quantity: expect.anything() }),
    );
  });
});
