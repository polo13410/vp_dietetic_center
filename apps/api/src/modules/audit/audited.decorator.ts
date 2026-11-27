import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '@prisma/client';

export const AUDITED_KEY = 'audited';

/** Where to find an id: a route parameter, a body field, or a field of the response. */
type Source = `param:${string}` | `query:${string}` | `body:${string}` | `result:${string}`;

export interface AuditedOptions {
  action: AuditAction;
  entity: string;
  /** Id of the thing read or changed (default: route :id, else the response's id) */
  entityId?: Source;
  /** Patient concerned, so their file's access history can be shown */
  patientId?: Source;
  /** Who acted, when not signed in yet (sign-in endpoints) */
  userId?: Source;
}

/**
 * Records a successful call in the audit trail (who, what, when, from where). Only ids and the
 * route are kept, never the content that was read or written.
 */
export const Audited = (options: AuditedOptions) => SetMetadata(AUDITED_KEY, options);
