import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppointmentForm } from './AppointmentForm';

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('Appointment form', () => {
  it('rejects an end before the start', () => {
    const onSubmit = vi.fn();
    render(<AppointmentForm onSubmit={onSubmit} />);

    fill('Title', 'Physiotherapy');
    fill('Start', '2026-03-12T10:00');
    fill('End', '2026-03-12T09:30');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('The end must be after the start.');
  });

  it('submits an Appointment with its Travel Buffers and work calendar switch', () => {
    const onSubmit = vi.fn();
    render(<AppointmentForm onSubmit={onSubmit} />);

    fill('Title', 'Physiotherapy');
    fill('Start', '2026-03-12T10:00');
    fill('End', '2026-03-12T10:45');
    fill('Provider', 'Clinic A');
    fill('Location', 'Example Street 1');
    fill('Notes', 'Bring the referral');
    fill('Travel Buffer before (minutes)', '20');
    fill('Travel Buffer after (minutes)', '30');
    fireEvent.click(screen.getByLabelText('Send to work calendar'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Physiotherapy',
      starts_at: new Date('2026-03-12T10:00').toISOString(),
      ends_at: new Date('2026-03-12T10:45').toISOString(),
      provider: 'Clinic A',
      location: 'Example Street 1',
      notes: 'Bring the referral',
      buffer_before_minutes: 20,
      buffer_after_minutes: 30,
      send_to_work_calendar: false,
    });
  });
});
