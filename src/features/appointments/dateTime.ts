/** A timestamp as a `datetime-local` input value (YYYY-MM-DDTHH:mm) in the device's time. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` input value, read in the device's time, as an ISO timestamp. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

/** A timestamp for display, e.g. "Thu, 12 Mar 2026, 10:00". */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
