import type { Authorization, AuthorizationType } from './authorizations';

export const authorizationTypeLabels: Record<AuthorizationType, string> = {
  prescription: 'Prescription',
  form_17: 'Form 17',
  commitment: 'Commitment',
};

/** How an Authorization is named in lists and pickers: "Form 17 F17-2001". */
export function authorizationTitle(a: Pick<Authorization, 'type' | 'reference_number'>): string {
  return `${authorizationTypeLabels[a.type]} ${a.reference_number}`;
}
