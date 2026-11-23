/*
 * Discount and third-party payers (docs/REFONTE.md lot 16) against a real PostgreSQL database:
 * the patient invoice of a session with a discount and a payer, the sessions a payer invoice
 * takes over a period (Paris days, both bounds), no session billed twice (even at the same
 * time), cancelled invoices releasing their sessions, one numbering for patients and payers,
 * the caps of a coverage, the payment follow-up, the correction and the database guard.
 * Runs when TEST_DATABASE_URL points to a migrated database (CI does); skipped otherwise.
 */
import { randomUUID } from 'node:crypto';

import { BillingRhythm, InvoiceType, PrismaClient, ShareKind } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PatientAccessService } from '../../common/access/patient-access.service';
import { ConsultationsService } from '../patient-file/consultations.service';

import { InvoicesService } from './invoices.service';
import { PayerInvoicesService } from './payer-invoices.service';
import { PayersService } from './payers.service';

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('payer invoices on a real database', () => {
  let prisma: PrismaClient;
  let invoices: InvoicesService;
  let payerInvoices: PayerInvoicesService;
  let payers: PayersService;
  let sessions: ConsultationsService;
  const practitioners: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: url });
    const access = new PatientAccessService(prisma as any);
    payerInvoices = new PayerInvoicesService(prisma as any, access);
    invoices = new InvoicesService(prisma as any, access, payerInvoices);
    payers = new PayersService(prisma as any, access);
    sessions = new ConsultationsService(prisma as any, access, invoices);
  });

  afterAll(async () => {
    if (!prisma) return;
    const ids = practitioners;
    await prisma.$transaction(async (tx) => {
      // Test data only: the guard lets a transaction delete invoices when it says so
      await tx.$executeRawUnsafe("SET LOCAL app.allow_invoice_delete = 'on'");
      await tx.invoiceLine.deleteMany({ where: { invoice: { practitionerId: { in: ids } } } });
      await tx.invoice.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.consultation.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.patientCoverage.deleteMany({ where: { patient: { practitionerId: { in: ids } } } });
      await tx.payer.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.patient.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.formula.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.practice.deleteMany({ where: { practitionerId: { in: ids } } });
      await tx.practitionerProfile.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
    await prisma.$disconnect();
  });

  const NOW = new Date('2026-12-02T10:00:00Z');

  /**
   * A practitioner with her « Suivi » at 50 €, a mutuelle billed monthly, and two patients it
   * covers: Martine 60 % of the net, Paul 20 € per session for 2 sessions at most.
   */
  async function practice() {
    const user = await prisma.user.create({
      data: {
        email: `payers-${randomUUID()}@test.local`,
        firstName: 'Valérie',
        lastName: 'Perrot',
        role: 'PRATICIENNE',
        practice: { create: { practiceName: 'Valérie Perrot, diététicienne nutritionniste' } },
        practices: { create: { name: 'Aix', address: '12 rue des Oliviers', zipCode: '13100', city: 'Aix-en-Provence', isDefault: true } },
        formulas: { create: { label: 'Suivi', priceCents: 5000 } },
      },
      include: { formulas: true },
    });
    practitioners.push(user.id);
    const me = { id: user.id, role: user.role };
    const suivi = user.formulas[0].id;
    const mutuelle = await payers.create(me, { name: 'Mutuelle Horizon', city: 'Marseille', billingRhythm: BillingRhythm.MONTHLY });
    const patient = (firstName: string) =>
      prisma.patient.create({ data: { practitionerId: user.id, firstName, lastName: 'Roux' } });
    const martine = await patient('Martine');
    const paul = await patient('Paul');
    const nobody = await patient('Nadia');
    await payers.createCoverage(me, martine.id, { payerId: mutuelle.id, kind: ShareKind.PERCENT, value: 60, coverageNumber: 'PEC-1' });
    await payers.createCoverage(me, paul.id, { payerId: mutuelle.id, kind: ShareKind.AMOUNT, value: 2000, maxSessions: 2 });
    const session = (patientId: string, date: string) => sessions.create(me, patientId, { formulaId: suivi, date });
    return { user: me, mutuelle, martine, paul, nobody, session };
  }

  it('a session with a discount and a payer gives the right patient invoice', async () => {
    const { user, martine, session } = await practice();
    const s = await session(martine.id, '2026-11-10T09:00:00Z');
    await sessions.update(user, s.id, { discountKind: ShareKind.AMOUNT, discountValue: 1000, discountReason: 'geste' });

    const saved = await prisma.consultation.findUniqueOrThrow({ where: { id: s.id } });
    // 50 € − 10 € = 40 € net; 60 % of it, 24 €, by the mutuelle; 16 € for Martine
    expect(saved).toMatchObject({ discountCents: 1000, netCents: 4000, payerCents: 2400, patientCents: 1600 });

    const invoice = await invoices.issue(user, s.id, NOW);
    expect(invoice).toMatchObject({
      recipient: 'PATIENT',
      amountCents: 1600,
      priceCents: 5000,
      discountCents: 1000,
      discountReason: 'geste',
      payerCents: 2400,
      payerName: 'Mutuelle Horizon',
    });
  });

  it('caps a coverage by its number of sessions; the next session is the patient’s', async () => {
    const { paul, session } = await practice();
    const first = await session(paul.id, '2026-11-03T09:00:00Z');
    const second = await session(paul.id, '2026-11-10T09:00:00Z');
    const third = await session(paul.id, '2026-11-17T09:00:00Z');
    const split = (id: string) => prisma.consultation.findUniqueOrThrow({ where: { id } });
    expect(await split(first.id)).toMatchObject({ payerCents: 2000, patientCents: 3000 });
    expect(await split(second.id)).toMatchObject({ payerCents: 2000, patientCents: 3000 });
    expect(await split(third.id)).toMatchObject({ payerCents: 0, patientCents: 5000, payerId: null });
  });

  it('a payer invoice over a period takes exactly its sessions, Paris days, both bounds', async () => {
    const { user, mutuelle, martine, paul, nobody, session } = await practice();
    await session(martine.id, '2026-10-31T22:30:00Z'); // 31 October, 23:30 in Paris
    const first = await session(martine.id, '2026-10-31T23:30:00Z'); // 1 November, 0:30
    const middle = await session(paul.id, '2026-11-15T09:00:00Z');
    const last = await session(martine.id, '2026-11-30T22:30:00Z'); // 30 November, 23:30
    await session(martine.id, '2026-11-30T23:30:00Z'); // 1 December, 0:30
    await session(nobody.id, '2026-11-12T09:00:00Z'); // no coverage
    const free = await session(martine.id, '2026-11-20T09:00:00Z');
    await sessions.update(user, free.id, { discountKind: ShareKind.PERCENT, discountValue: 100 });

    const preview = await payerInvoices.preview(user, mutuelle.id, '2026-11-01', '2026-11-30');
    expect(preview.sessions.map((s) => s.id)).toEqual([first.id, middle.id, last.id]);
    // 30 € + 20 € + 30 €
    expect(preview.totalCents).toBe(8000);

    const invoice = await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW);
    expect(invoice).toMatchObject({
      recipient: 'PAYER',
      type: InvoiceType.INVOICE,
      amountCents: 8000,
      payerName: 'Mutuelle Horizon',
      patientFirstName: null,
      practiceAddress: '12 rue des Oliviers',
      periodStart: new Date('2026-11-01T00:00:00Z'),
      periodEnd: new Date('2026-11-30T00:00:00Z'),
      paidAt: null,
    });
    expect(invoice.lines.map((l) => [l.consultationId, l.patientFirstName, l.serviceLabel, l.amountCents, l.coverageNumber])).toEqual([
      [first.id, 'Martine', 'Suivi', 3000, 'PEC-1'],
      [middle.id, 'Paul', 'Suivi', 2000, null],
      [last.id, 'Martine', 'Suivi', 3000, 'PEC-1'],
    ]);
  });

  it('never bills a session twice, even when asked twice at the same time', async () => {
    const { user, mutuelle, martine, session } = await practice();
    await session(martine.id, '2026-11-10T09:00:00Z');

    const results = await Promise.allSettled([
      payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW),
      payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    // An overlapping period finds nothing left to bill
    await expect(payerInvoices.issue(user, mutuelle.id, '2026-11-05', '2026-12-31', NOW)).rejects.toThrow('Aucune séance');
    expect((await payerInvoices.preview(user, mutuelle.id, '2026-11-01', '2026-11-30')).sessions).toEqual([]);
  });

  it('a cancelled payer invoice releases its sessions, and its credit note takes them in negative', async () => {
    const { user, mutuelle, martine, session } = await practice();
    const s = await session(martine.id, '2026-11-10T09:00:00Z');
    const invoice = await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW);

    const creditNote = await invoices.cancel(user, invoice.id, 'Erreur de période', NOW);
    const withLines = await prisma.invoice.findUniqueOrThrow({ where: { id: creditNote.id }, include: { lines: true } });
    expect(withLines).toMatchObject({ type: InvoiceType.CREDIT_NOTE, recipient: 'PAYER', amountCents: -3000, payerName: 'Mutuelle Horizon' });
    expect(withLines.lines).toMatchObject([{ consultationId: s.id, amountCents: -3000 }]);

    const again = await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW);
    expect(again.lines.map((l) => l.consultationId)).toEqual([s.id]);
  });

  it('patients and payers share one series of numbers', async () => {
    const { user, mutuelle, martine, nobody, session } = await practice();
    const a = await session(nobody.id, '2026-11-10T09:00:00Z');
    await session(martine.id, '2026-11-12T09:00:00Z');
    const b = await session(nobody.id, '2026-11-14T09:00:00Z');

    const numbers = [
      (await invoices.issue(user, a.id, NOW)).number,
      (await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW)).number,
      (await invoices.issue(user, b.id, NOW)).number,
    ];
    expect(numbers).toEqual(['2026-0001', '2026-0002', '2026-0003']);
  });

  it('follows the payment: « en attente », then « réglée le … »', async () => {
    const { user, mutuelle, martine, session } = await practice();
    await session(martine.id, '2026-11-10T09:00:00Z');
    const invoice = await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW);

    await expect(payerInvoices.setPaid(user, invoice.id, '2026-12-15')).resolves.toMatchObject({
      paidAt: new Date('2026-12-15T00:00:00Z'),
    });
    await expect(payerInvoices.setPaid(user, invoice.id, '2026-11-01')).rejects.toThrow('avant la facture');
    // The guard keeps everything else as issued, lines included
    await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { amountCents: 1 } })).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(prisma.invoiceLine.updateMany({ where: { invoiceId: invoice.id }, data: { amountCents: 1 } })).rejects.toThrow(
      /cannot be changed/,
    );
    await expect(prisma.invoiceLine.deleteMany({ where: { invoiceId: invoice.id } })).rejects.toThrow(/cannot be deleted/);
  });

  it('says when its sessions changed, and the correction redoes the period', async () => {
    const { user, mutuelle, martine, paul, session } = await practice();
    const s = await session(martine.id, '2026-11-10T09:00:00Z');
    const invoice = await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW);
    await sessions.update(user, s.id, { discountKind: ShareKind.AMOUNT, discountValue: 1000 });
    await session(paul.id, '2026-11-20T09:00:00Z');

    const listed = (await payerInvoices.list(user)).find((i) => i.id === invoice.id)!;
    expect(listed.mismatches).toEqual({ deleted: 0, changed: 1, added: 1 });

    const replacement = await invoices.correct(user, invoice.id, NOW);
    // 60 % of 40 €, and Paul's 20 €
    expect(replacement).toMatchObject({ amountCents: 4400, recipient: 'PAYER' });
    expect(replacement.lines).toHaveLength(2);
    const old = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(old).toMatchObject({ replacedById: replacement.id });
    expect(old.cancelledAt).not.toBeNull();
  });

  it('a deleted session leaves its line, unlinked, and the invoice says so', async () => {
    const { user, mutuelle, martine, session } = await practice();
    const s = await session(martine.id, '2026-11-10T09:00:00Z');
    const invoice = await payerInvoices.issue(user, mutuelle.id, '2026-11-01', '2026-11-30', NOW);

    await sessions.remove(user, s.id);

    const lines = await prisma.invoiceLine.findMany({ where: { invoiceId: invoice.id } });
    expect(lines).toMatchObject([{ consultationId: null, patientFirstName: 'Martine', amountCents: 3000 }]);
    expect((await payerInvoices.list(user)).find((i) => i.id === invoice.id)!.mismatches).toEqual({
      deleted: 1,
      changed: 0,
      added: 0,
    });
  });

  it("only bills the practitioner's own patients", async () => {
    const mine = await practice();
    const other = await practice();
    // A session of another practitioner's patient wrongly pointing at her payer
    const stranger = await other.session(other.martine.id, '2026-11-10T09:00:00Z');
    await prisma.consultation.update({ where: { id: stranger.id }, data: { payerId: mine.mutuelle.id } });
    const own = await mine.session(mine.martine.id, '2026-11-12T09:00:00Z');

    const preview = await payerInvoices.preview(mine.user, mine.mutuelle.id, '2026-11-01', '2026-11-30');
    expect(preview.sessions.map((s) => s.id)).toEqual([own.id]);
    await expect(payerInvoices.preview(other.user, mine.mutuelle.id, '2026-11-01', '2026-11-30')).rejects.toThrow();
  });

  it('shows the next period to bill and the reminders of the dashboard', async () => {
    const { user, mutuelle, martine, session } = await practice();
    await session(martine.id, '2026-10-20T09:00:00Z');
    await session(martine.id, '2026-11-10T09:00:00Z');

    const [overview] = (await payerInvoices.overview(user, '2026-11-23')).filter((p) => p.id === mutuelle.id);
    expect(overview.nextPeriod).toMatchObject({ from: '2026-10-01', to: '2026-10-31', ended: true, sessionCount: 1, totalCents: 3000 });

    const october = await payerInvoices.issue(user, mutuelle.id, '2026-10-01', '2026-10-31', new Date('2026-09-01T10:00:00Z'));
    const reminders = await payerInvoices.reminders(user, new Date('2026-12-05T10:00:00Z'));
    expect(reminders.periodsToBill).toMatchObject([{ payer: { id: mutuelle.id }, from: '2026-11-01', to: '2026-11-30', sessionCount: 1 }]);
    // Issued more than 60 days ago and still « en attente »
    expect(reminders.overdueInvoices.map((i) => i.id)).toEqual([october.id]);
  });
});
