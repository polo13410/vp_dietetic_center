import { FileField, PaymentMethod, Sex } from '@prisma/client';
import * as XLSX from 'xlsx';

/**
 * Reading one of Valérie's patient files (Apple Numbers, one file per patient) into what the
 * app stores. Her template has, in the sheet « Tableau récapitulatif » :
 * - « Récapitulatif »: one row « Administratif » (name, phone, e-mail, family, job, GP),
 * - « Dossier médical »: one row (age, sex, weight, height, then one column per file section),
 * - « Suivi »: one row per session (« Bilan », « Suivi 1 », …: date, price, payment, weight,
 *   texts).
 * Tables are found by their headers, not by their names, so a renamed table or an Excel export
 * of the same file reads the same. The « Facture » sheet and the computed columns (BMI, BMR,
 * « Constante ») are left out: the app computes them.
 */

/** A table of the file: its rows, each a list of cell values (header row first). */
export type CellValue = string | number | boolean | Date | null;
export interface SourceTable {
  name: string;
  rows: CellValue[][];
}

export interface ImportSession {
  label: string;
  date: string;
  priceCents: number | null;
  paymentMethod: PaymentMethod;
  weightKg: number | null;
  habits: string | null;
  sessionWork: string | null;
  advice: string | null;
  aversions: string | null;
  tastes: string | null;
}

export interface ImportDraft {
  firstName: string;
  lastName: string;
  sex: Sex | null;
  age: number | null;
  ageOn: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  zipCode: string | null;
  familySituation: string | null;
  profession: string | null;
  gpName: string | null;
  consultationReason: string | null;
  referralSource: string | null;
  heightCm: number | null;
  weightKg: number | null;
  file: Partial<Record<FileField, string>>;
  sessions: ImportSession[];
}

export interface ParsedFile {
  draft: ImportDraft;
  warnings: string[];
  ignored: string[];
}

export class NotAPatientFileError extends Error {}

/** Reads the tables of a Numbers (or Excel) file. Throws NotAPatientFileError if unreadable. */
export function readTables(buffer: Buffer): SourceTable[] {
  let workbook: XLSX.WorkBook;
  try {
    // cellDates: dates come out right whatever the file's date system (Numbers counts from 1904)
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellFormula: false, cellHTML: false });
  } catch {
    throw new NotAPatientFileError('Fichier illisible : est-ce bien un fichier Numbers ?');
  }
  // Each Numbers table becomes a sheet of its own (« Tableau récapitulatif. _1 »…)
  return workbook.SheetNames.map((name) => ({ name, rows: sheetRows(workbook.Sheets[name]) }));
}

function sheetRows(sheet: XLSX.WorkSheet): CellValue[][] {
  if (!sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);
  const rows: CellValue[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: CellValue[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
      row.push(cell?.v === undefined ? null : (cell.v as CellValue));
    }
    rows.push(row);
  }
  return rows;
}

// ─── Columns ─────────────────────────────────────────────────────────────────

type Column<K extends string> = { key: K; matches: (header: string) => boolean };
const is = (...names: string[]) => (h: string) => names.includes(h);
const starts = (...names: string[]) => (h: string) => names.some((n) => h.startsWith(n));

/** Columns that hold figures the app computes: never imported, never reported. */
const COMPUTED = starts('imc', 'mb', 'constante', 'metabolisme');

const ADMIN_COLUMNS = [
  { key: 'name', matches: is('patient', 'nom', 'nom prenom', 'prenom nom') },
  { key: 'phone', matches: starts('tel', 'portable', 'mobile') },
  { key: 'email', matches: starts('email', 'e-mail', 'mail', 'courriel') },
  { key: 'address', matches: is('adresse') },
  { key: 'city', matches: is('ville') },
  { key: 'zipCode', matches: is('cp', 'code postal') },
  { key: 'familySituation', matches: starts('situation familiale') },
  { key: 'profession', matches: starts('profession', 'metier') },
  { key: 'gpName', matches: starts('medecin') },
  { key: 'consultationReason', matches: starts('motif') },
  { key: 'referralSource', matches: starts('adresse par', 'adressee par') },
  { key: 'report', matches: starts('compte rendu', 'cr ') },
] as const satisfies readonly Column<string>[];

const FILE_COLUMNS: readonly { field: FileField; matches: (h: string) => boolean }[] = [
  { field: FileField.HEALTH, matches: starts('sante') },
  { field: FileField.FAMILY_HISTORY, matches: starts('atcd', 'antecedents') },
  { field: FileField.PSYCHOLOGY, matches: starts('psy') },
  { field: FileField.PHYSICAL_ACTIVITY, matches: starts('activite') },
  { field: FileField.WEIGHT_HISTORY, matches: starts('histoire du poids', 'historique du poids') },
  { field: FileField.ALLERGIES, matches: starts('allergie') },
  { field: FileField.BLOOD_GLUCOSE, matches: starts('glycemie') },
  { field: FileField.CHOLESTEROL_TRIGLYCERIDES, matches: starts('chol') },
  { field: FileField.AVERSIONS, matches: starts('aversion') },
  { field: FileField.TASTES, matches: starts('gout') },
];

const MEDICAL_COLUMNS = [
  { key: 'age', matches: is('age') },
  { key: 'sex', matches: is('sexe', 'genre') },
  { key: 'weight', matches: is('poids', 'poids (kg)') },
  { key: 'height', matches: is('taille', 'taille (m)', 'taille (cm)') },
  ...FILE_COLUMNS.map(({ field, matches }) => ({ key: field, matches })),
] as const satisfies readonly Column<string>[];

const SESSION_COLUMNS = [
  { key: 'date', matches: is('date') },
  { key: 'formula', matches: starts('formule', 'tarif', 'prix') },
  { key: 'payment', matches: starts('moyen de paiement', 'paiement', 'reglement') },
  { key: 'weight', matches: is('poids', 'poids (kg)') },
  { key: 'habits', matches: starts('habitudes') },
  { key: 'sessionWork', matches: starts('travail en consultation') },
  { key: 'advice', matches: starts('conseils') },
  { key: 'aversions', matches: starts('aversion') },
  { key: 'tastes', matches: starts('gout') },
] as const satisfies readonly Column<string>[];

type Keys<C extends readonly Column<string>[]> = C[number]['key'];

/** A table with its columns recognised: the values of its rows by key. */
interface Matched<K extends string> {
  rows: { label: string; values: Partial<Record<K, CellValue>> }[];
  unknown: string[];
}

function match<K extends string>(table: SourceTable, columns: readonly Column<K>[]): Matched<K> {
  const [header = [], ...body] = table.rows;
  const keys = header.map((cell, c) => {
    if (c === 0) return null; // the row labels (« Administratif », « Bilan »…)
    const h = plain(cell);
    return h ? (columns.find((col) => col.matches(h))?.key ?? null) : null;
  });
  const unknown = new Set<string>();
  const rows = body.map((row) => {
    const values: Partial<Record<K, CellValue>> = {};
    row.forEach((value, c) => {
      if (isEmpty(value) || c === 0) return;
      const key = keys[c];
      if (key) values[key] ??= value;
      else if (!isEmpty(header[c]) && !COMPUTED(plain(header[c]))) unknown.add(text(header[c])!);
    });
    return { label: text(row[0]) ?? '', values };
  });
  return { rows, unknown: [...unknown] };
}

/** The table whose header row has all these columns. */
function findTable(tables: SourceTable[], ...needed: ((h: string) => boolean)[]) {
  return tables.find((t) => {
    const headers = (t.rows[0] ?? []).map(plain);
    return needed.every((m) => headers.some((h) => m(h)));
  });
}

// ─── The file ────────────────────────────────────────────────────────────────

/**
 * Turns the tables of one patient file into a draft to review, with what to check. `fileName`
 * gives the name when the file has none; `today` is for the dates in the future.
 */
export function draftFromTables(tables: SourceTable[], fileName: string, today = new Date()): ParsedFile {
  const adminTable = findTable(tables, ADMIN_COLUMNS[0].matches, starts('tel', 'medecin', 'profession'));
  const medicalTable = findTable(tables, is('sexe', 'genre'), is('taille', 'taille (m)', 'taille (cm)'));
  const sessionTable = findTable(tables, is('date'), is('poids', 'poids (kg)'));
  if (!adminTable && !medicalTable && !sessionTable) {
    throw new NotAPatientFileError(
      'Aucun tableau de dossier patient trouvé (« Récapitulatif », « Dossier médical », « Suivi »).',
    );
  }

  const warnings: string[] = [];
  const ignored: string[] = [];
  const used = new Set([adminTable, medicalTable, sessionTable]);
  for (const t of tables) {
    if (used.has(t) || !t.rows.some((r) => r.some((v) => !isEmpty(v)))) continue;
    // The tables of one Numbers sheet come as « Facture », « Facture_1 »…: one sheet
    const sheet = `Feuille « ${t.name.replace(/_\d+$/, '').trim()} »`;
    if (!ignored.includes(sheet)) ignored.push(sheet);
  }

  // Sessions first: the earliest one dates everything noted at the start (age, file, height)
  const sessions = sessionTable ? readSessions(match(sessionTable, SESSION_COLUMNS), warnings, ignored, today) : [];
  const start = sessions.map((s) => s.date).sort()[0] ?? null;

  const admin = adminTable ? match(adminTable, ADMIN_COLUMNS) : null;
  const a = admin?.rows.find((r) => Object.keys(r.values).length > 0)?.values ?? {};
  const medical = medicalTable ? match(medicalTable, MEDICAL_COLUMNS) : null;
  const m = medical?.rows.find((r) => Object.keys(r.values).length > 0)?.values ?? {};
  for (const col of [...(admin?.unknown ?? []), ...(medical?.unknown ?? [])]) {
    ignored.push(`Colonne « ${col} »`);
  }
  if (!isEmpty(a.report)) ignored.push(`Compte rendu au médecin : « ${text(a.report)} »`);

  const name = splitName(text(a.name) ?? fileName.replace(/\.(numbers|xlsx?)$/i, ''));
  if (!name.firstName) warnings.push('Un seul mot pour le nom : vérifiez le prénom et le nom.');

  const phone = text(a.phone);
  if (phone && phone.replace(/\D/g, '').length < 10) warnings.push(`Téléphone incomplet : « ${phone} ».`);
  const email = text(a.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push(`E-mail invalide : « ${email} ».`);

  const age = integer(m.age);
  if (!isEmpty(m.age) && age === null) warnings.push(`Âge illisible : « ${text(m.age)} ».`);
  const sex = readSex(m.sex);
  if (!isEmpty(m.sex) && !sex) warnings.push(`Sexe illisible : « ${text(m.sex)} ».`);
  const heightCm = readHeight(m.height);
  if (!isEmpty(m.height) && heightCm === null) warnings.push(`Taille illisible : « ${text(m.height)} ».`);

  const file: Partial<Record<FileField, string>> = {};
  for (const { field } of FILE_COLUMNS) {
    const value = text(m[field]);
    if (value) file[field] = value;
  }

  return {
    draft: {
      ...name,
      sex,
      age,
      ageOn: age === null ? null : (start ?? day(today)),
      phone,
      email,
      address: text(a.address),
      city: text(a.city),
      zipCode: text(a.zipCode),
      familySituation: text(a.familySituation),
      profession: text(a.profession),
      gpName: text(a.gpName),
      consultationReason: text(a.consultationReason),
      referralSource: text(a.referralSource),
      heightCm,
      weightKg: weight(m.weight),
      file,
      sessions,
    },
    warnings,
    ignored,
  };
}

function readSessions(
  table: Matched<Keys<typeof SESSION_COLUMNS>>,
  warnings: string[],
  ignored: string[],
  today: Date,
): ImportSession[] {
  for (const col of table.unknown) ignored.push(`Colonne « ${col} » du suivi`);
  const sessions: ImportSession[] = [];
  for (const { label, values: v } of table.rows) {
    const texts = {
      habits: text(v.habits),
      sessionWork: text(v.sessionWork),
      advice: text(v.advice),
      aversions: text(v.aversions),
      tastes: text(v.tastes),
    };
    const weightKg = weight(v.weight);
    const date = readDate(v.date);
    const name = label || 'Ligne sans nom';
    // Her template ends with empty rows (« Suivi 10 », weight 0, formula « Non »): skipped
    if (!date && weightKg === null && Object.values(texts).every((t) => t === null)) continue;
    if (!date) {
      warnings.push(`${name} : pas de date lisible, la séance n'est pas importée.`);
      continue;
    }
    const priceCents = readPrice(v.formula);
    if (!isEmpty(v.formula) && priceCents === null && !isNo(v.formula)) {
      warnings.push(`${name} : formule « ${text(v.formula)} » sans prix lisible.`);
    }
    const paymentMethod = readPayment(v.payment);
    if (paymentMethod === null) warnings.push(`${name} : moyen de paiement « ${text(v.payment)} » non reconnu.`);
    if (date > day(today)) warnings.push(`${name} : date dans le futur (${frenchDate(date)}).`);
    sessions.push({
      label: name,
      date,
      priceCents,
      paymentMethod: paymentMethod ?? PaymentMethod.NONE,
      weightKg,
      ...texts,
    });
  }
  // Rows are in her order (Bilan, Suivi 1…): a date out of that order is most likely a typo
  for (let i = 1; i < sessions.length; i++) {
    const [before, after] = [sessions[i - 1], sessions[i]];
    if (after.date < before.date) {
      warnings.push(
        `${before.label} (${frenchDate(before.date)}) est après ${after.label} (${frenchDate(after.date)}) : vérifiez les dates.`,
      );
    }
  }
  return sessions;
}

// ─── Values ──────────────────────────────────────────────────────────────────

/** Lower case, no accents, single spaces, no trailing colon. */
function plain(value: CellValue): string {
  return (text(value) ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*:$/, '')
    .trim();
}

function isEmpty(value: CellValue | undefined): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

/** Trimmed text, null when empty. Numbers keep their written form. */
export function text(value: CellValue | undefined): string | null {
  if (isEmpty(value)) return null;
  if (value instanceof Date) return frenchDate(day(value));
  const t = String(value).replace(/\s+/g, ' ').trim();
  return t || null;
}

/** A number written as a number or as text (« 82,5 », « 60 € »). */
function number(value: CellValue | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const found = value.replace(/\s/g, '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  return found ? Number(found[0]) : null;
}

function integer(value: CellValue | undefined): number | null {
  const n = number(value);
  return n === null || n < 0 || n > 130 ? null : Math.round(n);
}

/** A weight in kg; 0 is her template's empty cell. */
function weight(value: CellValue | undefined): number | null {
  const n = number(value);
  return n === null || n <= 0 || n > 400 ? null : Math.round(n * 100) / 100;
}

/** Her heights are in metres (1.77); centimetres are accepted too. */
function readHeight(value: CellValue | undefined): number | null {
  const n = number(value);
  if (n === null || n <= 0) return null;
  const cm = n < 3 ? n * 100 : n;
  return cm < 30 || cm > 250 ? null : Math.round(cm * 10) / 10;
}

function readSex(value: CellValue | undefined): Sex | null {
  const v = plain(value ?? null);
  if (['m', 'h', 'homme', 'masculin', 'garcon'].includes(v)) return Sex.M;
  if (['f', 'femme', 'feminin', 'fille'].includes(v)) return Sex.F;
  return null;
}

/** « Non », « Offert »: no price. */
function isNo(value: CellValue | undefined): boolean {
  return ['non', 'offert', 'gratuit', '-'].includes(plain(value ?? null));
}

/** The « Formule » column holds the price in euros (60, 50). */
function readPrice(value: CellValue | undefined): number | null {
  if (isNo(value)) return null;
  const n = number(value);
  return n === null || n < 0 || n > 10000 ? null : Math.round(n * 100);
}

/** Her payment methods; empty or « Non » is « Non réglé ». Null when not recognised. */
function readPayment(value: CellValue | undefined): PaymentMethod | null {
  const v = plain(value ?? null);
  if (!v || ['non', 'non regle', 'impaye', 'a regler', '-'].includes(v)) return PaymentMethod.NONE;
  if (v.startsWith('cheque') || v === 'chq') return PaymentMethod.CHECK;
  if (v.startsWith('espece') || v === 'liquide' || v === 'esp') return PaymentMethod.CASH;
  if (v === 'cb' || v.startsWith('carte')) return PaymentMethod.CARD;
  if (v.startsWith('virement') || v === 'vir') return PaymentMethod.TRANSFER;
  return null;
}

/** A date cell, or a date typed as text (18/08/2025, 18/08/25). YYYY-MM-DD, or null. */
function readDate(value: CellValue | undefined): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : day(value);
  if (typeof value !== 'string') return null;
  const found = value.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (!found) return null;
  const [, d, mo, y] = found.map(Number);
  const year = y < 100 ? 2000 + y : y;
  const date = new Date(Date.UTC(year, mo - 1, d));
  return date.getUTCDate() === d && date.getUTCMonth() === mo - 1 ? day(date) : null;
}

/**
 * The calendar day of a date cell. Numbers gives midnight UTC, an Excel file midnight in the
 * time zone of the machine that read it: the nearest UTC midnight is the day in both cases.
 */
function day(date: Date): string {
  const msPerDay = 86_400_000;
  return new Date(Math.round(date.getTime() / msPerDay) * msPerDay).toISOString().slice(0, 10);
}

function frenchDate(isoDay: string): string {
  const [y, m, d] = isoDay.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * « Polo » is a first name she has not completed, « DUPONT Marie » a last name in capitals,
 * « Marie Dupont » the first name first.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const words = full.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (words.length <= 1) return { firstName: '', lastName: words[0] ?? '' };
  const capitals = words.filter((w) => w.length > 1 && w === w.toUpperCase() && /\p{L}/u.test(w));
  if (capitals.length && capitals.length < words.length) {
    return {
      firstName: words.filter((w) => !capitals.includes(w)).join(' '),
      lastName: capitals.join(' '),
    };
  }
  return { firstName: words[0], lastName: words.slice(1).join(' ') };
}
