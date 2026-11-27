/** Invoices of the seed's test patient (docs/REFONTE.md § 3.1, Martine Roux): one corrected. */
import type { InvoiceDto } from '@vp/types';

import { PATIENT_ID, patient } from './patient-fixtures';

const base: InvoiceDto = {
  id: 'i-6',
  practitionerId: 'u-1',
  patientId: PATIENT_ID,
  consultationId: 'c-1',
  type: 'INVOICE' as InvoiceDto['type'],
  recipient: 'PATIENT',
  payerId: null,
  year: 2026,
  sequence: 6,
  number: '2026-0006',
  issuedAt: '2026-09-23T10:00:00.000Z',
  amountCents: 6000,
  paymentMethod: 'CHECK' as InvoiceDto['paymentMethod'],
  serviceLabel: 'Bilan',
  serviceDate: '2026-09-23T09:00:00.000Z',
  priceCents: 6000,
  discountCents: 0,
  discountReason: null,
  payerCents: 0,
  payerName: null,
  payerAddress: null,
  payerZipCode: null,
  payerCity: null,
  payerContact: null,
  conventionReference: null,
  periodStart: null,
  periodEnd: null,
  paidAt: null,
  practiceName: 'Valérie Dupont, diététicienne nutritionniste',
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
  priceCents: 5000,
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
  priceCents: -5000,
  discountCents: 0,
  payerCents: 0,
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

/** Lot 16: « Suivi 2 », 60 € with a 10 € discount, 30 € paid by the mutuelle: 20 € for Martine */
export const coveredInvoice: InvoiceDto = {
  ...base,
  id: 'i-16',
  consultationId: 'c-3',
  sequence: 16,
  number: '2026-0016',
  issuedAt: '2026-11-15T10:00:00.000Z',
  serviceLabel: 'Suivi',
  serviceDate: '2026-11-15T09:00:00.000Z',
  amountCents: 2000,
  priceCents: 6000,
  discountCents: 1000,
  discountReason: 'tarif solidaire',
  payerCents: 3000,
  payerName: 'Mutuelle Horizon Santé',
};

/** Lot 16: the mutuelle's November invoice, two sessions, « en attente » */
export const payerInvoice: InvoiceDto = {
  ...base,
  id: 'i-17',
  patientId: null,
  consultationId: null,
  recipient: 'PAYER',
  payerId: 'payer-1',
  sequence: 17,
  number: '2026-0017',
  issuedAt: '2026-12-01T10:00:00.000Z',
  amountCents: 5000,
  paymentMethod: 'NONE' as InvoiceDto['paymentMethod'],
  serviceLabel: 'Prise en charge de séances de diététique',
  serviceDate: '2026-11-30T00:00:00.000Z',
  priceCents: null,
  discountCents: null,
  payerCents: null,
  payerName: 'Mutuelle Horizon Santé',
  payerAddress: '8 boulevard de la Liberté',
  payerZipCode: '13001',
  payerCity: 'Marseille',
  payerContact: 'Service prestations',
  conventionReference: 'CONV-2026-114',
  periodStart: '2026-11-01T00:00:00.000Z',
  periodEnd: '2026-11-30T00:00:00.000Z',
  patientFirstName: null,
  patientLastName: null,
  patientAddress: null,
  patientZipCode: null,
  patientCity: null,
  lines: [
    {
      id: 'l-1',
      invoiceId: 'i-17',
      consultationId: 'c-3',
      position: 0,
      serviceDate: '2026-11-15T09:00:00.000Z',
      serviceLabel: 'Suivi',
      patientFirstName: 'Martine',
      patientLastName: 'Roux',
      coverageNumber: 'PEC-0042',
      amountCents: 3000,
    },
    {
      id: 'l-2',
      invoiceId: 'i-17',
      consultationId: 'c-9',
      position: 1,
      serviceDate: '2026-11-20T09:00:00.000Z',
      serviceLabel: 'Bilan',
      patientFirstName: 'Paul',
      patientLastName: 'Garcia',
      coverageNumber: null,
      amountCents: 2000,
    },
  ],
};
