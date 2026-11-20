/** The audit trail as returned by the API, with French labels. */

export interface AuditEntry {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  patientId: string | null;
  ipAddress: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; email?: string; role: string };
}

export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'FINALIZE';

export const AUDIT_ACTIONS: Record<AuditAction, { label: string; className: string }> = {
  READ: { label: 'Consultation', className: 'bg-muted text-muted-foreground border-border' },
  CREATE: { label: 'Création', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  UPDATE: { label: 'Modification', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  DELETE: { label: 'Suppression', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800' },
  EXPORT: { label: 'Téléchargement', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200 dark:border-violet-800' },
  FINALIZE: { label: 'Finalisation', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  LOGIN: { label: 'Connexion', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  LOGOUT: { label: 'Déconnexion', className: 'bg-muted text-muted-foreground border-border' },
};

export const AUDIT_ENTITIES: Record<string, string> = {
  patient: 'Dossier patient',
  consultation: 'Séance',
  measurement: 'Mesure',
  topic_note: 'Thématique',
  life_event: 'Événement de vie',
  goal: 'Objectif',
  document: 'Document',
  appointment: 'Rendez-vous',
  user: 'Compte',
  session: 'Session',
};

/** A patient shown as a reference, not a name (the admin does not see patients' identities). */
export const patientRef = (id: string | null) => (id ? `#${id.slice(0, 8)}` : '—');
