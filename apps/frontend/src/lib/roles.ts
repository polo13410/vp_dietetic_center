import type { UserRole } from '@vp/types';

type Role = `${UserRole}`;

/** Admins manage the app and its users; practitioners (and assistants) work with patients. */
export const CLINICAL_ROLES: Role[] = ['PRATICIENNE', 'ASSISTANTE'];
export const ADMIN_ROLES: Role[] = ['ADMIN'];

/** Where a user lands after signing in, or when opening a page their role cannot see. */
export function homePathFor(role: Role | undefined): string {
  return role === 'ADMIN' ? '/admin/users' : '/dashboard';
}
