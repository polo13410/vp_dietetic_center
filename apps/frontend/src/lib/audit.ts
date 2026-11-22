/** The audit trail as returned by the API, with French labels. */
import type { BadgeTone } from '../components/shared/StatusBadge';

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

export type AuditAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT';

export const AUDIT_ACTIONS: Record<AuditAction, { label: string; tone: BadgeTone }> = {
  READ: { label: 'Consultation', tone: 'neutral' },
  CREATE: { label: 'Création', tone: 'success' },
  UPDATE: { label: 'Modification', tone: 'info' },
  DELETE: { label: 'Suppression', tone: 'danger' },
  EXPORT: { label: 'Téléchargement', tone: 'warning' },
  LOGIN: { label: 'Connexion', tone: 'neutral' },
  LOGOUT: { label: 'Déconnexion', tone: 'neutral' },
};

export const AUDIT_ENTITIES: Record<string, string> = {
  patient: 'Dossier patient',
  consultation: 'Séance',
  measurement: 'Mesure',
  file_entry: 'Dossier médical',
  life_event: 'Événement de vie',
  gp_report: 'Compte rendu au médecin',
  document: 'Document',
  appointment: 'Rendez-vous',
  user: 'Compte',
  session: 'Session',
};

/** A patient shown as a reference, not a name (the admin does not see patients' identities). */
export const patientRef = (id: string | null) => (id ? `#${id.slice(0, 8)}` : '—');
