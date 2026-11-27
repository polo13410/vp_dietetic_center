/*
 * Reading her patient files. The tables follow her Numbers template (« Récapitulatif »,
 * « Dossier médical », « Suivi »), with made-up data: real files are never committed.
 */
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import { CellValue, NotAPatientFileError, SourceTable, draftFromTables, readTables, splitName } from './numbers-file';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const TODAY = utc(2026, 11, 27);

const admin = (values: CellValue[] = ['Marie DURAND', '06 12 34 56 78', 'marie@example.com', 'Mariée, 2 enf', 'Infirmière', 'Dr Martin', 'Envoyé']): SourceTable => ({
  name: 'Tableau récapitulatif. ',
  rows: [
    [null, 'Patient', 'Tel', 'Email', 'Situation familiale', 'Profession', 'Médecin traitant', 'Compte rendu '],
    ['Administratif ', ...values],
  ],
});

const medical = (values: CellValue[] = [42, 'F', 80, 1.65, 1.04, 29.4, 6.9, 1650, 'HTA traitée', null, 'Stress', 'Marche', 'Régimes répétés', null, null, 'Chol limite']): SourceTable => ({
  name: 'Tableau récapitulatif. _2',
  rows: [
    [null, 'Age', 'Sexe', 'Poids', 'Taille', 'Constante', 'IMC', 'MB (MJ/jour)', 'MB (Cal/jour)', 'Santé maladie', 'ATCD familiaux ', 'Psy', 'Activité physique et sportive', 'Histoire du poids et régimes', 'Allergies', 'Glycémie', 'Chol et TG'],
    ['Dossier médical ', ...values, ...Array<CellValue>(16 - values.length).fill(null)],
  ],
});

const SESSION_HEADER: CellValue[] = [null, 'Date', 'Formule', 'Moyen de paiement', 'Poids', 'IMC', 'MB (MJ/jour)', 'MB (Cal/jour)', 'Habitudes et évolution ', 'Travail en consultation', 'Aversions', 'Goûts ', 'Conseils diététiques'];
const follow = (...rows: CellValue[][]): SourceTable => ({ name: 'Tableau récapitulatif. _1', rows: [SESSION_HEADER, ...rows] });
const session = (label: string, date: CellValue, price: CellValue, payment: CellValue, weight: CellValue, ...texts: CellValue[]): CellValue[] => [
  label, date, price, payment, weight, 29, 6.9, 1650, ...texts,
];

const invoice: SourceTable = { name: 'Facture', rows: [['Valérie Pera'], ['Diététicienne nutritionniste']] };
const blank: SourceTable = { name: 'Feuille 1', rows: [[null, null], [null, null]] };

const parse = (...tables: SourceTable[]) => draftFromTables(tables, 'Marie Durand.numbers', TODAY);

describe('draftFromTables', () => {
  it('reads her three tables into a patient, a file and sessions', () => {
    const { draft, warnings, ignored } = parse(
      invoice,
      admin(),
      follow(
        session('Bilan ', utc(2025, 3, 4), 60, 'Chèque ', 80, 'Grignote le soir', null, 'Épinards', 'Fruits', 'Dîner léger'),
        session('Suivi 1', utc(2025, 4, 1), 50, 'Espèces', '78,5', null, 'Pleine conscience'),
        session('Suivi 2', null, 'Non', null, 0), // the empty rows at the end of her template
      ),
      medical(),
      blank,
    );

    expect(draft).toMatchObject({
      firstName: 'Marie',
      lastName: 'DURAND',
      phone: '06 12 34 56 78',
      email: 'marie@example.com',
      familySituation: 'Mariée, 2 enf',
      profession: 'Infirmière',
      gpName: 'Dr Martin',
      sex: 'F',
      age: 42,
      ageOn: '2025-03-04',
      heightCm: 165,
      weightKg: 80,
      file: {
        HEALTH: 'HTA traitée',
        PSYCHOLOGY: 'Stress',
        PHYSICAL_ACTIVITY: 'Marche',
        WEIGHT_HISTORY: 'Régimes répétés',
        CHOLESTEROL_TRIGLYCERIDES: 'Chol limite',
      },
    });
    expect(draft.sessions).toEqual([
      {
        label: 'Bilan',
        date: '2025-03-04',
        priceCents: 6000,
        paymentMethod: 'CHECK',
        weightKg: 80,
        habits: 'Grignote le soir',
        sessionWork: null,
        aversions: 'Épinards',
        tastes: 'Fruits',
        advice: 'Dîner léger',
      },
      expect.objectContaining({ label: 'Suivi 1', date: '2025-04-01', priceCents: 5000, paymentMethod: 'CASH', weightKg: 78.5, sessionWork: 'Pleine conscience' }),
    ]);
    expect(warnings).toEqual([]);
    // BMI, BMR and « Constante » are computed by the app: not reported as left out
    expect(ignored).toEqual(['Feuille « Facture »', 'Compte rendu au médecin : « Envoyé »']);
  });

  it('flags what to check: dates out of order or in the future, short phone, one-word name', () => {
    const { draft, warnings } = parse(
      admin(['Polo', '06']),
      follow(
        session('Bilan', utc(2026, 8, 18), 60, null, 115),
        session('Suivi 1', utc(2025, 9, 10), 50, null, 107),
        session('Suivi 2', utc(2027, 1, 6), 50, 'Bitcoin', 105),
      ),
    );
    expect(warnings).toEqual([
      'Suivi 2 : moyen de paiement « Bitcoin » non reconnu.',
      'Suivi 2 : date dans le futur (06/01/2027).',
      'Bilan (18/08/2026) est après Suivi 1 (10/09/2025) : vérifiez les dates.',
      'Un seul mot pour le nom : vérifiez le prénom et le nom.',
      'Téléphone incomplet : « 06 ».',
    ]);
    expect(draft).toMatchObject({ firstName: '', lastName: 'Polo' });
    expect(draft.sessions.map((s) => s.paymentMethod)).toEqual(['NONE', 'NONE', 'NONE']);
  });

  it('dates the age by the earliest session, not the first row', () => {
    const { draft } = parse(
      medical([57, 'M', 115, 1.77]),
      follow(session('Bilan', utc(2026, 8, 18), 60, null, 115), session('Suivi 1', utc(2025, 9, 10), 50, null, 107)),
    );
    expect(draft).toMatchObject({ age: 57, ageOn: '2025-09-10', sex: 'M', heightCm: 177 });
  });

  it('reads dates and figures typed as text', () => {
    const { draft, warnings } = parse(
      medical(['57 ans', 'Homme', '92,4 kg', '172']),
      follow(session('Bilan', '04/03/25', '60 €', 'CB', '92,4'), session('Suivi 1', '1/4/2025', 50, 'Virement', 91)),
    );
    expect(warnings).toEqual([]);
    expect(draft).toMatchObject({ age: 57, sex: 'M', heightCm: 172, weightKg: 92.4 });
    expect(draft.sessions.map((s) => [s.date, s.priceCents, s.paymentMethod])).toEqual([
      ['2025-03-04', 6000, 'CARD'],
      ['2025-04-01', 5000, 'TRANSFER'],
    ]);
  });

  it('skips a session without a date, and says so when it holds something', () => {
    const { draft, warnings } = parse(follow(session('Suivi 3', null, 50, null, 70, 'Notes'), session('Suivi 4', '31/02/2025', 50, null, 70)));
    expect(draft.sessions).toEqual([]);
    expect(warnings).toEqual([
      "Suivi 3 : pas de date lisible, la séance n'est pas importée.",
      "Suivi 4 : pas de date lisible, la séance n'est pas importée.",
    ]);
  });

  it('flags values it cannot read and columns it does not know', () => {
    const table = medical(['?', 'X', 80, 'grand']);
    table.rows[0].push('Tour de taille');
    table.rows[1].push(92);
    const { draft, warnings, ignored } = parse(
      table,
      follow(session('Bilan', utc(2025, 3, 4), 'Forfait', null, 80)),
    );
    expect(draft).toMatchObject({ age: null, sex: null, heightCm: null, ageOn: null });
    expect(warnings).toEqual([
      'Bilan : formule « Forfait » sans prix lisible.',
      'Âge illisible : « ? ».',
      'Sexe illisible : « X ».',
      'Taille illisible : « grand ».',
    ]);
    expect(ignored).toEqual(['Colonne « Tour de taille »']);
  });

  it('takes the name from the file name when the file has none, and checks the e-mail', () => {
    const { draft, warnings } = parse(admin([null, null, 'pas-un-mail']));
    expect(draft).toMatchObject({ firstName: 'Marie', lastName: 'Durand', email: 'pas-un-mail' });
    expect(warnings).toContain('E-mail invalide : « pas-un-mail ».');
  });

  it('refuses a file without any of her tables', () => {
    expect(() => parse(invoice, blank)).toThrow(NotAPatientFileError);
  });
});

describe('splitName', () => {
  it.each([
    ['Marie Dupont', 'Marie', 'Dupont'],
    ['DUPONT Marie', 'Marie', 'DUPONT'],
    ['Jean-Pierre DE LA TOUR', 'Jean-Pierre', 'DE LA TOUR'],
    ['Anne Marie Lefèvre', 'Anne', 'Marie Lefèvre'],
    ['  Polo  ', '', 'Polo'],
    ['', '', ''],
  ])('%s', (full, firstName, lastName) => {
    expect(splitName(full)).toEqual({ firstName, lastName });
  });
});

describe('readTables', () => {
  const book = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([SESSION_HEADER, session('Bilan', utc(2025, 8, 18), 60, 'Chèque', 80)], { cellDates: true }),
      'Suivi',
    );
    return wb;
  };

  it.each([
    ['a Numbers file', { bookType: 'numbers', numbers: createRequire(__filename)('xlsx/dist/xlsx.zahl.js') }],
    ['an Excel export', { bookType: 'xlsx' }],
  ] as const)('reads %s, with its dates on the right day', (_, options) => {
    const buffer = XLSX.write(book(), { type: 'buffer', ...options }) as Buffer;
    const { draft } = draftFromTables(readTables(buffer), 'x.numbers', TODAY);
    expect(draft.sessions).toEqual([expect.objectContaining({ date: '2025-08-18', priceCents: 6000, weightKg: 80 })]);
  });

  it('does not take any file for a patient file', () => {
    expect(() => draftFromTables(readTables(Buffer.from('PK\u0003\u0004 pas un zip')), 'x', TODAY)).toThrow(
      NotAPatientFileError,
    );
  });
});
