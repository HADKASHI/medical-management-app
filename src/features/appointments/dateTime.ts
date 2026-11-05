import { formatAppDateTime, fromAppDateTimeInput, toAppDateTimeInput } from '@/lib/time';

/** A timestamp as a `datetime-local` input value (YYYY-MM-DDTHH:mm) in Israel time. */
export const toLocalInput = toAppDateTimeInput;

/** A `datetime-local` input value, read in Israel time, as an ISO timestamp. */
export const fromLocalInput = fromAppDateTimeInput;

/** A timestamp for display in Israel time, e.g. "Thu, 12 Mar 2026, 10:00". */
export const formatDateTime = formatAppDateTime;
