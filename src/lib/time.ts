import { tz, TZDate } from '@date-fns/tz';
import { addWeeks, format, parse } from 'date-fns';

/**
 * The owner's time zone: one app-wide setting, the same as the database's
 * app.time_zone(). Every instant is stored in UTC and read and shown in this
 * zone, whatever zone the device is in.
 */
export const APP_TIME_ZONE = 'Asia/Jerusalem';

const inApp = tz(APP_TIME_ZONE);

const INPUT_PATTERN = "yyyy-MM-dd'T'HH:mm";

/** Today's date in the app time zone: "2026-03-12". */
export function todayInApp(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd', { in: inApp });
}

/** A timestamp as a `datetime-local` input value (YYYY-MM-DDTHH:mm) in the app time zone. */
export function toAppDateTimeInput(iso: string): string {
  return format(new Date(iso), INPUT_PATTERN, { in: inApp });
}

/** A `datetime-local` input value, read in the app time zone, as an ISO timestamp. */
export function fromAppDateTimeInput(value: string): string {
  return new Date(+parse(value, INPUT_PATTERN, new Date(), { in: inApp })).toISOString();
}

/** A timestamp shown in the app time zone with a date-fns pattern. */
export function formatInApp(iso: string, pattern: string): string {
  return format(new Date(iso), pattern, { in: inApp });
}

/** A timestamp for display, e.g. "Thu, 12 Mar 2026, 10:00". */
export function formatAppDateTime(iso: string): string {
  return formatInApp(iso, 'EEE, d MMM yyyy, HH:mm');
}

/** The same wall-clock time `weeks` weeks later in the app time zone, as an ISO timestamp. */
export function addAppWeeks(iso: string, weeks: number): string {
  return new Date(+addWeeks(new TZDate(iso, APP_TIME_ZONE), weeks)).toISOString();
}
