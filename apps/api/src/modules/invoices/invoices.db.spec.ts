/*
 * Invoicing against a real PostgreSQL database: numbering under concurrency, the yearly reset,
 * no gaps (even when a transaction fails), separate series, the corrections table and the
 * database guard that forbids changing or deleting an issued invoice.
 * Runs when TEST_DATABASE_URL points to a migrated database (CI does); skipped otherwise.
 */
import { randomUUID } from 'node:crypto';

import { InvoiceType, PaymentMethod, PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { ConsultationsService } from '../patient-file/consultations.service';

import { InvoicesService } from './invoices.service';
import { nextInvoiceNumber } from './numbering';
import { PayerInvoicesService } from './payer-invoices.service';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('invoices on a real database', () => {
  let prisma: PrismaClient;
  let invoices: InvoicesService;
  let sessions: ConsultationsService;
  let appointments: AppointmentsService;
  const practitioners: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: url });
    const access = new PatientAccessService(prisma as any);
    invoices = new InvoicesService(prisma as any, access, new PayerInvoicesService(prisma as any, access));
    sessions = new ConsultationsService(prisma as any, access, invoices);
    appointments = new AppointmentsService(prisma as any, access);
  });

  afterAll(async () => {
    if (!prisma) return;
    const ids = practitioners;
    await prisma.$transaction(async (tx) => {
      // Test data only: the guard lets a transaction delete invoices when it says so
      await tx.$executeRawUnsafe("SET LOCAL app.allow_invoice_delete = 'on'");
      await tx.invoice.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.measurement.deleteMany({ where: { patient: { practitionerId: { in: ids } } } });
      await tx.consultation.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.appointment.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.patient.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.formula.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.practice.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.practitionerProfile.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    await prisma.$disconnect();
  });

  /**
   * A practitioner with her activity, her default practice in Aix, and the test patient of
   * § 3.1 (woman, 56, 1.59 m).
   */
  async function practitionerWithPatient() {
    const user = await prisma.user.create({
      data: {
        email: `invoices-${randomUUID()}@test.local`,
        firstName: 'Valérie',
        lastName: 'Perrot',
        role: 'PRATICIENNE',
        practice: {
          create: {
            practiceName: 'Valérie Perrot, diététicienne nutritionniste',
            siret: '91234567800011',
            adeliRpps: '139512345',
            vatMention: 'TVA non applicable, article 261-4-1° du CGI',
          },
        },
        practices: {
          create: {
            name: 'Aix',
            address: '12 rue des Oliviers',
            zipCode: '13100',
            city: 'Aix-en-Provence',
            isDefault: true,
          },
        },
      },
      include: { practices: true },
    });
    practitioners.push(user.id);
    const patient = await prisma.patient.create({
      data: { practitionerId: user.id, firstName: 'Martine', lastName: 'Roux', sex: 'F', dateOfBirth: new Date('1970-01-01') },
    });
    const newSession = (over: { priceCents?: number; paymentMethod?: PaymentMethod; date?: Date } = {}) =>
      prisma.consultation.create({
        data: {
          practitionerId: user.id,
          patientId: patient.id,
          date: over.date ?? new Date('2026-11-20T09:00:00Z'),
          formulaLabel: 'Suivi',
          priceCents: over.priceCents ?? 5000,
          paymentMethod: over.paymentMethod ?? PaymentMethod.CARD,
        },
      });
    return { user: { id: user.id, role: user.role }, patient, newSession, aix: user.practices[0] };
  }

  const NOW = new Date('2026-11-22T10:00:00Z');

  describe('numbering', () => {
    it('gives 20 sessions invoiced at the same time 20 different numbers, without gaps', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const all = await Promise.all(Array.from({ length: 20 }, () => newSession()));

      const issued = await Promise.all(all.map((s) => invoices.issue(user, s.id, NOW)));

      expect(issued.map((i) => i.number).sort()).toEqual(
        Array.from({ length: 20 }, (_, i) => `2026-${String(i + 1).padStart(4, '0')}`),
      );
    });

    it('invoices a session only once, even when asked twice at the same time', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const s = await newSession();
      const results = await Promise.allSettled([invoices.issue(user, s.id, NOW), invoices.issue(user, s.id, NOW)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.invoice.count({ where: { consultationId: s.id } })).toBe(1);
    });

    it('leaves no gap when an issue fails after taking its number', async () => {
      const { user, newSession } = await practitionerWithPatient();
      await invoices.issue(user, (await newSession()).id, NOW);
      await expect(
        prisma.$transaction(async (tx) => {
          const reserved = await nextInvoiceNumber(tx, user.id, InvoiceType.INVOICE, NOW);
          expect(reserved.number).toBe('2026-0002');
          throw new Error('printer on fire');
        }),
      ).rejects.toThrow('printer on fire');
      await expect(invoices.issue(user, (await newSession()).id, NOW)).resolves.toMatchObject({ number: '2026-0002' });
    });

    it('starts again at 0001 each year (Paris time)', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const dec31 = await invoices.issue(user, (await newSession()).id, new Date('2026-12-31T22:30:00Z'));
      const jan1 = await invoices.issue(user, (await newSession()).id, new Date('2026-12-31T23:30:00Z'));
      const jan2 = await invoices.issue(user, (await newSession()).id, new Date('2027-01-02T10:00:00Z'));
      expect([dec31.number, jan1.number, jan2.number]).toEqual(['2026-0001', '2027-0001', '2027-0002']);
    });

    it('keeps invoices and credit notes in separate series, and each practitioner in her own', async () => {
      const a = await practitionerWithPatient();
      const b = await practitionerWithPatient();
      const first = await invoices.issue(a.user, (await a.newSession()).id, NOW);
      await invoices.issue(a.user, (await a.newSession()).id, NOW);
      const credit = await invoices.cancel(a.user, first.id, undefined, NOW);
      const third = await invoices.issue(a.user, (await a.newSession()).id, NOW);
      const other = await invoices.issue(b.user, (await b.newSession()).id, NOW);
      expect([credit.number, third.number, other.number]).toEqual(['A-2026-0001', '2026-0003', '2026-0001']);
    });
  });

  describe('corrections table', () => {
    it('wrong price, payment or date: the session is corrected, then « Corriger la facture »', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const s = await newSession({ paymentMethod: PaymentMethod.NONE });
      const first = await invoices.issue(user, s.id, NOW);

      await prisma.consultation.update({
        where: { id: s.id },
        data: { priceCents: 6000, paymentMethod: PaymentMethod.CHECK, date: new Date('2026-11-21T09:00:00Z') },
      });
      expect((await invoices.forSession(user, s.id)).mismatches).toEqual(['price', 'paymentMethod', 'date']);

      const replacement = await invoices.correct(user, first.id, NOW);
      const old = await prisma.invoice.findUniqueOrThrow({ where: { id: first.id }, include: { creditNote: true } });

      expect(old.cancelledAt).not.toBeNull();
      expect(old.replacedById).toBe(replacement.id);
      expect(old.creditNote).toMatchObject({ number: 'A-2026-0001', amountCents: -5000, paymentMethod: PaymentMethod.NONE });
      expect(replacement).toMatchObject({
        number: '2026-0002',
        amountCents: 6000,
        paymentMethod: PaymentMethod.CHECK,
        replaces: { id: first.id, number: '2026-0001' },
      });
      const state = await invoices.forSession(user, s.id);
      expect(state.current?.id).toBe(replacement.id);
      expect(state.mismatches).toEqual([]);
      expect(state.history.map((i) => i.number)).toEqual(['A-2026-0001', '2026-0001']);
    });

    it('session created by mistake: deleting it issues the credit note; both documents stay', async () => {
      const { user, patient, newSession } = await practitionerWithPatient();
      const s = await newSession();
      const invoice = await invoices.issue(user, s.id, NOW);

      await sessions.remove(user, s.id);

      expect(await prisma.consultation.findUnique({ where: { id: s.id } })).toBeNull();
      const kept = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { creditNote: true } });
      expect(kept).toMatchObject({
        consultationId: null,
        cancelReason: 'Séance supprimée',
        number: '2026-0001',
        amountCents: 5000,
        patientLastName: 'Roux',
        serviceLabel: 'Suivi',
      });
      expect(kept.creditNote).toMatchObject({ number: 'A-2026-0001', consultationId: null, amountCents: -5000 });
      // Even erasing the patient leaves the invoices whole
      await prisma.patient.delete({ where: { id: patient.id } });
      const orphan = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(orphan).toMatchObject({ patientId: null, patientFirstName: 'Martine', patientLastName: 'Roux' });
    });

    it('invoice made by mistake: « Annuler la facture » with a reason; the session can be invoiced again', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const s = await newSession();
      const invoice = await invoices.issue(user, s.id, NOW);

      const credit = await invoices.cancel(user, invoice.id, 'Séance offerte', NOW);
      expect(credit).toMatchObject({ type: InvoiceType.CREDIT_NOTE, cancels: { id: invoice.id } });
      expect((await invoices.forSession(user, s.id)).current).toBeNull();
      expect(await invoices.sessionsToInvoice(user)).toEqual([expect.objectContaining({ id: s.id })]);
      await expect(invoices.cancel(user, invoice.id, undefined, NOW)).rejects.toThrow('déjà annulée');

      await expect(invoices.issue(user, s.id, NOW)).resolves.toMatchObject({ number: '2026-0002' });
    });

    it('wrong practice details: corrected in the settings, then « Corriger la facture »', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const invoice = await invoices.issue(user, (await newSession()).id, NOW);
      await prisma.practice.updateMany({ where: { practitionerId: user.id }, data: { address: '8 cours Mirabeau' } });

      const replacement = await invoices.correct(user, invoice.id, NOW);
      expect(replacement.practiceAddress).toBe('8 cours Mirabeau');
      const old = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(old.practiceAddress).toBe('12 rue des Oliviers');
    });
  });

  describe('several practices (lot 15)', () => {
    it("a séance booked in Marseille is invoiced with Marseille's address and SIRET", async () => {
      const { user, patient, aix } = await practitionerWithPatient();
      const marseille = await prisma.practice.create({
        data: {
          practitionerId: user.id,
          name: 'Marseille',
          address: '40 rue Paradis',
          zipCode: '13001',
          city: 'Marseille',
          siret: '73282932000074',
        },
      });
      const bilan = await prisma.formula.create({
        data: { practitionerId: user.id, label: 'Bilan', priceCents: 6000, durationMinutes: 60 },
      });

      const appointment = await appointments.create(
        { patientId: patient.id, startAt: '2026-11-20T09:00:00.000Z', type: 'IN_PERSON', formulaId: bilan.id, practiceId: marseille.id },
        user as any,
      );
      expect(appointment).toMatchObject({ duration: 60, endAt: new Date('2026-11-20T10:00:00.000Z') });
      const session = await sessions.create(user, patient.id, { appointmentId: appointment.id });
      expect(session).toMatchObject({ formulaLabel: 'Bilan', priceCents: 6000, practiceId: marseille.id });

      const invoice = await invoices.issue(user, session.id, NOW);
      expect(invoice).toMatchObject({
        practiceName: 'Valérie Perrot, diététicienne nutritionniste',
        practiceAddress: '40 rue Paradis',
        practiceCity: 'Marseille',
        siret: '73282932000074',
        amountCents: 6000,
      });

      // Moved to Aix afterwards: the invoice no longer matches, and its correction says Aix
      await sessions.update(user, session.id, { practiceId: aix.id });
      expect((await invoices.forSession(user, session.id)).mismatches).toEqual(['practice']);
      const corrected = await invoices.correct(user, invoice.id, NOW);
      expect(corrected).toMatchObject({ practiceAddress: '12 rue des Oliviers', siret: '91234567800011' });
    });

    it('a séance without an appointment takes place in her default practice', async () => {
      const { user, patient, aix } = await practitionerWithPatient();
      const session = await sessions.create(user, patient.id, {});
      expect(session.practiceId).toBe(aix.id);
    });
  });

  describe('Factures page', () => {
    it('totals the period without cancelled invoices and credit notes', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const card = await invoices.issue(user, (await newSession()).id, NOW);
      await invoices.issue(user, (await newSession({ priceCents: 6000, paymentMethod: PaymentMethod.CASH })).id, NOW);
      await invoices.issue(user, (await newSession({ paymentMethod: PaymentMethod.NONE })).id, NOW);
      await invoices.cancel(user, card.id, undefined, NOW);

      const { invoices: listed, totals } = await invoices.list(user, '2026-11-01', '2026-11-30');
      expect(listed).toHaveLength(4);
      expect(totals).toMatchObject({ collectedCents: 6000, unpaidCents: 5000, count: 2, byPaymentMethod: { CASH: 6000, CARD: 0 } });
      const csv = await invoices.exportCsv(user, '2026-11-01', '2026-11-30');
      const lines = csv.trimEnd().split('\r\n').slice(1);
      expect(lines).toHaveLength(4);
      expect(lines.filter((l) => l.includes(';Annulée;'))).toHaveLength(1);
      expect(lines.filter((l) => l.startsWith('A-2026-0001;Avoir;'))).toHaveLength(1);
    });
  });

  describe('database guard', () => {
    it('refuses to delete or change an issued invoice', async () => {
      const { user, newSession } = await practitionerWithPatient();
      const invoice = await invoices.issue(user, (await newSession()).id, NOW);
      await expect(prisma.invoice.delete({ where: { id: invoice.id } })).rejects.toThrow(/cannot be deleted/);
      await expect(
        prisma.invoice.update({ where: { id: invoice.id }, data: { amountCents: 1 } }),
      ).rejects.toThrow(/cannot be changed/);
      await invoices.cancel(user, invoice.id, undefined, NOW);
      await expect(
        prisma.invoice.update({ where: { id: invoice.id }, data: { cancelledAt: new Date() } }),
      ).rejects.toThrow(/cannot be changed/);
    });
  });
});
