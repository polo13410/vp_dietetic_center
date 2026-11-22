/** Invoices of the seed's test patient (docs/REFONTE.md § 3.1, Martine Roux): one corrected. */
import type { InvoiceDto } from '@vp/types';

import { PATIENT_ID, patient } from './patient-fixtures';

const base: InvoiceDto = {
  id: 'i-6',
  practitionerId: 'u-1',
  patientId: PATIENT_ID,
  consultationId: 'c-1',
  type: 'INVOICE' as InvoiceDto['type'],
  year: 2026,
  sequence: 6,
  number: '2026-0006',
  issuedAt: '2026-09-23T10:00:00.000Z',
  amountCents: 6000,
  paymentMethod: 'CHECK' as InvoiceDto['paymentMethod'],
  serviceLabel: 'Bilan',
  serviceDate: '2026-09-23T09:00:00.000Z',
  practiceName: 'Valérie Perrot, diététicienne nutritionniste',
  practiceAddress: '12 rue des Oliviers',
  practiceZipCode: '13100',
  practiceCity: 'Aix-en-Provence',
  siret: '91234567800011',
  adeliRpps: '139512345',
  vatMention: 'TVA non applicable, article 261-4-1° du CGI',
  invoiceFooter: 'Règlement à réception. Merci de votre confiance.',
  patientFirstName: patient.firstName,
  patientLastName: patient.lastName,
  patientAddress: patient.address,
  patientZipCode: patient.zipCode,
  patientCity: patient.city,
  cancelledAt: null,
  cancelReason: null,
  creditNoteId: null,
  replacedById: null,
  createdAt: '2026-09-23T10:00:00.000Z',
  creditNote: null,
  replacedBy: null,
  cancels: null,
  replaces: null,
};

const link = (invoice: InvoiceDto) => ({ id: invoice.id, number: invoice.number, issuedAt: invoice.issuedAt });

/** The Bilan, paid by cheque */
export const bilanInvoice = base;

/** « Suivi 1 » invoiced « Non réglé », the cheque noted afterwards: corrected */
export const cancelledInvoice: InvoiceDto = {
  ...base,
  id: 'i-10',
  consultationId: 'c-2',
  sequence: 10,
  number: '2026-0010',
  issuedAt: '2026-10-23T10:00:00.000Z',
  amountCents: 5000,
  paymentMethod: 'NONE' as InvoiceDto['paymentMethod'],
  serviceLabel: 'Suivi',
  serviceDate: '2026-10-23T09:00:00.000Z',
  cancelledAt: '2026-11-22T09:00:00.000Z',
  creditNoteId: 'a-1',
  replacedById: 'i-14',
};

export const creditNote: InvoiceDto = {
  ...cancelledInvoice,
  id: 'a-1',
  type: 'CREDIT_NOTE' as InvoiceDto['type'],
  sequence: 1,
  number: 'A-2026-0001',
  issuedAt: '2026-11-22T09:00:00.000Z',
  amountCents: -5000,
  cancelledAt: null,
  creditNoteId: null,
  replacedById: null,
  cancels: link(cancelledInvoice),
};

export const replacement: InvoiceDto = {
  ...cancelledInvoice,
  id: 'i-14',
  sequence: 14,
  number: '2026-0014',
  issuedAt: '2026-11-22T09:00:00.000Z',
  paymentMethod: 'CHECK' as InvoiceDto['paymentMethod'],
  cancelledAt: null,
  creditNoteId: null,
  replacedById: null,
  replaces: link(cancelledInvoice),
};

cancelledInvoice.creditNote = link(creditNote);
cancelledInvoice.replacedBy = link(replacement);

/** Latest first, as GET /patients/:id/invoices lists them */
export const patientInvoices = [replacement, creditNote, cancelledInvoice, bilanInvoice];
