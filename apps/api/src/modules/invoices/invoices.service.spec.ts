import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvoiceType, PaymentMethod } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockUser, mockAccess, mockPrisma } from '../../test/setup';

import { DELETED_SESSION_REASON, InvoicesService, parisStartOfDay, periodRange } from './invoices.service';
import { PayerInvoicesService } from './payer-invoices.service';

const d = (iso: string) => new Date(iso);
const NOW = d('2026-11-22T10:00:00Z');

/** Her practice in Aix, where the session took place (no SIRET of its own). */
const aix = { address: '12 rue des Oliviers', zipCode: '13100', city: 'Aix-en-Provence', siret: null };
/** Martine Roux, the test patient of docs/REFONTE.md § 3.1, at her « Suivi 2 ». */
const session = {
  id: 'c1',
  patientId: 'p1',
  practitionerId: 'user-1',
  practiceId: 'pr-aix',
  date: d('2026-11-22T09:00:00Z'),
  formulaLabel: 'Suivi',
  priceCents: 5000,
  paymentMethod: PaymentMethod.CARD,
  patient: { id: 'p1', firstName: 'Martine', lastName: 'Roux', address: '3 place des Prêcheurs', zipCode: '13100', city: 'Aix-en-Provence' },
  practice: aix,
};
/** Her activity (« Mon activité ») */
const activity = {
  practiceName: 'Valérie Perrot, diététicienne nutritionniste',
  siret: '91234567800011',
  adeliRpps: '139512345',
  vatMention: 'TVA non applicable, article 261-4-1° du CGI',
  invoiceFooter: 'Merci de votre confiance.',
};
const practice = { ...activity, ...aix, siret: activity.siret };
const issued = {
  id: 'i1',
  practitionerId: 'user-1',
  patientId: 'p1',
  consultationId: 'c1',
  type: InvoiceType.INVOICE,
  year: 2026,
  sequence: 12,
  number: '2026-0012',
  issuedAt: d('2026-11-20T10:00:00Z'),
  amountCents: 5000,
  paymentMethod: PaymentMethod.CASH,
  serviceLabel: 'Suivi',
  serviceDate: d('2026-11-20T09:00:00Z'),
  practiceName: practice.practiceName,
  practiceAddress: practice.address,
  practiceZipCode: practice.zipCode,
  practiceCity: practice.city,
  siret: practice.siret,
  adeliRpps: practice.adeliRpps,
  vatMention: practice.vatMention,
  invoiceFooter: practice.invoiceFooter,
  patientFirstName: 'Martine',
  patientLastName: 'Roux',
  patientAddress: null,
  patientZipCode: null,
  patientCity: null,
  cancelledAt: null,
  cancelReason: null,
  creditNoteId: null,
  replacedById: null,
  createdAt: d('2026-11-20T10:00:00Z'),
};

describe('InvoicesService', () => {
  let service: InvoicesService;
  const user = createMockUser();
  let created: any[];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InvoicesService(mockPrisma as any, mockAccess as any, new PayerInvoicesService(mockPrisma as any, mockAccess as any));
    created = [];
    mockPrisma.consultation.findUnique.mockResolvedValue(session);
    mockPrisma.practitionerProfile.findUnique.mockResolvedValue(activity);
    mockPrisma.user.findUniqueOrThrow.mockResolvedValue({ firstName: 'Valérie', lastName: 'Perrot' });
    mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { sequence: null } });
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    mockPrisma.invoice.findUnique.mockResolvedValue(issued);
    mockPrisma.invoice.create.mockImplementation(({ data }: any) => {
      const invoice = { id: `new-${created.length + 1}`, ...data };
      created.push(invoice);
      return Promise.resolve(invoice);
    });
    mockPrisma.invoice.findUniqueOrThrow.mockImplementation(({ where }: any) =>
      Promise.resolve(created.find((i) => i.id === where.id)),
    );
  });

  const createdOf = (type: InvoiceType) => created.find((i) => i.type === type);

  // ─── Issue ───────────────────────────────────────────────────────────────────

  describe('issue (« Faire la facture »)', () => {
    it('numbers the first invoice of the year 2026-0001 and copies the practice, the patient and the service', async () => {
      const invoice = await service.issue(user as any, 'c1', NOW);

      expect(invoice).toMatchObject({
        type: InvoiceType.INVOICE,
        year: 2026,
        sequence: 1,
        number: '2026-0001',
        issuedAt: NOW,
        practitionerId: 'user-1',
        patientId: 'p1',
        consultationId: 'c1',
        amountCents: 5000,
        paymentMethod: PaymentMethod.CARD,
        serviceLabel: 'Suivi',
        serviceDate: session.date,
        practiceName: practice.practiceName,
        siret: practice.siret,
        adeliRpps: practice.adeliRpps,
        vatMention: practice.vatMention,
        invoiceFooter: practice.invoiceFooter,
        patientFirstName: 'Martine',
        patientLastName: 'Roux',
        patientAddress: '3 place des Prêcheurs',
        patientCity: 'Aix-en-Provence',
        practiceAddress: '12 rue des Oliviers',
        practiceZipCode: '13100',
        practiceCity: 'Aix-en-Provence',
      });
      // Under the practitioner's lock, then the series' lock
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(2);
      expect(mockPrisma.invoice.aggregate).toHaveBeenCalledWith({
        where: { practitionerId: 'user-1', type: InvoiceType.INVOICE, year: 2026 },
        _max: { sequence: true },
      });
    });

    it('continues the series of the year without a gap', async () => {
      mockPrisma.invoice.aggregate.mockResolvedValue({ _max: { sequence: 11 } });
      await expect(service.issue(user as any, 'c1', NOW)).resolves.toMatchObject({ number: '2026-0012', sequence: 12 });
    });

    it('starts again at 0001 on 1 January (Paris time)', async () => {
      await service.issue(user as any, 'c1', d('2026-12-31T23:30:00Z'));
      expect(mockPrisma.invoice.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ year: 2027 }) }),
      );
      expect(created[0].number).toBe('2027-0001');
    });

    it('uses her name when the practice has no name yet, and never invents a VAT mention', async () => {
      mockPrisma.practitionerProfile.findUnique.mockResolvedValue(null);
      const invoice = await service.issue(user as any, 'c1', NOW);
      expect(invoice).toMatchObject({ practiceName: 'Valérie Perrot', vatMention: null, siret: null });
    });

    it("prints the address of the session's practice, and its own SIRET when it has one", async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...session,
        practiceId: 'pr-marseille',
        practice: { address: '40 rue Paradis', zipCode: '13001', city: 'Marseille', siret: '73282932000074' },
      });
      const invoice = await service.issue(user as any, 'c1', NOW);
      expect(invoice).toMatchObject({
        practiceName: activity.practiceName,
        practiceAddress: '40 rue Paradis',
        practiceZipCode: '13001',
        practiceCity: 'Marseille',
        siret: '73282932000074',
        adeliRpps: activity.adeliRpps,
      });
      expect(mockPrisma.practice.findFirst).not.toHaveBeenCalled();
    });

    it('takes her default practice for a session placed nowhere', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ ...session, practiceId: null, practice: null });
      mockPrisma.practice.findFirst.mockResolvedValue({ address: '5 rue Thiers', zipCode: '13100', city: 'Aix-en-Provence', siret: null });
      const invoice = await service.issue(user as any, 'c1', NOW);
      expect(mockPrisma.practice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { practitionerId: 'user-1', archivedAt: null } }),
      );
      expect(invoice).toMatchObject({ practiceAddress: '5 rue Thiers', siret: activity.siret });
    });

    it('bills the patient their part only, with the price, the discount and the payer part (lot 16)', async () => {
      // 60 € with a 10 € discount (« tarif solidaire »): the Mutuelle pays 30 € of the 50 € net
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...session,
        priceCents: 6000,
        discountReason: 'tarif solidaire',
        discountCents: 1000,
        netCents: 5000,
        payerCents: 3000,
        patientCents: 2000,
        payerId: 'payer-1',
        payer: { name: 'Mutuelle Horizon' },
      });
      const invoice = await service.issue(user as any, 'c1', NOW);
      expect(invoice).toMatchObject({
        recipient: 'PATIENT',
        amountCents: 2000,
        priceCents: 6000,
        discountCents: 1000,
        discountReason: 'tarif solidaire',
        payerCents: 3000,
        payerName: 'Mutuelle Horizon',
      });
    });

    it('a session saved before lot 16 bills its price', async () => {
      const invoice = await service.issue(user as any, 'c1', NOW);
      expect(invoice).toMatchObject({ amountCents: 5000, priceCents: 5000, discountCents: 0, payerCents: 0, payerName: null, discountReason: null });
    });

    it('makes no invoice for a free session, nor for one paid in full by a payer', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ ...session, discountCents: 5000, netCents: 0, payerCents: 0, patientCents: 0 });
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow('Séance offerte');
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...session,
        discountCents: 0,
        netCents: 5000,
        payerCents: 5000,
        patientCents: 0,
        payer: { name: 'Mutuelle Horizon' },
      });
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow('prise en charge en totalité par Mutuelle Horizon');
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('refuses a session that already has its invoice', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(issued);
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow(ConflictException);
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it('asks for the formula and its price first', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({ ...session, priceCents: null });
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow(BadRequestException);
      mockPrisma.consultation.findUnique.mockResolvedValue({ ...session, formulaLabel: null });
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("checks the session's patient is hers", async () => {
      mockAccess.assertPatient.mockRejectedValueOnce(new ForbiddenException());
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow(ForbiddenException);
      mockPrisma.consultation.findUnique.mockResolvedValue(null);
      await expect(service.issue(user as any, 'c1', NOW)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });
  });

  // ─── Corrections table (docs/REFONTE.md lot 5) ──────────────────────────────

  describe('wrong price, payment method or date → « Corriger la facture »', () => {
    it('cancels the invoice with a credit note, issues a new one from the session, and links the three', async () => {
      mockPrisma.invoice.aggregate.mockImplementation(({ where }: any) =>
        Promise.resolve({ _max: { sequence: where.type === InvoiceType.INVOICE ? 12 : null } }),
      );
      const replacement = await service.correct(user as any, 'i1', NOW);

      const creditNote = createdOf(InvoiceType.CREDIT_NOTE);
      expect(creditNote).toMatchObject({
        number: 'A-2026-0001',
        amountCents: -5000,
        paymentMethod: PaymentMethod.CASH,
        serviceLabel: 'Suivi',
        patientFirstName: 'Martine',
        practiceName: practice.practiceName,
        consultationId: 'c1',
        issuedAt: NOW,
      });
      expect(creditNote).not.toHaveProperty('creditNoteId');
      expect(replacement).toMatchObject({
        number: '2026-0013',
        amountCents: 5000,
        paymentMethod: PaymentMethod.CARD,
        serviceDate: session.date,
      });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { cancelledAt: NOW, creditNoteId: creditNote.id, replacedById: replacement.id },
      });
    });

    it('refuses an invoice already cancelled, a credit note, or one whose session is gone', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ ...issued, cancelledAt: NOW });
      await expect(service.correct(user as any, 'i1', NOW)).rejects.toThrow(ConflictException);
      mockPrisma.invoice.findUnique.mockResolvedValue({ ...issued, type: InvoiceType.CREDIT_NOTE });
      await expect(service.correct(user as any, 'i1', NOW)).rejects.toThrow(BadRequestException);
      mockPrisma.invoice.findUnique.mockResolvedValue({ ...issued, consultationId: null });
      await expect(service.correct(user as any, 'i1', NOW)).rejects.toThrow(BadRequestException);
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
    });

    it("refuses another practitioner's invoice", async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({ ...issued, practitionerId: 'other' });
      mockAccess.assertOwner.mockImplementationOnce(() => {
        throw new ForbiddenException();
      });
      await expect(service.correct(user as any, 'i1', NOW)).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('session created by mistake (already invoiced) → « Supprimer la séance »', () => {
    it('issues the credit note, then deletes the session and its measurements', async () => {
      mockPrisma.invoice.findFirst.mockResolvedValue(issued);
      const { creditNote } = await service.deleteSession('user-1', 'c1', NOW);

      expect(creditNote).toMatchObject({ type: InvoiceType.CREDIT_NOTE, amountCents: -5000, number: 'A-2026-0001' });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { cancelledAt: NOW, cancelReason: DELETED_SESSION_REASON, creditNoteId: creditNote!.id },
      });
      expect(mockPrisma.measurement.deleteMany).toHaveBeenCalledWith({ where: { consultationId: 'c1' } });
      expect(mockPrisma.consultation.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      // The invoice itself is never deleted
      expect(mockPrisma).not.toHaveProperty('invoice.delete');
    });

    it('simply deletes a session without invoice', async () => {
      await expect(service.deleteSession('user-1', 'c1', NOW)).resolves.toEqual({ creditNote: null });
      expect(mockPrisma.invoice.create).not.toHaveBeenCalled();
      expect(mockPrisma.consultation.delete).toHaveBeenCalled();
    });
  });

  describe('invoice made by mistake → « Annuler la facture »', () => {
    it('issues the credit note and keeps the optional reason', async () => {
      const creditNote = await service.cancel(user as any, 'i1', '  Séance offerte ', NOW);
      expect(creditNote).toMatchObject({ type: InvoiceType.CREDIT_NOTE, amountCents: -5000 });
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'i1' },
        data: { cancelledAt: NOW, cancelReason: 'Séance offerte', creditNoteId: creditNote.id },
      });
    });

    it('records no reason when none is given', async () => {
      await service.cancel(user as any, 'i1', '   ', NOW);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ cancelReason: null }) }),
      );
    });

    it('leaves the session without invoice: a new one can then be issued', async () => {
      await service.cancel(user as any, 'i1', undefined, NOW);
      mockPrisma.invoice.findFirst.mockResolvedValue(null);
      await expect(service.issue(user as any, 'c1', NOW)).resolves.toMatchObject({ type: InvoiceType.INVOICE });
    });

    it('refuses an unknown invoice', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.cancel(user as any, 'nope', undefined, NOW)).rejects.toThrow(NotFoundException);
    });
  });

  describe('wrong practice or patient details → corrected, then « Corriger la facture »', () => {
    it('the new invoice carries the details as they are now; the old one keeps its copy', async () => {
      mockPrisma.consultation.findUnique.mockResolvedValue({
        ...session,
        practice: { ...aix, address: '8 cours Mirabeau' },
        patient: { ...session.patient, lastName: 'Roux-Martin' },
      });
      const replacement = await service.correct(user as any, 'i1', NOW);
      expect(replacement).toMatchObject({ practiceAddress: '8 cours Mirabeau', patientLastName: 'Roux-Martin' });
      // The credit note reproduces the cancelled invoice exactly
      expect(createdOf(InvoiceType.CREDIT_NOTE)).toMatchObject({
        practiceAddress: '12 rue des Oliviers',
        patientLastName: 'Roux',
      });
    });
  });

  // ─── Reading ─────────────────────────────────────────────────────────────────

  describe('forSession', () => {
    it('gives the invoice in force, what no longer matches, and the cancelled ones', async () => {
      const cancelled = { ...issued, id: 'i0', number: '2026-0003', cancelledAt: NOW };
      const credit = { ...issued, id: 'a1', type: InvoiceType.CREDIT_NOTE, number: 'A-2026-0001', amountCents: -5000 };
      mockPrisma.invoice.findMany.mockResolvedValue([cancelled, credit, issued]);

      const result = await service.forSession(user as any, 'c1');
      expect(result.current).toBe(issued);
      // The session is now paid by card, on another day
      expect(result.mismatches).toEqual(['paymentMethod', 'date']);
      expect(result.history.map((i) => i.number)).toEqual(['A-2026-0001', '2026-0003']);
    });

    it('has no current invoice for a session not invoiced yet', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([]);
      await expect(service.forSession(user as any, "c1")).resolves.toEqual({ current: null, mismatches: [], history: [], payerInvoice: null });
    });
  });

  describe('list and export', () => {
    it('reads her invoices of the period (Paris days, end included) with their totals', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([issued, { ...issued, id: 'i2', cancelledAt: NOW }]);
      const result = await service.list(user as any, '2026-11-01', '2026-11-30');
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            practitionerId: 'user-1',
            issuedAt: { gte: d('2026-10-31T23:00:00Z'), lt: d('2026-11-30T23:00:00Z') },
          },
        }),
      );
      expect(result.totals).toMatchObject({ collectedCents: 5000, count: 1, byPaymentMethod: { CASH: 5000 } });
    });

    it('exports the same invoices as CSV', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([issued]);
      const csv = await service.exportCsv(user as any, '2026-11-01', '2026-11-30');
      expect(csv).toContain('2026-0012;Facture;Patient;20/11/2026;Roux Martine;;Suivi;20/11/2026;;;;50,00;50,00;Espèces;Acquittée;;Oui');
    });

    it('refuses an empty period', () => {
      expect(() => periodRange('2026-11-30', '2026-11-01')).toThrow(BadRequestException);
    });
  });

  describe('forPatient, findOne, sessionsToInvoice', () => {
    it("lists the patient's invoices after checking access", async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([issued]);
      const result = await service.forPatient(user as any, 'p1');
      expect(mockAccess.assertPatient).toHaveBeenCalledWith(user, 'p1');
      expect(result.totals.collectedCents).toBe(5000);
    });

    it('gives one invoice to print, only to its practitioner', async () => {
      await expect(service.findOne(user as any, 'i1')).resolves.toBe(issued);
      expect(mockAccess.assertOwner).toHaveBeenCalledWith(user, 'user-1');
      mockPrisma.invoice.findUnique.mockResolvedValue(null);
      await expect(service.findOne(user as any, 'nope')).rejects.toThrow(NotFoundException);
    });

    it('finds her sessions without an invoice in force', async () => {
      mockPrisma.consultation.findMany.mockResolvedValue([]);
      await service.sessionsToInvoice(user as any);
      expect(mockPrisma.consultation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            patient: { practitionerId: 'user-1', deletedAt: null },
            invoices: { none: { type: InvoiceType.INVOICE, recipient: 'PATIENT', cancelledAt: null } },
            // Free sessions and sessions paid in full by a payer need no patient invoice
            OR: [{ patientCents: null }, { patientCents: { gt: 0 } }],
          },
        }),
      );
    });
  });

  describe('parisStartOfDay', () => {
    it('is 23:00 UTC the day before in winter, 22:00 in summer', () => {
      expect(parisStartOfDay('2026-01-15')).toEqual(d('2026-01-14T23:00:00Z'));
      expect(parisStartOfDay('2026-07-15')).toEqual(d('2026-07-14T22:00:00Z'));
      // Days of the time changes
      expect(parisStartOfDay('2026-03-29')).toEqual(d('2026-03-28T23:00:00Z'));
      expect(parisStartOfDay('2026-10-25')).toEqual(d('2026-10-24T22:00:00Z'));
    });
  });
});
