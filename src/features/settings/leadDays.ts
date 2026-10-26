/** Authorization lead times: days before expires_on, strictly decreasing. */
export type LeadDays = [number, number, number];

/** Used until the owner first saves Settings (the database default too). */
export const DEFAULT_LEAD_DAYS: LeadDays = [30, 7, 0];

/**
 * Checks three lead times the way the database does (app.valid_lead_days):
 * whole days from 0 to 365, each fewer than the one before. Returns the
 * message to show, or null when they are valid.
 */
export function leadDaysError(days: number[]): string | null {
  if (days.length !== 3 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 365))
    return 'Lead times are whole days from 0 to 365.';
  if (!(days[0]! > days[1]! && days[1]! > days[2]!))
    return 'Each notice must come fewer days before expiry than the one before it.';
  return null;
}
