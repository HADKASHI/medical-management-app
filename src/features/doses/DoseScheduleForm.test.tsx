import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DoseScheduleForm } from './DoseScheduleForm';

function setTime(index: number, time: string, amount: string) {
  fireEvent.change(screen.getAllByLabelText('Time')[index]!, { target: { value: time } });
  fireEvent.change(screen.getAllByLabelText('Amount')[index]!, { target: { value: amount } });
}

function save() {
  fireEvent.click(screen.getByRole('button', { name: 'Save schedule' }));
}

describe('Dose Schedule form', () => {
  it('builds a daily schedule with an amount at each time', () => {
    const onSubmit = vi.fn();
    render(<DoseScheduleForm onSubmit={onSubmit} />);

    setTime(0, '08:00', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Add time' }));
    setTime(1, '20:00', '2');
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      pattern: 'daily',
      times: [
        { time_of_day: '08:00', amount: 1 },
        { time_of_day: '20:00', amount: 2 },
      ],
      weekdays: null,
      interval_days: null,
      effective_from: null,
    });
  });

  it('builds a weekdays schedule from the ticked days', () => {
    const onSubmit = vi.fn();
    render(<DoseScheduleForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Pattern'), { target: { value: 'weekdays' } });
    fireEvent.click(screen.getByLabelText('Wed'));
    fireEvent.click(screen.getByLabelText('Mon'));
    setTime(0, '09:00', '1');
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      pattern: 'weekdays',
      times: [{ time_of_day: '09:00', amount: 1 }],
      weekdays: [1, 3],
      interval_days: null,
      effective_from: null,
    });
  });

  it('builds an every-N-days schedule with its start date', () => {
    const onSubmit = vi.fn();
    render(<DoseScheduleForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Pattern'), { target: { value: 'every_n_days' } });
    fireEvent.change(screen.getByLabelText('Every N days'), { target: { value: '14' } });
    fireEvent.change(screen.getByLabelText('Starts on'), { target: { value: '2026-11-02' } });
    setTime(0, '10:00', '0.5');
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      pattern: 'every_n_days',
      times: [{ time_of_day: '10:00', amount: 0.5 }],
      weekdays: null,
      interval_days: 14,
      effective_from: '2026-11-02',
    });
  });

  it('builds an As Needed schedule with no Dose Times', () => {
    const onSubmit = vi.fn();
    render(<DoseScheduleForm onSubmit={onSubmit} />);

    setTime(0, '08:00', '1');
    fireEvent.change(screen.getByLabelText('Pattern'), { target: { value: 'as_needed' } });

    expect(screen.queryByLabelText('Time')).not.toBeInTheDocument();
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      pattern: 'as_needed',
      times: [],
      weekdays: null,
      interval_days: null,
      effective_from: null,
    });
  });

  it('starts from the current version when editing', () => {
    const onSubmit = vi.fn();
    render(
      <DoseScheduleForm
        initial={{
          pattern: 'weekdays',
          times: [{ time_of_day: '07:30', amount: 1 }],
          weekdays: [5],
          interval_days: null,
          effective_from: null,
        }}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByLabelText('Sun'));
    save();

    expect(onSubmit).toHaveBeenCalledWith({
      pattern: 'weekdays',
      times: [{ time_of_day: '07:30', amount: 1 }],
      weekdays: [0, 5],
      interval_days: null,
      effective_from: null,
    });
  });
});
