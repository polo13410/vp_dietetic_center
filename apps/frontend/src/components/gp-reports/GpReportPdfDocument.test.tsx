// @vitest-environment node
import { inflateSync } from 'node:zlib';

import { renderToBuffer } from '@react-pdf/renderer';
import type { GpReportDocumentDto } from '@vp/types';
import { describe, expect, it } from 'vitest';

import { GpReportPdfDocument } from './GpReportPdfDocument';

/** The text drawn on the pages (hex strings of the content streams, WinAnsi encoding). */
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let text = '';
  for (const [, stream] of raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const content = inflateSync(Buffer.from(stream, 'latin1')).toString('latin1');
    for (const [, array] of content.matchAll(/\[([^\]]*)\] TJ/g)) {
      for (const [, hex] of array.matchAll(/<([0-9a-f]*)>/g)) text += Buffer.from(hex, 'hex').toString('latin1');
    }
  }
  return text.replace(/\x92/g, '’').replace(/\x96/g, '–').replace(/\x97/g, '—').replace(/\xa0/g, ' ');
}

const report = {
  id: 'r-1',
  patientId: 'p-1',
  authorId: 'u-1',
  date: '2026-11-22T00:00:00.000Z',
  status: 'DRAFT',
  sentAt: null,
  createdAt: '2026-11-22T10:00:00.000Z',
  updatedAt: '2026-11-22T10:00:00.000Z',
  patient: { firstName: 'Martine', lastName: 'Roux', gpName: 'Dr Laurent Garnier' },
  letterhead: ['Valérie Perrot, diététicienne nutritionniste', '12 rue des Oliviers', 'N° ADELI : 139512345'],
  content: [
    'Dr Laurent Garnier',
    'Aix-en-Provence, le 22 novembre 2026',
    'Docteur,',
    'Lors du bilan, son poids était de 79 kg (IMC 31,25). Au 15 novembre 2026, il est de 76,5 kg (IMC 30,26), soit une perte de 2,5 kg.',
    'Au fil de nos échanges, j’ai relevé les éléments suivants :\n– Santé : hypertension traitée.\n– Histoire du poids : régime en 2019 : −8 kg.',
    'Valérie Perrot\nDiététicienne nutritionniste',
  ].join('\n\n'),
} as GpReportDocumentDto;

describe('GpReportPdfDocument', () => {
  it('prints the letter on the practice’s letterhead, on one A4 page', async () => {
    const pdf = await renderToBuffer(<GpReportPdfDocument report={report} />);
    const raw = pdf.toString('latin1');
    const text = pdfText(pdf);
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
    for (const line of [
      'Valérie Perrot, diététicienne nutritionniste',
      'N° ADELI : 139512345',
      'Aix-en-Provence, le 22 novembre 2026',
      '76,5 kg (IMC 30,26)',
      'j’ai relevé',
      '– Santé : hypertension traitée.',
      // The minus sign is not in the PDF's fonts: printed as a hyphen
      'régime en 2019 : -8 kg.',
    ]) {
      expect(text).toContain(line);
    }
  });

  it('numbers the pages of a long letter', async () => {
    const long = { ...report, content: Array.from({ length: 40 }, (_, i) => `Paragraphe ${i + 1}, assez long pour remplir la page.`).join('\n\n') };
    const pdf = await renderToBuffer(<GpReportPdfDocument report={long} />);
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1);
    expect(pdfText(pdf)).toContain('Compte rendu — Martine Roux — page 1 / 2');
  });
});
