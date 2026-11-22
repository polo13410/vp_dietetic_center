/** The new patient wizard: what each step holds, how it is checked and what is sent to the API. */
import type { FileField, FileSectionDto, Measurement, Patient } from './patient-file';
import { FILE_FIELD_TYPES } from './patient-file';
import { ageInYears, todayISO } from './utils';

// ─── Step 1: who is it ───────────────────────────────────────────────────────

export interface IdentityDraft {
  firstName: string;
  lastName: string;
  sex: 'F' | 'M' | '';
  /** She only knows the age: an estimated birth year is stored (docs/REFONTE.md § 3.1) */
  ageOnly: boolean;
  /** YYYY-MM-DD */
  dateOfBirth: string;
  age: string;
}

export type IdentityErrors = Partial<Record<'firstName' | 'lastName' | 'dateOfBirth' | 'age', string>>;

export const EMPTY_IDENTITY: IdentityDraft = {
  firstName: '',
  lastName: '',
  sex: '',
  ageOnly: false,
  dateOfBirth: '',
  age: '',
};

export function identityErrors(draft: IdentityDraft): IdentityErrors {
  const errors: IdentityErrors = {};
  if (!draft.firstName.trim()) errors.firstName = 'Indiquez le prénom.';
  if (!draft.lastName.trim()) errors.lastName = 'Indiquez le nom.';
  if (draft.ageOnly) {
    if (draft.age && (!/^\d{1,3}$/.test(draft.age) || Number(draft.age) > 120)) {
      errors.age = 'Indiquez un âge entre 0 et 120 ans.';
    }
  } else if (draft.dateOfBirth) {
    const year = Number(draft.dateOfBirth.slice(0, 4));
    if (year < 1900 || draft.dateOfBirth > todayISO()) {
      errors.dateOfBirth = 'La date de naissance n’est pas valide.';
    }
  }
  return errors;
}

/** Body of POST /patients or PATCH /patients/:id. An empty birth date or age clears it. */
export function identityPayload(draft: IdentityDraft) {
  const birth =
    draft.ageOnly && draft.age
      ? { age: Number(draft.age) }
      : { dateOfBirth: !draft.ageOnly && draft.dateOfBirth ? draft.dateOfBirth : null };
  return {
    firstName: draft.firstName.trim(),
    lastName: draft.lastName.trim(),
    sex: draft.sex || null,
    ...birth,
  };
}

export function identityFromPatient(patient: Patient): IdentityDraft {
  const estimated = patient.birthDateEstimated;
  const age = ageInYears(patient.dateOfBirth);
  return {
    firstName: patient.firstName,
    lastName: patient.lastName,
    sex: patient.sex ?? '',
    ageOnly: estimated,
    dateOfBirth: !estimated ? (patient.dateOfBirth?.slice(0, 10) ?? '') : '',
    age: estimated && age !== null ? String(age) : '',
  };
}

/** A name typed in the patient search, split into first and last name (« Marie Dupont »). */
export function identityFromSearch(search: string): IdentityDraft {
  const words = search.trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { ...EMPTY_IDENTITY, lastName: words[0] ?? '' };
  return { ...EMPTY_IDENTITY, firstName: words[0], lastName: words.slice(1).join(' ') };
}

// ─── Steps 2 and 3: plain text fields of the patient ─────────────────────────

export const CONTACT_KEYS = ['phone', 'email', 'address', 'zipCode', 'city'] as const;
export const SITUATION_KEYS = ['familySituation', 'profession', 'gpName', 'referralSource'] as const;

export type ContactDraft = Record<(typeof CONTACT_KEYS)[number], string>;
export type SituationDraft = Record<(typeof SITUATION_KEYS)[number], string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function contactErrors(draft: ContactDraft): Partial<Record<keyof ContactDraft, string>> {
  const email = draft.email.trim();
  return email && !EMAIL.test(email) ? { email: 'L’adresse e-mail n’est pas valide.' } : {};
}

function pick<K extends string>(patient: Patient | undefined, keys: readonly K[]): Record<K, string> {
  const source = (patient ?? {}) as Partial<Record<K, string | null>>;
  return Object.fromEntries(keys.map((k) => [k, source[k] ?? ''])) as Record<K, string>;
}

export const contactFromPatient = (patient?: Patient) => pick(patient, CONTACT_KEYS);
export const situationFromPatient = (patient?: Patient) => pick(patient, SITUATION_KEYS);

/** The fields that changed since the last save, trimmed; an emptied field is sent as null. */
export function changedFields<T extends Record<string, string>>(draft: T, saved: T): Partial<Record<keyof T, string | null>> {
  const changes: Partial<Record<keyof T, string | null>> = {};
  for (const key of Object.keys(draft) as (keyof T)[]) {
    const value = draft[key].trim();
    if (value !== saved[key].trim()) changes[key] = value || null;
  }
  return changes;
}

// ─── Step 4: medical file ─────────────────────────────────────────────────────

export interface MedicalDraft {
  consultationReason: string;
  /** In cm, as typed (« 159 » or « 158,5 ») */
  height: string;
  file: Record<FileField, string>;
}

export function medicalFromServer(
  patient: Patient | undefined,
  sections: FileSectionDto[] = [],
  measurements: Measurement[] = [],
): MedicalDraft {
  const height = measurements.filter((m) => m.type === 'HEIGHT').at(-1);
  const file = Object.fromEntries(FILE_FIELD_TYPES.map((f) => [f, ''])) as Record<FileField, string>;
  for (const section of sections) {
    if (section.current) file[section.field as FileField] = section.current.content;
  }
  return {
    consultationReason: patient?.consultationReason ?? '',
    height: height ? String(height.value).replace('.', ',') : '',
    file,
  };
}

/** The height in cm, or undefined when empty, or null when it is not a plausible height. */
export function parseHeight(value: string): number | null | undefined {
  if (!value.trim()) return undefined;
  const cm = Number(value.trim().replace(',', '.'));
  return Number.isFinite(cm) && cm >= 30 && cm <= 250 ? Math.round(cm * 10) / 10 : null;
}

export function medicalErrors(draft: MedicalDraft): { height?: string } {
  return parseHeight(draft.height) === null ? { height: 'Indiquez la taille en centimètres, par exemple 159.' } : {};
}

/** The rubrics whose text changed since the last save. */
export function changedFileFields(draft: MedicalDraft, saved: MedicalDraft): FileField[] {
  return FILE_FIELD_TYPES.filter((f) => draft.file[f].trim() !== saved.file[f].trim());
}

/** A list of words joined the French way: « a, b et c ». */
export function joinFrench(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
}
