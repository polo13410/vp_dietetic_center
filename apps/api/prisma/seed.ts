/*
 * Local demo data: three accounts, the practitioner's practice (printed on invoices) and two
 * formulas (Bilan 60 €, Suivi 50 €), and five patients with
 * realistic follow-ups (sessions, weights, medical file with its history, life events).
 * Martine Roux is the test case of docs/REFONTE.md § 3.1: woman, 56, 1.59 m, 79 → 78.2 →
 * 76.5 kg (BMI 31.25, BMR 5.86 / 5.83 / 5.77 MJ, 1 400.3 / 1 393.5 / 1 378.9 kcal).
 * Past sessions are invoiced through the app's own rules, except the two latest (« à facturer »);
 * one invoice was corrected (credit note + new invoice). Martine has a report to her GP sent after
 * the bilan, and a draft pre-filled today by the app.
 * Dates are relative to today, so the dashboard always has something to show.
 * Re-running the seed rebuilds the demo patients from scratch.
 */
import {
  AppointmentStatus,
  AppointmentType,
  FileField,
  GpReportStatus,
  LifeEventCategory,
  MetricType,
  PaymentMethod,
  PrismaClient,
  Sex,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

import { PatientAccessService } from '../src/common/access/patient-access.service';
import { InvoicesService } from '../src/modules/invoices/invoices.service';
import { GpReportsService } from '../src/modules/patient-file/gp-reports.service';

const prisma = new PrismaClient();

const DAY = 24 * 3600 * 1000;
const today = new Date();
today.setHours(0, 0, 0, 0);
/** A date `days` from today (negative = past), at the given hour. */
const at = (days: number, hour = 10, minute = 0) => {
  const d = new Date(today.getTime() + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};
/** The calendar day of a date, for date-only columns. */
const dayOf = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
/** Born `years` ago, the birthday having been `daysAgo` days ago (so the age is stable for a while). */
const bornYearsAgo = (years: number, daysAgo: number) => {
  const d = new Date(today.getTime() - daysAgo * DAY);
  return dayOf(new Date(d.getFullYear() - years, d.getMonth(), d.getDate()));
};
/** January 1st of the estimated birth year, when only the age is known (§ 3.1). */
const estimatedBirth = (age: number) => new Date(Date.UTC(today.getFullYear() - age, 0, 1));

// Fixed ids so the seed can be re-run
const PATIENT_IDS = {
  martine: '0b6f3d4e-1c55-4a7e-9d1a-000000000006',
  marie: '0b6f3d4e-1c55-4a7e-9d1a-000000000001',
  thomas: '0b6f3d4e-1c55-4a7e-9d1a-000000000002',
  claire: '0b6f3d4e-1c55-4a7e-9d1a-000000000003',
  emma: '0b6f3d4e-1c55-4a7e-9d1a-000000000004',
  lucas: '0b6f3d4e-1c55-4a7e-9d1a-000000000005',
};

type Formulas = { bilan: string; suivi: string };

type SessionSeed = {
  daysAgo: number;
  paymentMethod: PaymentMethod;
  weight?: number;
  /** Other measurements (height, waist…) */
  measurements?: Partial<Record<MetricType, number>>;
  habits?: string;
  sessionWork: string;
  advice: string;
  /** Medical file sections written or updated during the session */
  file?: Partial<Record<FileField, string>>;
  events?: { daysAgo: number; title: string; category?: LifeEventCategory }[];
};

async function upsertUser(
  email: string,
  password: string,
  data: { firstName: string; lastName: string; role: UserRole; phone?: string },
) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await bcrypt.hash(password, 12), isActive: true, ...data },
  });
}

/** The practitioner's formulas (managed in the settings, lot 3). */
async function upsertFormulas(practitionerId: string): Promise<Formulas> {
  const upsert = async (label: string, priceCents: number, position: number) => {
    const existing = await prisma.formula.findFirst({ where: { practitionerId, label } });
    if (existing) return existing.id;
    return (await prisma.formula.create({ data: { practitionerId, label, priceCents, position } })).id;
  };
  return { bilan: await upsert('Bilan', 6000, 0), suivi: await upsert('Suivi', 5000, 1) };
}

/** Her practice, as printed on her invoices (fictitious numbers that pass the checks). */
async function upsertPractice(userId: string) {
  const practice = {
    practiceName: 'Valérie Perrot, diététicienne nutritionniste',
    address: '12 rue des Oliviers',
    zipCode: '13100',
    city: 'Aix-en-Provence',
    siret: '91234567800011',
    adeliRpps: '139512345',
    vatMention: 'TVA non applicable, article 261-4-1° du CGI',
    invoiceFooter: 'Règlement à réception. Merci de votre confiance.',
  };
  await prisma.practitionerProfile.upsert({
    where: { userId },
    update: {},
    create: { userId, ...practice },
  });
}

/** Removes the demo patients and everything attached to them. */
async function resetDemoPatients() {
  const patientId = { in: Object.values(PATIENT_IDS) };
  await prisma.$transaction(async (tx) => {
    // Demo invoices only: issued invoices are otherwise never deleted (database guard)
    await tx.$executeRawUnsafe("SET LOCAL app.allow_invoice_delete = 'on'");
    await tx.invoice.deleteMany({ where: { patientId } });
    await tx.gpReport.deleteMany({ where: { patientId } });
    await tx.fileEntry.deleteMany({ where: { patientId } });
    await tx.measurement.deleteMany({ where: { patientId } });
    await tx.lifeEvent.deleteMany({ where: { patientId } });
    await tx.consultation.deleteMany({ where: { patientId } });
    await tx.task.deleteMany({ where: { patientId } });
    await tx.document.deleteMany({ where: { patientId } });
    await tx.appointment.deleteMany({ where: { patientId } });
    await tx.consent.deleteMany({ where: { patientId } });
    await tx.patient.deleteMany({ where: { id: patientId } });
  });
}

/**
 * Invoices of the past sessions, issued with the app's own rules (numbering, copies, credit
 * notes) one hour after each session. The two latest sessions are left « à facturer ».
 * Martine's « Suivi 1 » was invoiced « Non réglé », the cheque was noted afterwards: its invoice
 * is corrected today (credit note + new invoice).
 */
async function seedInvoices(practitionerId: string) {
  const user = { id: practitionerId, role: UserRole.PRATICIENNE };
  const invoices = new InvoicesService(prisma as any, new PatientAccessService(prisma as any));
  const sessions = await prisma.consultation.findMany({
    where: { practitionerId, patientId: { in: Object.values(PATIENT_IDS) } },
    orderBy: { date: 'asc' },
  });
  const corrected = sessions.filter((s) => s.patientId === PATIENT_IDS.martine)[1];
  let toCorrect: string | null = null;
  for (const s of sessions.slice(0, -2)) {
    const issuedAt = new Date(s.date.getTime() + 3600 * 1000);
    if (s.id !== corrected.id) {
      await invoices.issue(user, s.id, issuedAt);
      continue;
    }
    await prisma.consultation.update({ where: { id: s.id }, data: { paymentMethod: PaymentMethod.NONE } });
    toCorrect = (await invoices.issue(user, s.id, issuedAt)).id;
    await prisma.consultation.update({ where: { id: s.id }, data: { paymentMethod: PaymentMethod.CHECK } });
  }
  if (toCorrect) await invoices.correct(user, toCorrect, at(0, 9));
}

/**
 * Martine's reports to her GP: the first one, sent after the bilan, and today's draft, pre-filled
 * from her file by the app (lot 10), so the recap says « Compte rendu : à faire ».
 */
async function seedGpReports(patientId: string, practitionerId: string) {
  const sentOn = at(-57);
  await prisma.gpReport.create({
    data: {
      patientId,
      authorId: practitionerId,
      date: dayOf(sentOn),
      status: GpReportStatus.SENT,
      sentAt: at(-57, 18),
      content: [
        'Dr Laurent Garnier',
        `Aix-en-Provence, le ${sentOn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        'Objet : bilan diététique de Mme Martine Roux',
        'Docteur,',
        'J’ai reçu Mme Martine Roux, 56 ans, pour un bilan diététique. Elle souhaite perdre le poids pris depuis la ménopause (79 kg, IMC 31,25) et améliorer son bilan lipidique.',
        'Nous avons convenu d’un suivi mensuel, centré sur le rythme des repas et le grignotage lié au stress au travail.',
        'Je vous tiendrai informé de son évolution.',
        'Je vous prie d’agréer, Docteur, l’expression de mes salutations distinguées.',
        'Valérie Perrot\nDiététicienne nutritionniste',
      ].join('\n\n'),
    },
  });
  const reports = new GpReportsService(prisma as any, new PatientAccessService(prisma as any));
  await reports.create({ id: practitionerId, role: UserRole.PRATICIENNE }, patientId, {});
}

/** A past appointment and its session (a row of her follow-up sheet), with what was recorded. */
async function createSession(
  patientId: string,
  practitionerId: string,
  formulas: Formulas,
  isFirst: boolean,
  s: SessionSeed,
) {
  const date = at(-s.daysAgo, 10);
  const label = isFirst ? 'Bilan' : 'Suivi';
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      practitionerId,
      startAt: date,
      endAt: new Date(date.getTime() + 45 * 60 * 1000),
      duration: 45,
      type: AppointmentType.IN_PERSON,
      status: AppointmentStatus.COMPLETED,
      reason: label,
    },
  });
  const session = await prisma.consultation.create({
    data: {
      patientId,
      practitionerId,
      appointmentId: appointment.id,
      date,
      formulaId: isFirst ? formulas.bilan : formulas.suivi,
      formulaLabel: label,
      priceCents: isFirst ? 6000 : 5000,
      paymentMethod: s.paymentMethod,
      habits: s.habits,
      sessionWork: s.sessionWork,
      advice: s.advice,
    },
  });
  const consultationId = session.id;

  const measurements = { ...s.measurements, ...(s.weight ? { WEIGHT: s.weight } : {}) };
  for (const [type, value] of Object.entries(measurements)) {
    await prisma.measurement.create({
      data: { patientId, consultationId, type: type as MetricType, value, measuredAt: dayOf(date) },
    });
  }
  for (const [field, content] of Object.entries(s.file ?? {})) {
    await prisma.fileEntry.create({
      data: { patientId, consultationId, field: field as FileField, content, date: dayOf(date), createdAt: date },
    });
  }
  for (const e of s.events ?? []) {
    await prisma.lifeEvent.create({
      data: { patientId, consultationId, date: dayOf(at(-e.daysAgo)), title: e.title, category: e.category },
    });
  }
}

async function createFollowUp(patientId: string, practitionerId: string, formulas: Formulas, sessions: SessionSeed[]) {
  const ordered = [...sessions].sort((a, b) => b.daysAgo - a.daysAgo);
  for (const [index, s] of ordered.entries()) {
    await createSession(patientId, practitionerId, formulas, index === 0, s);
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ───────────────────────────────────────────────────────────────────
  await upsertUser('admin@vp-dietetic.fr', 'Admin1234!', {
    firstName: 'Paul',
    lastName: 'Administrateur',
    role: UserRole.ADMIN,
  });
  const pract = await upsertUser('praticienne@vp-dietetic.fr', 'Pratic1234!', {
    firstName: 'Valérie',
    lastName: 'Perrot',
    role: UserRole.PRATICIENNE,
    phone: '06 12 34 56 78',
  });
  await upsertUser('assistante@vp-dietetic.fr', 'Assist1234!', {
    firstName: 'Sophie',
    lastName: 'Martin',
    role: UserRole.ASSISTANTE,
  });
  const formulas = await upsertFormulas(pract.id);
  await upsertPractice(pract.id);
  console.log('✅ Users, practice and formulas');

  // ── Patients ────────────────────────────────────────────────────────────────
  await resetDemoPatients();
  const patient = (id: string, data: Omit<Parameters<typeof prisma.patient.create>[0]['data'], 'practitionerId'>) =>
    prisma.patient.create({ data: { ...data, id, practitionerId: pract.id } as any });

  // The test case of § 3.1: woman, 56 (birthday 90 days ago, so every session sees 56), 1.59 m
  await patient(PATIENT_IDS.martine, {
    firstName: 'Martine',
    lastName: 'Roux',
    sex: Sex.F,
    dateOfBirth: bornYearsAgo(56, 90),
    email: 'martine.roux@example.com',
    phone: '06 21 43 65 87',
    address: '12 rue des Lilas',
    city: 'Montpellier',
    zipCode: '34000',
    familySituation: 'Mariée, deux enfants adultes',
    profession: 'Secrétaire médicale',
    gpName: 'Dr Laurent Garnier',
    referralSource: 'Médecin traitant',
    consultationReason: 'Perte de poids (+15 kg depuis la ménopause), cholestérol un peu élevé.',
    createdAt: at(-65),
  });
  await createFollowUp(PATIENT_IDS.martine, pract.id, formulas, [
    {
      daysAgo: 60,
      paymentMethod: PaymentMethod.CHECK,
      weight: 79,
      measurements: { HEIGHT: 159, WAIST: 98 },
      habits:
        "Saute le petit-déjeuner. Grignotage sucré l'après-midi au bureau (biscuits, bonbons). Dîner copieux vers 21 h.",
      sessionWork:
        "Bilan : histoire du poids, rythme des repas, motivation. Explication de l'équilibre alimentaire et des signaux de faim.",
      advice:
        'Petit-déjeuner chaque matin (pain complet, laitage, fruit). Collation à 16 h : un fruit et quelques amandes. Dîner plus léger, avec des légumes.',
      file: {
        HEALTH: 'Hypertension traitée (amlodipine). Arthrose des genoux.',
        FAMILY_HISTORY: 'Mère diabétique de type 2. Père : infarctus à 62 ans.',
        PSYCHOLOGY: 'Grignotage lié au stress au travail. Dort bien.',
        PHYSICAL_ACTIVITY: 'Marche 20 minutes le week-end. Plus de sport depuis 10 ans.',
        WEIGHT_HISTORY:
          'Prise de 15 kg depuis la ménopause. Régime hyperprotéiné en 2019 : −8 kg, repris en un an.',
        ALLERGIES: 'Aucune connue.',
        BLOOD_GLUCOSE: 'Glycémie à jeun 1,08 g/L (bilan sanguin de septembre).',
        CHOLESTEROL_TRIGLYCERIDES: 'LDL 1,45 g/L, triglycérides 1,60 g/L (bilan sanguin de septembre).',
        AVERSIONS: "N'aime pas les légumes cuits, sauf en soupe. Pas de poisson.",
        TASTES: 'Aime les fruits, le fromage, les plats en sauce.',
      },
    },
    {
      daysAgo: 30,
      paymentMethod: PaymentMethod.CARD,
      weight: 78.2,
      habits:
        'Petit-déjeuner pris 5 jours sur 7. Grignotage en baisse, sauf les jours de forte charge au travail.',
      sessionWork: "Travail sur la faim et l'envie de manger. Repérage des situations de grignotage.",
      advice: 'Garder le petit-déjeuner. Préparer la collation la veille. Légumes en soupe le soir.',
      file: { TASTES: 'Aime les fruits, le fromage, les plats en sauce. Découvre les soupes de légumes maison.' },
      events: [{ daysAgo: 40, title: "Reprise de l'aquagym", category: LifeEventCategory.HEALTH }],
    },
    {
      daysAgo: 7,
      paymentMethod: PaymentMethod.NONE,
      weight: 76.5,
      measurements: { WAIST: 95 },
      habits: 'Plus de grignotage au bureau. Dîner vers 20 h, plus léger. Se sent moins fatiguée.',
      sessionWork: 'Point sur les repas au restaurant et les invitations. Travail sur les portions.',
      advice: 'Au restaurant : une entrée ou un dessert, pas les deux. Continuer la marche et l’aquagym.',
      file: { PHYSICAL_ACTIVITY: 'Marche 30 minutes trois fois par semaine, aquagym le mardi.' },
    },
  ]);
  await seedGpReports(PATIENT_IDS.martine, pract.id);

  await patient(PATIENT_IDS.marie, {
    firstName: 'Marie',
    lastName: 'Dubois',
    sex: Sex.F,
    dateOfBirth: new Date('1985-03-15'),
    email: 'marie.dubois@example.com',
    phone: '06 12 34 56 78',
    city: 'Paris',
    zipCode: '75011',
    familySituation: 'En couple, deux enfants (4 ans et 1 an)',
    profession: 'Comptable',
    gpName: 'Dr Anne Lefèvre',
    referralSource: 'Médecin traitant',
    consultationReason: 'Perte de poids après sa deuxième grossesse (+12 kg), fatigue, grignotage le soir.',
    createdAt: at(-130),
  });
  await createFollowUp(PATIENT_IDS.marie, pract.id, formulas, [
    {
      daysAgo: 120,
      paymentMethod: PaymentMethod.CARD,
      weight: 82,
      measurements: { HEIGHT: 165, WAIST: 96 },
      habits: 'Saute le petit-déjeuner, grignote en rentrant du travail et le soir. Dort 6 h.',
      sessionWork: 'Bilan, rythme de vie avec deux jeunes enfants.',
      advice: 'Introduire un petit-déjeuner simple. Noter les grignotages pendant 2 semaines.',
      file: {
        PSYCHOLOGY: 'Mange pour décompresser le soir. Fatigue.',
        PHYSICAL_ACTIVITY: 'Aucune activité physique depuis la grossesse.',
        WEIGHT_HISTORY: '+12 kg après la deuxième grossesse, jamais de régime.',
        AVERSIONS: 'Les endives, le céleri.',
      },
    },
    {
      daysAgo: 90,
      paymentMethod: PaymentMethod.CARD,
      weight: 79.5,
      habits: 'Petit-déjeuner pris presque tous les jours. Grignotage du soir toujours présent.',
      sessionWork: 'Travail sur les émotions et la fatigue du soir.',
      advice: 'Préparer une collation à 17 h pour arriver moins affamée le soir.',
      events: [{ daysAgo: 100, title: 'Reprise du travail', category: LifeEventCategory.WORK }],
    },
    {
      daysAgo: 60,
      paymentMethod: PaymentMethod.TRANSFER,
      weight: 79.8,
      habits: 'Période difficile, retour du grignotage.',
      sessionWork: 'Écoute, déculpabilisation.',
      advice: 'Ne pas culpabiliser, garder la structure des repas. Revoir dans 4 semaines.',
      events: [{ daysAgo: 68, title: 'Décès de sa grand-mère', category: LifeEventCategory.FAMILY }],
    },
    {
      daysAgo: 30,
      paymentMethod: PaymentMethod.CARD,
      weight: 76.4,
      measurements: { WAIST: 90 },
      habits: 'Reprise de la dynamique, grignotage en net recul.',
      sessionWork: 'Organisation des dîners en famille.',
      advice: 'Continuer le pilates. Introduire des légumes au dîner.',
      file: { PHYSICAL_ACTIVITY: 'Pilates une fois par semaine et marche le week-end.' },
    },
    {
      daysAgo: 7,
      paymentMethod: PaymentMethod.CASH,
      weight: 74.2,
      measurements: { WAIST: 87 },
      habits: 'Très bonne évolution, plus en énergie. Dîners équilibrés 4 soirs sur 7.',
      sessionWork: 'Consolidation, anticipation des fêtes.',
      advice: 'Maintenir. Prochain point dans 3 semaines.',
    },
  ]);

  await patient(PATIENT_IDS.thomas, {
    firstName: 'Thomas',
    lastName: 'Leroy',
    sex: Sex.M,
    dateOfBirth: new Date('1992-07-22'),
    email: 'thomas.leroy@example.com',
    phone: '06 98 76 54 32',
    city: 'Lyon',
    familySituation: 'Célibataire',
    profession: 'Kinésithérapeute',
    consultationReason: 'Sportif (trail), veut gagner en masse musculaire sans prendre de gras.',
    createdAt: at(-50),
  });
  await createFollowUp(PATIENT_IDS.thomas, pract.id, formulas, [
    {
      daysAgo: 45,
      paymentMethod: PaymentMethod.CARD,
      weight: 68,
      measurements: { HEIGHT: 180, BODY_FAT: 12, MUSCLE_MASS: 55.5 },
      habits: 'Végétarien. Environ 1 g de protéines par kg, 3 repas, pas de collation.',
      sessionWork: "Calcul des besoins selon le volume d'entraînement (8 h par semaine).",
      advice: "Augmenter les légumineuses et produits laitiers, collation dans l'heure après l'entraînement.",
      file: {
        PHYSICAL_ACTIVITY: 'Trail 4 fois par semaine, 8 h au total.',
        TASTES: 'Végétarien depuis 5 ans. Aime les currys, le houmous.',
      },
    },
    {
      daysAgo: 14,
      paymentMethod: PaymentMethod.CARD,
      weight: 69.5,
      measurements: { BODY_FAT: 12.2, MUSCLE_MASS: 56.8 },
      habits: 'Bonne adhésion, +1,5 kg. Fatigue en fin de semaine.',
      sessionWork: 'Répartition des glucides autour des sorties longues.',
      advice: 'Ajouter des féculents la veille des sorties longues.',
    },
  ]);

  await patient(PATIENT_IDS.claire, {
    firstName: 'Claire',
    lastName: 'Bernard',
    sex: Sex.F,
    dateOfBirth: new Date('1997-11-05'),
    email: 'claire.bernard@example.com',
    phone: '07 11 22 33 44',
    city: 'Paris',
    profession: 'Étudiante en master',
    consultationReason: 'Crises d’hyperphagie, anxiété autour de la nourriture.',
    createdAt: at(-120),
  });
  await createFollowUp(PATIENT_IDS.claire, pract.id, formulas, [
    {
      daysAgo: 110,
      paymentMethod: PaymentMethod.CHECK,
      weight: 71,
      measurements: { HEIGHT: 168 },
      habits: 'Crises 3 à 4 fois par semaine, le soir, souvent après une journée de restriction.',
      sessionWork: 'Bilan, mise en lien restriction et crises.',
      advice: 'Trois repas réguliers, ne pas sauter de repas. Carnet de sensations.',
      file: {
        ALLERGIES: 'Arachides (allergie sévère, stylo d’adrénaline).',
        PSYCHOLOGY: 'Anxiété forte, culpabilité après les crises.',
      },
    },
    {
      daysAgo: 85,
      paymentMethod: PaymentMethod.CHECK,
      weight: 70.5,
      habits: 'Crises moins fréquentes (2 par semaine).',
      sessionWork: 'Lecture du carnet de sensations.',
      advice: 'Continuer la régularité. Introduire une collation l’après-midi.',
      file: { PSYCHOLOGY: 'Anxiété forte. Suivi psychologique commencé, culpabilité en baisse.' },
      events: [{ daysAgo: 95, title: 'Début d’un suivi psychologique' }],
    },
    {
      daysAgo: 63,
      paymentMethod: PaymentMethod.NONE,
      weight: 70,
      habits: 'Stabilisation, une crise sur les 3 dernières semaines.',
      sessionWork: 'Manger en pleine conscience, sans écran.',
      advice: 'Revoir dans un mois.',
    },
  ]);

  await patient(PATIENT_IDS.emma, {
    firstName: 'Emma',
    lastName: 'Petit',
    sex: Sex.F,
    dateOfBirth: new Date('2010-02-14'),
    phone: '06 55 44 33 22',
    city: 'Versailles',
    familySituation: 'Vit avec ses parents, une sœur',
    profession: 'Collégienne',
    referralSource: 'Pédiatre',
    consultationReason: 'Adolescente, prise de poids rapide depuis un an. Vient avec sa mère.',
    createdAt: at(-3),
  });

  // Only his age is known: an estimated birth year is stored
  await patient(PATIENT_IDS.lucas, {
    firstName: 'Lucas',
    lastName: 'Moreau',
    sex: Sex.M,
    dateOfBirth: estimatedBirth(52),
    birthDateEstimated: true,
    email: 'lucas.moreau@example.com',
    city: 'Nanterre',
    profession: 'Chauffeur livreur',
    gpName: 'Dr Karim Benali',
    referralSource: 'Médecin traitant',
    consultationReason: 'Diabète de type 2 découvert il y a 6 mois, surpoids.',
    createdAt: at(-30),
  });
  await createFollowUp(PATIENT_IDS.lucas, pract.id, formulas, [
    {
      daysAgo: 21,
      paymentMethod: PaymentMethod.CARD,
      weight: 98,
      measurements: { HEIGHT: 175, WAIST: 112 },
      habits: '1 L de soda par jour, déjeuner sandwich ou fast-food dans le camion.',
      sessionWork: 'Bilan, explication de l’index glycémique.',
      advice: 'Remplacer le soda par de l’eau gazeuse. Ajouter des légumes au déjeuner.',
      file: {
        HEALTH: 'Diabète de type 2, metformine depuis 6 mois.',
        BLOOD_GLUCOSE: 'HbA1c 7,8 % (il y a 2 mois).',
        AVERSIONS: 'Pas de porc.',
      },
      events: [{ daysAgo: 180, title: 'Début de la metformine', category: LifeEventCategory.TREATMENT }],
    },
    {
      daysAgo: 0,
      paymentMethod: PaymentMethod.NONE,
      weight: 96.4,
      habits: 'Soda arrêté en semaine.',
      sessionWork: '',
      advice: '',
    },
  ]);
  console.log('✅ Patients and their files');

  // ── Upcoming appointments ───────────────────────────────────────────────────
  const upcoming = [
    { patientId: PATIENT_IDS.thomas, startAt: at(0, 14), type: AppointmentType.VIDEO, status: AppointmentStatus.CONFIRMED },
    { patientId: PATIENT_IDS.martine, startAt: at(21, 9), type: AppointmentType.IN_PERSON, status: AppointmentStatus.SCHEDULED },
    { patientId: PATIENT_IDS.marie, startAt: at(14, 9), type: AppointmentType.IN_PERSON, status: AppointmentStatus.SCHEDULED },
    { patientId: PATIENT_IDS.emma, startAt: at(1, 17), type: AppointmentType.IN_PERSON, status: AppointmentStatus.CONFIRMED, reason: 'Bilan' },
    { patientId: PATIENT_IDS.lucas, startAt: at(21, 11), type: AppointmentType.PHONE, status: AppointmentStatus.SCHEDULED },
  ];
  for (const a of upcoming) {
    await prisma.appointment.create({
      data: {
        ...a,
        practitionerId: pract.id,
        duration: 45,
        endAt: new Date(a.startAt.getTime() + 45 * 60 * 1000),
        reason: a.reason ?? 'Suivi',
      },
    });
  }
  console.log('✅ Upcoming appointments');

  // ── Invoices ────────────────────────────────────────────────────────────────
  await seedInvoices(pract.id);

  // ── Tasks ───────────────────────────────────────────────────────────────────
  const tasks = [
    { patientId: PATIENT_IDS.martine, title: 'Relire et envoyer le compte rendu au Dr Garnier', priority: TaskPriority.HIGH, dueAt: at(2) },
    { patientId: PATIENT_IDS.marie, title: 'Envoyer des idées de dîners rapides', priority: TaskPriority.MEDIUM, dueAt: at(3) },
    { patientId: PATIENT_IDS.lucas, title: 'Demander la dernière HbA1c au médecin', priority: TaskPriority.HIGH, dueAt: at(5) },
    { patientId: PATIENT_IDS.claire, title: 'Relancer pour un rendez-vous', priority: TaskPriority.HIGH, dueAt: at(-2) },
  ];
  for (const t of tasks) {
    await prisma.task.create({
      data: { ...t, createdById: pract.id, assignedToId: pract.id, status: TaskStatus.PENDING },
    });
  }

  // ── Consents ────────────────────────────────────────────────────────────────
  for (const id of Object.values(PATIENT_IDS)) {
    await prisma.consent.create({
      data: { patientId: id, type: 'health_data', version: '1.0', givenAt: at(-130), evidence: 'Formulaire signé au cabinet' },
    });
  }

  console.log(`
✅ Seed terminé

Comptes :
  admin@vp-dietetic.fr       / Admin1234!   (ADMIN)
  praticienne@vp-dietetic.fr / Pratic1234!  (PRATICIENNE)
  assistante@vp-dietetic.fr  / Assist1234!  (ASSISTANTE)

6 patients suivis par Valérie Perrot (formules Bilan 60 € et Suivi 50 €), dont Martine Roux,
le cas de test des calculs (femme, 56 ans, 1,59 m, 79 → 78,2 → 76,5 kg).
Séances passées facturées (sauf les deux dernières), une facture corrigée par un avoir.
  `);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
