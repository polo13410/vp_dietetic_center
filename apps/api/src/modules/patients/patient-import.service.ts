import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { FileField, MetricType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { splitColumns } from '../invoices/session-split';
import { estimatedBirthDate } from '../patient-file/calculations';

import { ImportPatientDto } from './dto/import-patient.dto';
import { ImportDraft, NotAPatientFileError, draftFromTables, readTables } from './import/numbers-file';

type Formula = { id: string; label: string };

/**
 * Import of her existing patients, one Numbers file each (docs/PLAN.md « Import »). The file
 * is read into a draft she checks and corrects (preview: nothing saved), then the draft is
 * saved in one go: the patient, the medical file, the height, and one session per row of her
 * follow-up with its weight, as if typed in the app.
 */
@Injectable()
export class PatientImportService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(practitionerId: string, file: { buffer: Buffer; originalname: string }) {
    let parsed;
    try {
      parsed = draftFromTables(readTables(file.buffer), file.originalname);
    } catch (error) {
      if (error instanceof NotAPatientFileError) throw new BadRequestException(error.message);
      throw error;
    }
    return { ...parsed, duplicates: await this.duplicates(practitionerId, parsed.draft) };
  }

  async import(practitionerId: string, dto: ImportPatientDto) {
    if (!dto.allowDuplicate && (await this.duplicates(practitionerId, dto)).length) {
      throw new ConflictException(`Vous avez déjà un patient nommé ${dto.firstName} ${dto.lastName}.`);
    }
    // Archived ones too: an old session keeps the formula it was
    const formulas = await this.prisma.formula.findMany({
      where: { practitionerId },
      orderBy: [{ archivedAt: { sort: 'desc', nulls: 'first' } }, { position: 'asc' }],
      select: { id: true, label: true },
    });
    const sessions = [...dto.sessions].sort((a, b) => a.date.localeCompare(b.date));
    // What her file notes once (age, height, medical file) is dated by the first session
    const start = new Date(sessions[0]?.date ?? new Date().toISOString().slice(0, 10));

    return this.prisma.$transaction(
      async (tx) => {
        const patient = await tx.patient.create({
          data: {
            practitionerId,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            sex: dto.sex ?? null,
            ...(dto.age !== null && dto.age !== undefined
              ? { dateOfBirth: estimatedBirthDate(dto.age, dto.ageOn ? new Date(dto.ageOn) : start), birthDateEstimated: true }
              : {}),
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            address: dto.address ?? null,
            city: dto.city ?? null,
            zipCode: dto.zipCode ?? null,
            familySituation: dto.familySituation ?? null,
            profession: dto.profession ?? null,
            gpName: dto.gpName ?? null,
            consultationReason: dto.consultationReason ?? null,
            referralSource: dto.referralSource ?? null,
          },
          select: { id: true },
        });
        const patientId = patient.id;

        const measurements: Prisma.MeasurementCreateManyInput[] = [];
        if (dto.heightCm) {
          measurements.push({ patientId, type: MetricType.HEIGHT, value: dto.heightCm, measuredAt: start });
        }
        // Her « Dossier médical » weight is the first session's: only kept without sessions
        if (dto.weightKg && !sessions.some((s) => s.weightKg)) {
          measurements.push({ patientId, type: MetricType.WEIGHT, value: dto.weightKg, measuredAt: start });
        }
        const entries: Prisma.FileEntryCreateManyInput[] = Object.values(FileField).flatMap((field) => {
          const content = dto.file?.[field]?.trim();
          return content ? [{ patientId, field, content, date: start }] : [];
        });

        for (const s of sessions) {
          const date = new Date(s.date);
          const formula = formulaOf(formulas, s.label);
          const priceCents = s.priceCents ?? null;
          const session = await tx.consultation.create({
            data: {
              patientId,
              practitionerId,
              date,
              formulaId: formula?.id ?? null,
              formulaLabel: formula?.label ?? (s.label.trim() || null),
              priceCents,
              paymentMethod: s.paymentMethod,
              habits: s.habits?.trim() || null,
              sessionWork: s.sessionWork?.trim() || null,
              advice: s.advice?.trim() || null,
              ...(await splitColumns(tx, { patientId, date, priceCents, discountKind: null, discountValue: null })),
            },
            select: { id: true },
          });
          if (s.weightKg) {
            measurements.push({ patientId, consultationId: session.id, type: MetricType.WEIGHT, value: s.weightKg, measuredAt: date });
          }
          // Her « Aversions » and « Goûts » columns change from session to session: dated versions
          for (const [field, content] of [
            [FileField.AVERSIONS, s.aversions],
            [FileField.TASTES, s.tastes],
          ] as const) {
            if (content?.trim()) entries.push({ patientId, consultationId: session.id, field, content: content.trim(), date });
          }
        }

        if (measurements.length) await tx.measurement.createMany({ data: measurements });
        if (entries.length) await tx.fileEntry.createMany({ data: entries });
        return { id: patientId, sessions: sessions.length };
      },
      { timeout: 30_000 },
    );
  }

  /**
   * Her patients with the same name, case aside. A one-word name (first name not
   * filled in yet) matches a patient with that word as first or last name.
   */
  private async duplicates(practitionerId: string, draft: Pick<ImportDraft, 'firstName' | 'lastName'>) {
    const first = draft.firstName.trim();
    const last = draft.lastName.trim();
    if (!first && !last) return [];
    const word = first || last;
    const same = (value: string) => ({ equals: value, mode: 'insensitive' as const });
    return this.prisma.patient.findMany({
      where: {
        practitionerId,
        deletedAt: null,
        ...(first && last
          ? { firstName: same(first), lastName: same(last) }
          : { OR: [{ firstName: same(word) }, { lastName: same(word) }] }),
      },
      select: { id: true, firstName: true, lastName: true },
      take: 5,
    });
  }
}

/** « Bilan » rows take her Bilan formula, « Suivi n » rows her Suivi one. */
export function formulaOf(formulas: Formula[], rowLabel: string): Formula | undefined {
  const row = plain(rowLabel);
  const kind = ['bilan', 'suivi'].find((k) => row.startsWith(k));
  return kind ? formulas.find((f) => plain(f.label).startsWith(kind)) : undefined;
}

const plain = (label: string) =>
  label.normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase();
