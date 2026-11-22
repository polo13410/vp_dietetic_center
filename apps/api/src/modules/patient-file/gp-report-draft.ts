/**
 * The pre-filled report to the patient's GP (docs/REFONTE.md lot 10): a letter in French built from
 * the file, with no AI. Pure functions: what is not known is left out, never printed as empty.
 */
import { FileField, type Sex } from '@prisma/client';

import { ageAt, computeBmi, computeBmr } from './calculations';

export interface PracticeHeader {
  practiceName?: string | null;
  address?: string | null;
  zipCode?: string | null;
  city?: string | null;
  adeliRpps?: string | null;
}

export interface Practitioner {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
}

export interface GpReportDraftInput {
  /** The report's date */
  today: Date;
  practice: PracticeHeader | null;
  practitioner: Practitioner;
  patient: {
    firstName: string;
    lastName: string;
    sex?: Sex | null;
    dateOfBirth?: Date | null;
    gpName?: string | null;
    consultationReason?: string | null;
  };
  /** Latest known height */
  heightCm?: number | null;
  /** Weights, oldest first */
  weights: { value: number; measuredAt: Date }[];
  /** Sessions, oldest first (the first one is the « Bilan ») */
  sessions: { date: Date; sessionWork?: string | null; advice?: string | null }[];
  /** Current value of each section of the medical file */
  file: { field: FileField; content: string }[];
}

/** Sections of the file worth telling the GP, in her order, as they read in the letter. */
const FILE_LABELS: Partial<Record<FileField, string>> = {
  HEALTH: 'Santé',
  FAMILY_HISTORY: 'Antécédents familiaux',
  PSYCHOLOGY: 'Sur le plan psychologique',
  PHYSICAL_ACTIVITY: 'Activité physique',
  WEIGHT_HISTORY: 'Histoire du poids et régimes',
  ALLERGIES: 'Allergies',
  BLOOD_GLUCOSE: 'Glycémie',
  CHOLESTEROL_TRIGLYCERIDES: 'Cholestérol et triglycérides',
  // Aversions and tastes are for her sessions, not for the GP
};

/** How many of the latest sessions the work and advice are taken from. */
export const RECENT_SESSIONS = 3;

// ─── Formatting ───────────────────────────────────────────────────────────────

const longDate = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
const yearOf = (date: Date) => Number(new Intl.DateTimeFormat('fr-FR', { year: 'numeric', timeZone: 'Europe/Paris' }).format(date));

/** « 22 novembre 2026 » (« 1er » for the first day of a month) */
export function formatDate(date: Date): string {
  return longDate.format(date).replace(/^1 /, '1er ');
}

/** « 15 novembre », with the year only when it is not the one of `today` */
function shortDate(date: Date, today: Date): string {
  return yearOf(date) === yearOf(today) ? dayMonth.format(date).replace(/^1 /, '1er ') : formatDate(date);
}

/**
 * French decimals with plain spaces (PDF standard fonts have no narrow no-break space):
 * 76.5 → « 76,5 », 1378.9 → « 1 378,9 ». Trailing zeros dropped unless `fixed`.
 */
export function formatNumber(value: number, decimals: number, fixed = false): string {
  const [int, dec = ''] = value.toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const fraction = fixed ? dec : dec.replace(/0+$/, '');
  return fraction ? `${grouped},${fraction}` : grouped;
}

const kg = (value: number) => `${formatNumber(value, 2)} kg`;

const present = (text: string | null | undefined): text is string => !!text && text.trim() !== '';

/** « Perte de poids » → « perte de poids », but « LDL 1,45 » stays (an acronym). */
function lowerFirst(text: string): string {
  return /^\p{Lu}\p{Ll}/u.test(text) ? text[0].toLocaleLowerCase('fr-FR') + text.slice(1) : text;
}

/** One sentence (or several) on one line, ending with a full stop. */
function asSentence(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-–•*]\s*/, ''))
    .filter(Boolean)
    .map((line) => (/[.!?…]$/.test(line) ? line : `${line}.`))
    .join(' ');
}

/** An intro and its items: inline for one item, a dashed list otherwise. */
function list(intro: string, items: string[]): string | null {
  if (items.length === 0) return null;
  if (items.length === 1) return `${intro} ${items[0].replace(/^– /, '')}`;
  return [intro, ...items].join('\n');
}

const TITLES: Record<Sex, string> = { F: 'Mme', M: 'M.' };

// ─── The letter ───────────────────────────────────────────────────────────────

/** The practice's letterhead, printed at the top of the PDF: name first, then one line each. */
export function letterhead(practice: PracticeHeader | null, practitioner: Practitioner): string[] {
  const p = practice ?? {};
  const adeli = p.adeliRpps?.trim();
  return [
    present(p.practiceName) ? p.practiceName.trim() : `${practitioner.firstName} ${practitioner.lastName}`,
    p.address,
    [p.zipCode, p.city].filter(present).join(' '),
    present(practitioner.phone) ? `Tél. ${practitioner.phone.trim()}` : null,
    practitioner.email,
    adeli ? `${adeli.length === 11 ? 'N° RPPS' : 'N° ADELI'} : ${adeli}` : null,
  ].filter(present);
}

/** « Valérie Perrot, diététicienne nutritionniste » → two lines; her name otherwise. */
function signature(practice: PracticeHeader | null, practitioner: Practitioner): string {
  const name = practice?.practiceName?.trim();
  if (!name) return `${practitioner.firstName} ${practitioner.lastName}`;
  return name
    .split(/,\s*/)
    .filter(Boolean)
    .map((part) => part[0].toLocaleUpperCase('fr-FR') + part.slice(1))
    .join('\n');
}

/** The draft of the letter, paragraphs separated by a blank line. */
export function buildGpReportDraft(input: GpReportDraftInput): string {
  const { today, patient, practice, practitioner } = input;
  const gp = patient.gpName?.trim();
  const who = [patient.sex ? TITLES[patient.sex] : null, patient.firstName, patient.lastName]
    .filter(present)
    .join(' ');
  const city = practice?.city?.trim();
  const salutation = gp ? 'Docteur' : 'Madame, Monsieur';

  const paragraphs: (string | null)[] = [
    gp ?? null,
    city ? `${city}, le ${formatDate(today)}` : `Le ${formatDate(today)}`,
    `Objet : suivi diététique de ${who}`,
    `${salutation},`,
    introduction(input, who),
    followUp(input),
    ...evolution(input),
    fileElements(input),
    recentList(input, 'sessionWork', 'Au cours des dernières séances, nous avons travaillé sur :'),
    recentList(input, 'advice', 'Les conseils donnés :'),
    'Je reste à votre disposition pour tout complément d’information.',
    `Je vous prie d’agréer, ${salutation}, l’expression de mes salutations distinguées.`,
    signature(practice, practitioner),
  ];
  return paragraphs.filter(present).join('\n\n');
}

function introduction({ patient, today }: GpReportDraftInput, who: string): string {
  const age = ageAt(patient.dateOfBirth, today);
  const reason = present(patient.consultationReason) ? lowerFirst(asSentence(patient.consultationReason)) : null;
  return [
    `Je vous fais part du suivi diététique de ${who}`,
    age !== null ? `, ${age} ans` : '',
    reason ? `, qui me consulte pour le motif suivant : ${reason}` : '.',
  ].join('');
}

function followUp({ sessions }: GpReportDraftInput): string | null {
  if (sessions.length === 0) return null;
  const first = formatDate(sessions[0].date);
  if (sessions.length === 1) return `Le bilan diététique a eu lieu le ${first}.`;
  const last = formatDate(sessions[sessions.length - 1].date);
  return `Le suivi a débuté par un bilan le ${first}. Nous en sommes à ${sessions.length} séances, la dernière ayant eu lieu le ${last}.`;
}

/** Weight and BMI at the start and now, the change, and the basal metabolic rate. */
function evolution({ weights, heightCm, sessions, patient, today }: GpReportDraftInput): string[] {
  if (weights.length === 0) return [];
  const first = weights[0];
  const latest = weights[weights.length - 1];
  const withBmi = (w: { value: number }) => {
    const bmi = computeBmi(w.value, heightCm);
    return bmi ? `${kg(w.value)} (IMC ${formatNumber(bmi.value, 2)})` : kg(w.value);
  };
  const atBilan = sessions.length > 0 && sameDay(first.measuredAt, sessions[0].date);
  const bmr = (w: { value: number }, at: Date) =>
    computeBmr({ sex: patient.sex, weightKg: w.value, heightCm, age: ageAt(patient.dateOfBirth, at) });
  const mb = (b: { mj: number; kcal: number }) =>
    `${formatNumber(b.mj, 2, true)} MJ (${formatNumber(b.kcal, 1, true)} kcal) par jour`;

  const paragraphs: string[] = [];
  const startBmr = bmr(first, first.measuredAt);
  const currentBmr = bmr(latest, today);

  if (weights.length === 1) {
    paragraphs.push(`Son poids est de ${withBmi(latest)} au ${formatDate(latest.measuredAt)}.`);
    if (currentBmr) paragraphs.push(`Son métabolisme de base est estimé à ${mb(currentBmr)}.`);
    return paragraphs;
  }

  const delta = Math.round((latest.value - first.value) * 100) / 100;
  const change =
    delta < 0 ? `soit une perte de ${kg(-delta)}` : delta > 0 ? `soit une prise de ${kg(delta)}` : 'soit un poids stable';
  const start = atBilan ? 'Lors du bilan' : `Le ${formatDate(first.measuredAt)}`;
  paragraphs.push(
    `${start}, son poids était de ${withBmi(first)}. Au ${formatDate(latest.measuredAt)}, il est de ${withBmi(latest)}, ${change}.`,
  );
  if (startBmr && currentBmr) {
    paragraphs.push(
      `Son métabolisme de base, estimé à ${mb(startBmr)} ${atBilan ? 'au bilan' : 'au départ'}, est aujourd’hui de ${mb(currentBmr)}.`,
    );
  } else if (currentBmr) {
    paragraphs.push(`Son métabolisme de base est estimé à ${mb(currentBmr)}.`);
  }
  return paragraphs;
}

function fileElements({ file }: GpReportDraftInput): string | null {
  const items = (Object.keys(FILE_LABELS) as FileField[]).flatMap((field) => {
    const content = file.find((f) => f.field === field)?.content;
    return present(content) ? [`– ${FILE_LABELS[field]} : ${lowerFirst(asSentence(content))}`] : [];
  });
  if (items.length === 1) return `Au fil de nos échanges, j’ai relevé : ${items[0].slice(2)}`;
  return list('Au fil de nos échanges, j’ai relevé les éléments suivants :', items);
}

/** The work or advice of the latest sessions, dated. */
function recentList(
  { sessions, today }: GpReportDraftInput,
  key: 'sessionWork' | 'advice',
  intro: string,
): string | null {
  const items = sessions
    .filter((s) => present(s[key]))
    .slice(-RECENT_SESSIONS)
    .map((s) => `– le ${shortDate(s.date, today)} : ${lowerFirst(asSentence(s[key] as string))}`);
  return list(intro, items);
}

function sameDay(a: Date, b: Date): boolean {
  const day = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' });
  return day.format(a) === day.format(b);
}
