import type { PatientImportDraftDto, PatientImportPreviewDto, PatientImportSessionDto } from '@vp/types';

export type { PatientImportDraftDto, PatientImportPreviewDto, PatientImportSessionDto };

/** The files she can import: her Numbers files, or an Excel export of one. */
export const IMPORT_ACCEPT = '.numbers,.xlsx';
export const isImportFile = (name: string) => /\.(numbers|xlsx)$/i.test(name);

/** What must be corrected before importing; an empty object when nothing. */
export function importErrors(draft: PatientImportDraftDto): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.firstName.trim()) errors.firstName = 'Indiquez le prénom.';
  if (!draft.lastName.trim()) errors.lastName = 'Indiquez le nom.';
  if (draft.age !== null && (!Number.isInteger(draft.age) || draft.age < 0 || draft.age > 120)) {
    errors.age = 'Un âge entre 0 et 120 ans.';
  }
  draft.sessions.forEach((s, i) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) errors[`session-${i}`] = `${s.label} : indiquez la date.`;
  });
  return errors;
}

/** The draft as the API takes it, trimmed. */
export function importPayload(draft: PatientImportDraftDto, allowDuplicate: boolean) {
  const clean = (value: string | null) => (value?.trim() ? value.trim() : null);
  return {
    ...draft,
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    phone: clean(draft.phone),
    email: clean(draft.email),
    allowDuplicate,
  };
}

/**
 * The sessions in date order, with the ones whose date breaks her row order: a « Bilan » dated
 * after « Suivi 1 » is most likely a typo she corrects here.
 */
export function outOfOrder(sessions: PatientImportSessionDto[]): Set<number> {
  const flagged = new Set<number>();
  for (let i = 1; i < sessions.length; i++) {
    if (sessions[i].date && sessions[i - 1].date && sessions[i].date < sessions[i - 1].date) {
      flagged.add(i - 1);
      flagged.add(i);
    }
  }
  return flagged;
}

/** « 3 séances, du 4 mars 2025 au 1er avril 2026 »-like count of what will be saved. */
export function importSummary(draft: PatientImportDraftDto): string {
  const n = draft.sessions.length;
  const sections = Object.values(draft.file).filter((v) => v?.trim()).length;
  const parts = [
    n === 0 ? 'aucune séance' : `${n} séance${n > 1 ? 's' : ''}`,
    `${sections} rubrique${sections > 1 ? 's' : ''} du dossier médical`,
  ];
  return parts.join(', ');
}

export const apiMessage = (error: unknown): string | undefined => {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join(' ') : message;
};
