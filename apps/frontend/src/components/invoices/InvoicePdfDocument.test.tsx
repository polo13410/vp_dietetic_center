// @vitest-environment node
import { inflateSync } from 'node:zlib';

import { renderToBuffer } from '@react-pdf/renderer';
import type { InvoiceDto } from '@vp/types';
import { describe, expect, it } from 'vitest';

import { bilanInvoice, coveredInvoice, creditNote, payerInvoice, replacement } from '../../test/invoice-fixtures';

import { InvoicePdfDocument } from './InvoicePdfDocument';

/**
 * The text drawn on the page: hex strings of the content streams, in the fonts' WinAnsi encoding.
 * A line may be drawn in several runs (cut at hyphens): runs are joined as they come.
 */
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString('latin1');
  let text = '';
  for (const [, stream] of raw.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    const content = inflateSync(Buffer.from(stream, 'latin1')).toString('latin1');
    for (const [, array] of content.matchAll(/\[([^\]]*)\] TJ/g)) {
      for (const [, hex] of array.matchAll(/<([0-9a-f]*)>/g)) text += Buffer.from(hex, 'hex').toString('latin1');
    }
  }
  // WinAnsi differs from Latin-1 for a few signs
  return text.replace(/\x80/g, '€').replace(/\x97/g, '—').replace(/\x92/g, '’');
}

/** Renders the real PDF file, as the download does. */
async function render(invoice: InvoiceDto) {
  const pdf = await renderToBuffer(<InvoicePdfDocument invoice={invoice} />);
  return { raw: pdf.toString('latin1'), text: pdfText(pdf) };
}

describe('InvoicePdfDocument', () => {
  it('prints the invoice of the test patient (§ 3.1) with every mention, on one A4 page', async () => {
    const { raw, text } = await render(bilanInvoice);
    expect(raw.startsWith('%PDF-')).toBe(true);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(raw).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
    for (const mention of [
      'Valérie Perrot, diététicienne nutritionniste',
      '13100 Aix-en-Provence',
      'SIRET : 912 345 678 00011',
      'N° ADELI : 139512345',
      'Facture',
      'N° 2026-0006',
      'Émise le 23 septembre 2026',
      'Martine Roux',
      '34000 Montpellier',
      'Bilan',
      'Séance du 23 septembre 2026',
      '60,00 €',
      'Acquittée — réglée par chèque',
      'TVA non applicable, article 261-4-1° du CGI',
      'Règlement à réception. Merci de votre confiance.',
    ]) {
      expect(text).toContain(mention);
    }
  });

  it('prints no VAT mention when the practice has none, and no « Acquittée » when unpaid', async () => {
    const { text } = await render({ ...bilanInvoice, vatMention: null, paymentMethod: 'NONE' as InvoiceDto['paymentMethod'] });
    expect(text).not.toContain('TVA');
    expect(text).not.toContain('Acquittée');
  });

  it('prints a credit note in negative, with the invoice it cancels', async () => {
    const { text } = await render(creditNote);
    expect(text).toContain('Avoir');
    expect(text).toContain('N° A-2026-0001');
    expect(text).toContain('Annule la facture n° 2026-0010 du 23 octobre 2026');
    expect(text).toContain('-50,00 €');
  });

  it('bills the patient part, with « dont … pris en charge par … » (lot 16)', async () => {
    const { text } = await render(coveredInvoice);
    for (const mention of [
      '60,00 €',
      'Remise (tarif solidaire)',
      '-10,00 €',
      'Net',
      'dont 30,00 € pris en charge par Mutuelle Horizon Santé',
      'Reste à votre charge',
      '20,00 €',
    ]) {
      expect(text).toContain(mention);
    }
  });

  it('prints a payer invoice: the payer, the period and its sessions, nothing medical', async () => {
    const { raw, text } = await render(payerInvoice);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
    for (const mention of [
      'ORGANISME',
      'Mutuelle Horizon Santé',
      '13001 Marseille',
      'N° 2026-0017',
      'Séances du 1er novembre 2026 au 30 novembre 2026',
      'Convention : CONV-2026-114',
      'Martine Roux',
      'PEC-0042',
      'Paul Garcia',
      '50,00 €',
    ]) {
      expect(text).toContain(mention);
    }
    expect(text).not.toContain('Acquittée');
  });

  it('prints the invoice a corrected one replaces', async () => {
    const { text } = await render(replacement);
    expect(text).toContain('Remplace la facture n° 2026-0010 du 23 octobre 2026');
  });
}, 30_000);
