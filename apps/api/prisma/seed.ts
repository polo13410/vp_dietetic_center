/*
 * Local demo data: three accounts and five patients followed by the practitioner, with
 * realistic histories (sessions, measurements, topic notes, life events, goals).
 * Dates are relative to today, so the dashboard always has something to show.
 * Re-running the seed rebuilds the demo patients from scratch.
 */
import {
  AppointmentStatus,
  AppointmentType,
  ConsultationStatus,
  GoalStatus,
  LifeEventCategory,
  MetricType,
  PatientStatus,
  PatientTopic,
  PrismaClient,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

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

// Fixed ids so the seed can be re-run
const PATIENT_IDS = {
  marie: '0b6f3d4e-1c55-4a7e-9d1a-000000000001',
  thomas: '0b6f3d4e-1c55-4a7e-9d1a-000000000002',
  claire: '0b6f3d4e-1c55-4a7e-9d1a-000000000003',
  emma: '0b6f3d4e-1c55-4a7e-9d1a-000000000004',
  lucas: '0b6f3d4e-1c55-4a7e-9d1a-000000000005',
};

type SessionSeed = {
  daysAgo: number;
  summary: string;
  advice: string;
  draft?: boolean;
  measurements?: Partial<Record<MetricType, number>>;
  topics?: Partial<Record<PatientTopic, string>>;
  events?: { daysAgo: number; title: string; category: LifeEventCategory; description?: string }[];
  newGoals?: string[];
  reviews?: Record<string, { status: GoalStatus; comment?: string }>;
};

async function upsertUser(email: string, password: string, data: { firstName: string; lastName: string; role: UserRole }) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash: await bcrypt.hash(password, 12), isActive: true, ...data },
  });
}

/** Removes the demo patients and everything attached to them. */
async function resetDemoPatients() {
  const patientId = { in: Object.values(PATIENT_IDS) };
  await prisma.$transaction([
    prisma.goalReview.deleteMany({ where: { goal: { patientId } } }),
    prisma.goal.deleteMany({ where: { patientId } }),
    prisma.measurement.deleteMany({ where: { patientId } }),
    prisma.topicNote.deleteMany({ where: { patientId } }),
    prisma.lifeEvent.deleteMany({ where: { patientId } }),
    prisma.consultation.deleteMany({ where: { patientId } }),
    prisma.task.deleteMany({ where: { patientId } }),
    prisma.document.deleteMany({ where: { patientId } }),
    prisma.appointment.deleteMany({ where: { patientId } }),
    prisma.consent.deleteMany({ where: { patientId } }),
    prisma.patientTag.deleteMany({ where: { patientId } }),
    prisma.patient.deleteMany({ where: { id: patientId } }),
  ]);
}

/**
 * Creates a past appointment and its session with everything recorded during it.
 * Goals are referred to by title so later sessions can review them.
 */
async function createSession(
  patientId: string,
  practitionerId: string,
  goals: Map<string, string>,
  s: SessionSeed,
) {
  const date = at(-s.daysAgo, 10);
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      practitionerId,
      startAt: date,
      endAt: new Date(date.getTime() + 45 * 60 * 1000),
      duration: 45,
      type: AppointmentType.IN_PERSON,
      status: s.draft ? AppointmentStatus.CONFIRMED : AppointmentStatus.COMPLETED,
      reason: 'Suivi',
    },
  });
  const session = await prisma.consultation.create({
    data: {
      patientId,
      practitionerId,
      appointmentId: appointment.id,
      date,
      summary: s.summary,
      advice: s.advice,
      status: s.draft ? ConsultationStatus.DRAFT : ConsultationStatus.FINALIZED,
      finalizedAt: s.draft ? null : new Date(date.getTime() + 50 * 60 * 1000),
    },
  });
  const consultationId = session.id;

  for (const [type, value] of Object.entries(s.measurements ?? {})) {
    await prisma.measurement.create({
      data: { patientId, consultationId, type: type as MetricType, value, measuredAt: date },
    });
  }
  for (const [topic, content] of Object.entries(s.topics ?? {})) {
    await prisma.topicNote.create({
      data: { patientId, consultationId, topic: topic as PatientTopic, content, createdAt: date },
    });
  }
  for (const e of s.events ?? []) {
    await prisma.lifeEvent.create({
      data: { patientId, consultationId, date: at(-e.daysAgo), title: e.title, category: e.category, description: e.description },
    });
  }
  for (const [title, review] of Object.entries(s.reviews ?? {})) {
    const goalId = goals.get(title)!;
    await prisma.goalReview.create({
      data: { goalId, consultationId, status: review.status, comment: review.comment, createdAt: date },
    });
    const closed = review.status === GoalStatus.ACHIEVED || review.status === GoalStatus.ABANDONED;
    await prisma.goal.update({
      where: { id: goalId },
      data: { status: review.status, closedAt: closed ? date : null },
    });
  }
  for (const title of s.newGoals ?? []) {
    const goal = await prisma.goal.create({
      data: { patientId, consultationId, title, createdAt: date },
    });
    goals.set(title, goal.id);
  }
}

async function createPatientHistory(patientId: string, practitionerId: string, sessions: SessionSeed[]) {
  const goals = new Map<string, string>();
  for (const s of [...sessions].sort((a, b) => b.daysAgo - a.daysAgo)) {
    await createSession(patientId, practitionerId, goals, s);
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
  });
  await upsertUser('assistante@vp-dietetic.fr', 'Assist1234!', {
    firstName: 'Sophie',
    lastName: 'Martin',
    role: UserRole.ASSISTANTE,
  });
  console.log('✅ Users');

  // ── Tags ────────────────────────────────────────────────────────────────────
  const tagData = [
    { name: 'TCA', color: '#ef4444' },
    { name: 'Diabète', color: '#f97316' },
    { name: 'Végétarien', color: '#22c55e' },
    { name: 'Grossesse', color: '#ec4899' },
    { name: 'Sportif', color: '#3b82f6' },
    { name: 'Anxiété alimentaire', color: '#f59e0b' },
    { name: 'Suivi long terme', color: '#6366f1' },
    { name: 'Adolescent', color: '#14b8a6' },
  ];
  const tags: Record<string, string> = {};
  for (const tag of tagData) {
    tags[tag.name] = (await prisma.tag.upsert({ where: { name: tag.name }, update: {}, create: tag })).id;
  }
  console.log('✅ Tags');

  // ── Patients ────────────────────────────────────────────────────────────────
  await resetDemoPatients();
  const patient = (id: string, data: Record<string, unknown>, tagNames: string[]) =>
    prisma.patient.create({
      data: {
        id,
        practitionerId: pract.id,
        status: PatientStatus.ACTIVE,
        ...(data as any),
        tags: { create: tagNames.map((name) => ({ tag: { connect: { id: tags[name] } } })) },
      },
    });

  await patient(
    PATIENT_IDS.marie,
    {
      firstName: 'Marie',
      lastName: 'Dubois',
      dateOfBirth: new Date('1985-03-15'),
      email: 'marie.dubois@example.com',
      phone: '06 12 34 56 78',
      city: 'Paris',
      zipCode: '75011',
      referralSource: 'Médecin traitant',
      consultationReason:
        'Perte de poids après sa deuxième grossesse (+12 kg), fatigue, grignotage le soir.',
      createdAt: at(-130),
    },
    ['Suivi long terme'],
  );
  await createPatientHistory(PATIENT_IDS.marie, pract.id, [
    {
      daysAgo: 120,
      summary:
        "Premier rendez-vous. Marie saute le petit-déjeuner, grignote en rentrant du travail et le soir après le coucher des enfants. Fatiguée, dort 6 h.",
      advice: 'Introduire un petit-déjeuner simple. Noter les grignotages pendant 2 semaines.',
      measurements: { HEIGHT: 165, WEIGHT: 82, WAIST: 96, ENERGY: 4, SLEEP_QUALITY: 5, STRESS: 7 },
      topics: {
        EATING: 'Saute le petit-déjeuner. Déjeuner à la cantine. Grignotage sucré le soir (biscuits).',
        ACTIVITY: 'Aucune activité physique depuis la grossesse.',
        SLEEP: 'Environ 6 h par nuit, réveils nocturnes (bébé).',
        EMOTIONS: 'Mange pour décompresser le soir.',
      },
      newGoals: ['Prendre un petit-déjeuner chaque matin', 'Marcher 30 min, 3 fois par semaine'],
    },
    {
      daysAgo: 90,
      summary: 'Petit-déjeuner pris presque tous les jours. Grignotage du soir toujours présent.',
      advice: 'Préparer une collation à 17 h pour arriver moins affamée le soir.',
      measurements: { WEIGHT: 79.5, WAIST: 94, ENERGY: 5, SLEEP_QUALITY: 5, STRESS: 6 },
      topics: { EATING: 'Petit-déjeuner 6 jours sur 7 (pain complet, fromage blanc). Grignotage le soir 4 fois par semaine.' },
      events: [{ daysAgo: 100, title: 'Reprise du travail', category: LifeEventCategory.WORK }],
      reviews: {
        'Prendre un petit-déjeuner chaque matin': { status: GoalStatus.ACHIEVED },
        'Marcher 30 min, 3 fois par semaine': { status: GoalStatus.PARTIAL, comment: '1 à 2 fois par semaine' },
      },
      newGoals: ['Remplacer le grignotage du soir par une tisane'],
    },
    {
      daysAgo: 60,
      summary: 'Période difficile : décès de sa grand-mère. Le poids stagne, retour du grignotage.',
      advice: "Ne pas culpabiliser, garder la structure des repas. Revoir dans 4 semaines.",
      measurements: { WEIGHT: 79.8, ENERGY: 3, SLEEP_QUALITY: 4, STRESS: 9 },
      topics: { EMOTIONS: 'Deuil récent, mange davantage pour se réconforter.' },
      events: [
        {
          daysAgo: 68,
          title: 'Décès de sa grand-mère',
          category: LifeEventCategory.FAMILY,
          description: 'Très proche, impact émotionnel important.',
        },
      ],
      reviews: {
        'Marcher 30 min, 3 fois par semaine': { status: GoalStatus.PARTIAL },
        'Remplacer le grignotage du soir par une tisane': { status: GoalStatus.IN_PROGRESS },
      },
    },
    {
      daysAgo: 30,
      summary: 'Reprise de la dynamique, inscription à un cours de pilates. Grignotage en net recul.',
      advice: 'Continuer le pilates. Introduire des légumes au dîner.',
      measurements: { WEIGHT: 76.4, WAIST: 90, ENERGY: 6, SLEEP_QUALITY: 6, STRESS: 5 },
      topics: {
        ACTIVITY: 'Pilates 1 fois par semaine + marche le week-end.',
        EATING: 'Plus de grignotage que 1 à 2 fois par semaine.',
      },
      reviews: {
        'Marcher 30 min, 3 fois par semaine': { status: GoalStatus.ACHIEVED, comment: 'Remplacé par pilates + marche' },
        'Remplacer le grignotage du soir par une tisane': { status: GoalStatus.PARTIAL },
      },
      newGoals: ['Des légumes à chaque dîner'],
    },
    {
      daysAgo: 7,
      summary: 'Très bonne évolution, Marie se sent plus en énergie. Dîners équilibrés.',
      advice: 'Maintenir. Prochain point dans 3 semaines.',
      measurements: { WEIGHT: 74.2, WAIST: 87, ENERGY: 7, SLEEP_QUALITY: 7, STRESS: 4 },
      topics: { SLEEP: 'Dort mieux, 7 h, le bébé fait ses nuits.' },
      reviews: {
        'Remplacer le grignotage du soir par une tisane': { status: GoalStatus.ACHIEVED },
        'Des légumes à chaque dîner': { status: GoalStatus.PARTIAL, comment: '4 soirs sur 7' },
      },
    },
  ]);

  await patient(
    PATIENT_IDS.thomas,
    {
      firstName: 'Thomas',
      lastName: 'Leroy',
      dateOfBirth: new Date('1992-07-22'),
      email: 'thomas.leroy@example.com',
      phone: '06 98 76 54 32',
      city: 'Lyon',
      consultationReason: 'Sportif (trail), veut gagner en masse musculaire sans prendre de gras.',
      dietaryRestrictions: 'Végétarien',
      createdAt: at(-50),
    },
    ['Sportif', 'Végétarien'],
  );
  await createPatientHistory(PATIENT_IDS.thomas, pract.id, [
    {
      daysAgo: 45,
      summary: 'Apports en protéines insuffisants pour son volume d’entraînement (8 h/semaine).',
      advice: 'Augmenter les légumineuses et produits laitiers, collation après l’entraînement.',
      measurements: { HEIGHT: 180, WEIGHT: 68, BODY_FAT: 12, MUSCLE_MASS: 55.5, ENERGY: 6 },
      topics: {
        EATING: 'Végétarien. Environ 1 g de protéines par kg, 3 repas, pas de collation.',
        ACTIVITY: 'Trail 4 fois par semaine, 8 h au total.',
      },
      newGoals: ['Atteindre 1,6 g de protéines par kg', "Collation dans l'heure après l'entraînement"],
    },
    {
      daysAgo: 14,
      summary: 'Bonne adhésion, +1,5 kg. Fatigue en fin de semaine.',
      advice: 'Ajouter des féculents la veille des sorties longues.',
      measurements: { WEIGHT: 69.5, BODY_FAT: 12.2, MUSCLE_MASS: 56.8, ENERGY: 7 },
      reviews: {
        'Atteindre 1,6 g de protéines par kg': { status: GoalStatus.PARTIAL, comment: '1,4 g/kg' },
        "Collation dans l'heure après l'entraînement": { status: GoalStatus.ACHIEVED },
      },
    },
  ]);

  await patient(
    PATIENT_IDS.claire,
    {
      firstName: 'Claire',
      lastName: 'Bernard',
      dateOfBirth: new Date('1997-11-05'),
      email: 'claire.bernard@example.com',
      phone: '07 11 22 33 44',
      city: 'Paris',
      consultationReason: 'Crises d’hyperphagie, anxiété autour de la nourriture.',
      allergies: 'Arachides (allergie sévère)',
      createdAt: at(-120),
    },
    ['TCA', 'Anxiété alimentaire'],
  );
  await createPatientHistory(PATIENT_IDS.claire, pract.id, [
    {
      daysAgo: 110,
      summary: 'Crises 3 à 4 fois par semaine, le soir, souvent après une journée de restriction.',
      advice: 'Trois repas réguliers, ne pas sauter de repas. Carnet de sensations.',
      measurements: { HEIGHT: 168, WEIGHT: 71, HUNGER: 8, STRESS: 8 },
      topics: {
        EATING: 'Restriction la journée, crises le soir.',
        EMOTIONS: 'Anxiété forte, culpabilité après les crises.',
      },
      newGoals: ['Trois repas par jour, sans en sauter'],
    },
    {
      daysAgo: 85,
      summary: 'Crises moins fréquentes (2 par semaine). Suivi psychologique commencé.',
      advice: 'Continuer la régularité. Introduire une collation l’après-midi.',
      measurements: { WEIGHT: 70.5, HUNGER: 6, STRESS: 7 },
      events: [{ daysAgo: 95, title: 'Début d’un suivi psychologique', category: LifeEventCategory.HEALTH }],
      reviews: { 'Trois repas par jour, sans en sauter': { status: GoalStatus.PARTIAL } },
    },
    {
      daysAgo: 63,
      summary: 'Stabilisation, 1 crise sur les 3 dernières semaines.',
      advice: 'Revoir dans un mois.',
      measurements: { WEIGHT: 70, HUNGER: 5, STRESS: 5 },
      reviews: { 'Trois repas par jour, sans en sauter': { status: GoalStatus.ACHIEVED } },
      newGoals: ['Manger sans écran au dîner'],
    },
  ]);

  await patient(
    PATIENT_IDS.emma,
    {
      firstName: 'Emma',
      lastName: 'Petit',
      dateOfBirth: new Date('2010-02-14'),
      phone: '06 55 44 33 22',
      city: 'Versailles',
      referralSource: 'Pédiatre',
      consultationReason: 'Adolescente, prise de poids rapide depuis un an. Vient avec sa mère.',
      emergencyContactName: 'Sophie Petit',
      emergencyContactPhone: '06 55 44 33 21',
      emergencyContactRelationship: 'Mère',
      createdAt: at(-3),
    },
    ['Adolescent'],
  );

  await patient(
    PATIENT_IDS.lucas,
    {
      firstName: 'Lucas',
      lastName: 'Moreau',
      dateOfBirth: new Date('1974-09-30'),
      email: 'lucas.moreau@example.com',
      city: 'Nanterre',
      consultationReason: 'Diabète de type 2 découvert il y a 6 mois, surpoids. Adressé par son médecin.',
      dietaryRestrictions: 'Pas de porc',
      createdAt: at(-30),
    },
    ['Diabète'],
  );
  await createPatientHistory(PATIENT_IDS.lucas, pract.id, [
    {
      daysAgo: 21,
      summary: 'Premier rendez-vous. Boissons sucrées (1 L de soda par jour), repas rapides au travail.',
      advice: 'Remplacer le soda par de l’eau gazeuse. Ajouter des légumes au déjeuner.',
      measurements: { HEIGHT: 175, WEIGHT: 98, WAIST: 112, ENERGY: 5 },
      topics: {
        EATING: '1 L de soda par jour, déjeuner sandwich ou fast-food.',
        HEALTH: 'Diabète de type 2 (HbA1c 7,8 %), metformine depuis 6 mois.',
      },
      events: [
        { daysAgo: 180, title: 'Début de la metformine', category: LifeEventCategory.TREATMENT },
      ],
      newGoals: ['Plus de soda en semaine'],
    },
    {
      daysAgo: 0,
      draft: true,
      summary: 'Soda arrêté en semaine. ',
      advice: '',
      measurements: { WEIGHT: 96.4 },
    },
  ]);
  console.log('✅ Patients and their files');

  // ── Upcoming appointments ───────────────────────────────────────────────────
  const upcoming = [
    { patientId: PATIENT_IDS.thomas, startAt: at(0, 14), type: AppointmentType.VIDEO, status: AppointmentStatus.CONFIRMED },
    { patientId: PATIENT_IDS.marie, startAt: at(14, 9), type: AppointmentType.IN_PERSON, status: AppointmentStatus.SCHEDULED },
    { patientId: PATIENT_IDS.emma, startAt: at(1, 17), type: AppointmentType.IN_PERSON, status: AppointmentStatus.CONFIRMED, reason: 'Premier rendez-vous' },
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

  // ── Tasks ───────────────────────────────────────────────────────────────────
  const tasks = [
    { patientId: PATIENT_IDS.marie, title: 'Envoyer des idées de dîners rapides', priority: TaskPriority.MEDIUM, dueAt: at(3) },
    { patientId: PATIENT_IDS.lucas, title: 'Demander la dernière HbA1c au médecin', priority: TaskPriority.HIGH, dueAt: at(5) },
    { patientId: PATIENT_IDS.claire, title: 'Relancer pour un rendez-vous', priority: TaskPriority.HIGH, dueAt: at(-2) },
    { patientId: PATIENT_IDS.thomas, title: 'Plan de repas pour le trail du mois prochain', priority: TaskPriority.LOW, dueAt: at(20) },
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

5 patients suivis par Valérie Perrot, avec séances, mesures, thématiques, événements et objectifs.
  `);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
