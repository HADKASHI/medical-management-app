import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Authorization } from '@/features/authorizations/authorizations';
import { AppointmentForm } from './AppointmentForm';

function authorization(overrides: Partial<Authorization>): Authorization {
  return {
    id: 'a0',
    owner_id: '00000000-0000-4000-8000-00000000000a',
    type: 'form_17',
    reference_number: 'F17-2001',
    covers: '6 physio sessions at Clinic B',
    stock_item_id: null,
    issued_on: null,
    expires_on: '2026-06-01',
    renews_authorization_id: null,
    archived_at: null,
    created_at: '2026-01-01T07:00:00Z',
    renewed: false,
    ...overrides,
  };
}

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
      authorization_id: null,
    });
  });

  it('offers current Authorizations, keeping the one already linked', () => {
    const onSubmit = vi.fn();
    const authorizations = [
      authorization({ id: 'current', reference_number: 'F17-2002' }),
      authorization({ id: 'renewed', reference_number: 'F17-1001', renewed: true }),
      authorization({ id: 'archived', type: 'commitment', archived_at: '2026-03-01T07:00:00Z' }),
      authorization({
        id: 'linked',
        type: 'commitment',
        reference_number: 'C-3001',
        renewed: true,
      }),
    ];
    render(
      <AppointmentForm
        initial={{
          title: 'Physiotherapy',
          starts_at: '2026-03-12T08:00:00.000Z',
          ends_at: '2026-03-12T08:45:00.000Z',
          provider: null,
          location: null,
          notes: null,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          send_to_work_calendar: true,
          authorization_id: 'linked',
        }}
        authorizations={authorizations}
        onSubmit={onSubmit}
      />,
    );

    const picker = screen.getByLabelText('Authorization');
    expect(picker).toHaveValue('linked');
    expect(Array.from(picker.querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'None',
      'Form 17 F17-2002: 6 physio sessions at Clinic B',
      'Commitment C-3001: 6 physio sessions at Clinic B',
    ]);

    fill('Authorization', 'current');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ authorization_id: 'current' }));
  });
});
