import { afterAll, describe, expect, it, vi } from 'vitest';
import {
  APP_TIME_ZONE,
  addAppWeeks,
  formatAppDateTime,
  fromAppDateTimeInput,
  todayInApp,
  toAppDateTimeInput,
} from './time';

// Whatever zone the device is in, the app reads and shows Israel time.
afterAll(() => {
  vi.unstubAllEnvs();
});

describe.each(['UTC', 'America/New_York', 'Pacific/Kiritimati'])('on a device in %s', (zone) => {
  it('runs in that zone', () => {
    vi.stubEnv('TZ', zone);
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(zone);
  });

  it('uses Asia/Jerusalem as the app time zone', () => {
    expect(APP_TIME_ZONE).toBe('Asia/Jerusalem');
  });

  it("reads today's date in Israel", () => {
    vi.stubEnv('TZ', zone);
    // 22:30 UTC on 11 March is already 00:30 on 12 March in Israel (UTC+2)
    expect(todayInApp(new Date('2026-03-11T22:30:00Z'))).toBe('2026-03-12');
    // 20:30 UTC on 1 July is 23:30 the same day (UTC+3, daylight saving)
    expect(todayInApp(new Date('2026-07-01T20:30:00Z'))).toBe('2026-07-01');
  });

  it('shows a timestamp as an Israel wall-clock input value', () => {
    vi.stubEnv('TZ', zone);
    expect(toAppDateTimeInput('2026-03-12T08:00:00Z')).toBe('2026-03-12T10:00');
    expect(toAppDateTimeInput('2026-07-01T07:00:00Z')).toBe('2026-07-01T10:00');
  });

  it('reads an input value as Israel wall-clock time', () => {
    vi.stubEnv('TZ', zone);
    expect(fromAppDateTimeInput('2026-03-12T10:00')).toBe('2026-03-12T08:00:00.000Z');
    expect(fromAppDateTimeInput('2026-07-01T10:00')).toBe('2026-07-01T07:00:00.000Z');
  });

  it('formats a timestamp for display in Israel time', () => {
    vi.stubEnv('TZ', zone);
    expect(formatAppDateTime('2026-03-12T08:00:00Z')).toBe('Thu, 12 Mar 2026, 10:00');
  });

  it('moves a week later on the Israel wall clock, across a daylight-saving change', () => {
    vi.stubEnv('TZ', zone);
    // 10:00 on 24 March (UTC+2) to 10:00 on 31 March (UTC+3)
    expect(addAppWeeks('2026-03-24T08:00:00.000Z', 1)).toBe('2026-03-31T07:00:00.000Z');
  });
});
