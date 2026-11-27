import { describe, expect, it } from 'vitest';

import { DRAFT, importSession as session } from '../test/import-fixtures';

import {
  importErrors,
  importPayload,
  importSummary,
  isImportFile,
  outOfOrder,
} from './patient-import';

describe('patient import', () => {
  it('takes her Numbers files and Excel exports only', () => {
    expect(isImportFile('Polo.numbers')).toBe(true);
    expect(isImportFile('Polo.XLSX')).toBe(true);
    expect(isImportFile('Polo.pdf')).toBe(false);
  });

  it('asks for both names, a sensible age and every date', () => {
    expect(importErrors(DRAFT)).toEqual({ firstName: 'Indiquez le prénom.' });
    expect(
      importErrors({ ...DRAFT, firstName: 'Paul', age: 300, sessions: [session('Suivi 3', '')] }),
    ).toEqual({ age: 'Un âge entre 0 et 120 ans.', 'session-0': 'Suivi 3 : indiquez la date.' });
  });

  it('trims names and empties blank contact fields', () => {
    expect(importPayload({ ...DRAFT, firstName: ' Paul ' }, true)).toMatchObject({
      firstName: 'Paul',
      lastName: 'Polo',
      phone: '06',
      email: null,
      allowDuplicate: true,
    });
  });

  it('flags the two sessions around a date out of order', () => {
    expect([...outOfOrder(DRAFT.sessions)]).toEqual([0, 1]);
    expect(outOfOrder(DRAFT.sessions.slice(1)).size).toBe(0);
  });

  it('says what will be saved', () => {
    expect(importSummary(DRAFT)).toBe('3 séances, 1 rubrique du dossier médical');
    expect(importSummary({ ...DRAFT, sessions: [], file: {} })).toBe('aucune séance, 0 rubrique du dossier médical');
  });
});
