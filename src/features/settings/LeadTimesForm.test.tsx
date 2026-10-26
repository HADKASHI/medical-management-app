import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LeadTimesForm } from './LeadTimesForm';

function fill(first: string, second: string, last: string) {
  fireEvent.change(screen.getByLabelText('First notice (days before expiry)'), {
    target: { value: first },
  });
  fireEvent.change(screen.getByLabelText('Second notice (days before expiry)'), {
    target: { value: second },
  });
  fireEvent.change(screen.getByLabelText('Last notice (days before expiry)'), {
    target: { value: last },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save lead times' }));
}

describe('Authorization lead times form', () => {
  it('shows the current lead times', () => {
    render(<LeadTimesForm value={[30, 7, 0]} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('First notice (days before expiry)')).toHaveValue(30);
    expect(screen.getByLabelText('Second notice (days before expiry)')).toHaveValue(7);
    expect(screen.getByLabelText('Last notice (days before expiry)')).toHaveValue(0);
  });

  it('saves three decreasing lead times', () => {
    const onSubmit = vi.fn();
    render(<LeadTimesForm value={[30, 7, 0]} onSubmit={onSubmit} />);

    fill('60', '14', '1');

    expect(onSubmit).toHaveBeenCalledWith([60, 14, 1]);
  });

  it('rejects lead times that are not strictly decreasing', () => {
    const onSubmit = vi.fn();
    render(<LeadTimesForm value={[30, 7, 0]} onSubmit={onSubmit} />);

    fill('7', '7', '0');

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Each notice must come fewer days before expiry than the one before it.',
    );
  });

  it('rejects days outside 0 to 365 or not whole', () => {
    const onSubmit = vi.fn();
    render(<LeadTimesForm value={[30, 7, 0]} onSubmit={onSubmit} />);

    fill('400', '7', '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Lead times are whole days from 0 to 365.');

    fill('30', '7.5', '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Lead times are whole days from 0 to 365.');

    fill('30', '', '0');
    expect(screen.getByRole('alert')).toHaveTextContent('Lead times are whole days from 0 to 365.');

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
