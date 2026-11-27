import { describe, expect, it } from 'vitest';

import { gpReportFilename, gpReportStatus, paragraphs, printable } from './gp-reports';

describe('gp reports', () => {
  it('says whether a report is a draft or when it was sent', () => {
    expect(gpReportStatus({ status: 'DRAFT', sentAt: null, date: '2026-11-22' } as never)).toEqual({
      label: 'Brouillon',
      tone: 'warning',
    });
    expect(
      gpReportStatus({ status: 'SENT', sentAt: '2025-11-20T15:00:00.000Z', date: '2025-11-19' } as never),
    ).toEqual({ label: 'Envoyé le 20 novembre 2025', tone: 'success' });
  });

  it('cuts the letter into paragraphs, keeping line breaks inside them', () => {
    expect(paragraphs('Dr Garnier\r\n\r\nDocteur,\n\n\n  \nValérie Dupont\nDiététicienne\n')).toEqual([
      'Dr Garnier',
      'Docteur,',
      'Valérie Dupont\nDiététicienne',
    ]);
  });

  it('prints what the PDF fonts cannot draw, and keeps French punctuation on its line', () => {
    expect(printable('Régime en 2019 : −8 kg, LDL ≥ 1,6 g/L')).toBe('Régime en 2019 : -8 kg, LDL >= 1,6 g/L');
  });

  it('names the PDF after the patient and the date', () => {
    expect(
      gpReportFilename({ patient: { firstName: 'Hélène', lastName: "D'Aubigné", gpName: null }, date: '2026-11-22T00:00:00.000Z' }),
    ).toBe('compte-rendu-d-aubigne-helene-2026-11-22.pdf');
  });
});
