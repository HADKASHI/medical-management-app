import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackupAuthenticator } from './BackupAuthenticator';

const factors = vi.hoisted(() => ({ verified: 1 }));
const start = vi.fn();
const verify = vi.fn();

vi.mock('./authenticators', () => ({
  useVerifiedFactorCount: () => ({ data: factors.verified, isPending: false, error: null }),
  useStartBackupEnrolment: () => ({
    mutate: start,
    data: start.mock.calls.length
      ? { factorId: 'f2', qrCode: 'data:image/svg+xml;utf8,<svg/>', secret: 'EXAMPLESECRET' }
      : undefined,
    isPending: false,
    error: null,
  }),
  useVerifyBackupEnrolment: () => ({ mutate: verify, isPending: false, error: null }),
}));

describe('Backup authenticator', () => {
  beforeEach(() => {
    start.mockReset();
    verify.mockReset();
  });

  it('offers to add a backup when only the main authenticator is set up', () => {
    factors.verified = 1;
    const { rerender } = render(<BackupAuthenticator />);

    fireEvent.click(screen.getByRole('button', { name: 'Add backup authenticator' }));
    expect(start).toHaveBeenCalled();
    rerender(<BackupAuthenticator />);

    expect(screen.getByAltText('Backup authenticator QR code')).toBeInTheDocument();
    expect(screen.getByText('EXAMPLESECRET')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Authentication code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify backup' }));

    expect(verify).toHaveBeenCalledWith({ factorId: 'f2', code: '123456' });
  });

  it('says both authenticators are set up once the backup is verified', () => {
    factors.verified = 2;
    render(<BackupAuthenticator />);

    expect(screen.getByText('Main and backup authenticators are set up.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Add backup authenticator' }),
    ).not.toBeInTheDocument();
  });
});
