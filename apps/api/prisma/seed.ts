import {
  AppointmentStatus,
  AppointmentType,
  DocumentType,
  NoteStatus,
  NoteType,
  PatientStatus,
  PrismaClient,
  TaskPriority,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Users ───────────────────────────────────────────────────────────────────

  const adminPassword = await bcrypt.hash('Admin1234!', 12);
  const practPassword = await bcrypt.hash('Pratic1234!', 12);
  const assistPassword = await bcrypt.hash('Assist1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@vp-dietetic.fr' },
    update: {},
    create: {
      email: 'admin@vp-dietetic.fr',
      passwordHash: adminPassword,
      firstName: 'Paul',
      lastName: 'Administrateur',
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  const praticienne = await prisma.user.upsert({
    where: { email: 'praticienne@vp-dietetic.fr' },
    update: {},
    create: {
      email: 'praticienne@vp-dietetic.fr',
      passwordHash: practPassword,
      firstName: 'Valérie',
      lastName: 'Perrot',
      role: UserRole.PRATICIENNE,
      isActive: true,
    },
  });

  const assistante = await prisma.user.upsert({
    where: { email: 'assistante@vp-dietetic.fr' },
    update: {},
    create: {
      email: 'assistante@vp-dietetic.fr',
      passwordHash: assistPassword,
      firstName: 'Sophie',
      lastName: 'Martin',
      role: UserRole.ASSISTANTE,
      isActive: true,
    },
  });

  console.log('✅ Users created');

  // ── Tags ────────────────────────────────────────────────────────────────────

  const tagData = [
    { name: 'TCA', color: '#ef4444' },
    { name: 'Diabète', color: '#f97316' },
    { name: 'Végétarien', color: '#22c55e' },
    { name: 'Vegan', color: '#16a34a' },
    { name: 'Grossesse', color: '#ec4899' },
    { name: 'Sportif', color: '#3b82f6' },
    { name: 'Surpoids', color: '#a855f7' },
    { name: 'Anxiété alimentaire', color: '#f59e0b' },
    { name: 'Suivi long terme', color: '#6366f1' },
    { name: 'Adolescent', color: '#14b8a6' },
  ];

  const tags: Record<string, { id: string; name: string; color: string }> = {};
  for (const tag of tagData) {
    const created = await prisma.tag.upsert({
      where: { name: tag.name },
      update: {},
      create: tag,
    });
    tags[tag.name] = created;
  }

  console.log('✅ Tags created');

  // ── Patients ─────────────────────────────────────────────────────────────────

  const patient1 = await prisma.patient.upsert({
    where: { id: 'patient-seed-001' },
    update: {},
    create: {
      id: 'patient-seed-001',
      practitionerId: praticienne.id,
      firstName: 'Marie',
      lastName: 'Dubois',
      dateOfBirth: new Date('1985-03-15'),
      email: 'marie.dubois@example.com',
      phone: '06 12 34 56 78',
      address: '12 rue des Lilas',
      city: 'Paris',
      zipCode: '75011',
      status: PatientStatus.ACTIVE,
      emergencyContactName: 'Pierre Dubois',
      emergencyContactPhone: '06 98 76 54 32',
      emergencyContactRelationship: 'Époux',
      privateNote:
        'Patiente suivie depuis 2 ans. Bons progrès sur la relation à l'alimentation. Anxiété résiduelle le soir.',
      tags: {
        create: [
          { tag: { connect: { id: tags['TCA'].id } } },
          { tag: { connect: { id: tags['Anxiété alimentaire'].id } } },
          { tag: { connect: { id: tags['Suivi long terme'].id } } },
        ],
      },
    },
  });

  const patient2 = await prisma.patient.upsert({
    where: { id: 'patient-seed-002' },
    update: {},
    create: {
      id: 'patient-seed-002',
      practitionerId: praticienne.id,
      firstName: 'Thomas',
      lastName: 'Leroy',
      dateOfBirth: new Date('1990-07-22'),
      email: 'thomas.leroy@example.com',
      phone: '07 65 43 21 09',
      address: '5 avenue Gambetta',
      city: 'Lyon',
      zipCode: '69003',
      status: PatientStatus.ACTIVE,
      tags: {
        create: [
          { tag: { connect: { id: tags['Sportif'].id } } },
          { tag: { connect: { id: tags['Végétarien'].id } } },
        ],
      },
    },
  });

  const patient3 = await prisma.patient.upsert({
    where: { id: 'patient-seed-003' },
    update: {},
    create: {
      id: 'patient-seed-003',
      practitionerId: praticienne.id,
      firstName: 'Claire',
      lastName: 'Bernard',
      dateOfBirth: new Date('1978-11-08'),
      email: 'claire.bernard@example.com',
      phone: '06 55 44 33 22',
      address: '8 rue du Moulin',
      city: 'Bordeaux',
      zipCode: '33000',
      status: PatientStatus.ACTIVE,
      tags: {
        create: [
          { tag: { connect: { id: tags['Diabète'].id } } },
          { tag: { connect: { id: tags['Surpoids'].id } } },
        ],
      },
    },
  });

  const patient4 = await prisma.patient.upsert({
    where: { id: 'patient-seed-004' },
    update: {},
    create: {
      id: 'patient-seed-004',
      practitionerId: praticienne.id,
      firstName: 'Emma',
      lastName: 'Petit',
      dateOfBirth: new Date('2006-04-30'),
      email: 'emma.petit@example.com',
      phone: '06 11 22 33 44',
      status: PatientStatus.ACTIVE,
      tags: {
        create: [
          { tag: { connect: { id: tags['Adolescent'].id } } },
          { tag: { connect: { id: tags['TCA'].id } } },
        ],
      },
    },
  });

  const patient5 = await prisma.patient.upsert({
    where: { id: 'patient-seed-005' },
    update: {},
    create: {
      id: 'patient-seed-005',
      practitionerId: praticienne.id,
      firstName: 'Lucas',
      lastName: 'Moreau',
      dateOfBirth: new Date('1995-09-14'),
      email: 'lucas.moreau@example.com',
      phone: '07 88 77 66 55',
      status: PatientStatus.INACTIVE,
      tags: {
        create: [{ tag: { connect: { id: tags['Surpoids'].id } } }],
      },
    },
  });

  console.log('✅ Patients created');

  // ── Nutritional Profiles ────────────────────────────────────────────────────

  await prisma.nutritionalProfile.upsert({
    where: { patientId: patient1.id },
    update: {},
    create: {
      patientId: patient1.id,
      objectives: 'Réconciliation avec l'alimentation, réduction des crises de compulsion',
      dietaryHabits: 'Saute des repas le matin. Dîner tardif. Grignote en soirée.',
      foodRelationship: 'Relation conflictuelle depuis l'adolescence. Alimentation = récompense/punition.',
      emotionalTriggers: 'Stress professionnel (chef de projet). Conflits familiaux. Ennui.',
      allergies: 'Aucune connue',
      intolerances: 'Légère intolérance au lactose',
      supplements: 'Magnésium bisglycinate 300mg/soir',
      activityLevel: 'Sédentaire - marche 20min/jour',
      stressLevel: 'Élevé',
    },
  });

  await prisma.nutritionalProfile.upsert({
    where: { patientId: patient2.id },
    update: {},
    create: {
      patientId: patient2.id,
      objectives: 'Optimiser les apports protéiques pour la musculation tout en restant végétarien',
      dietaryHabits: '3 repas structurés + collation post-entraînement. Cuisine beaucoup.',
      foodRelationship: 'Positive. Mange avec plaisir.',
      allergies: 'Fruits à coque',
      intolerances: 'Aucune',
      supplements: 'Protéines de pois 30g/jour, Vitamine B12, Oméga-3 végétaux',
      activityLevel: 'Très actif - musculation 4x/semaine + vélo',
      stressLevel: 'Faible',
    },
  });

  console.log('✅ Nutritional profiles created');

  // ── Appointments ─────────────────────────────────────────────────────────────

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const appt1 = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      practitionerId: praticienne.id,
      startAt: new Date(today.getTime() + 9 * 3600 * 1000),
      endAt: new Date(today.getTime() + 10 * 3600 * 1000),
      duration: 60,
      type: AppointmentType.IN_PERSON,
      status: AppointmentStatus.CONFIRMED,
      reason: 'Séance de suivi mensuel',
      preNotes: 'Revoir les objectifs du mois dernier. Point sur les épisodes de compulsion.',
    },
  });

  const appt2 = await prisma.appointment.create({
    data: {
      patientId: patient2.id,
      practitionerId: praticienne.id,
      startAt: new Date(today.getTime() + 14 * 3600 * 1000),
      endAt: new Date(today.getTime() + 14.75 * 3600 * 1000),
      duration: 45,
      type: AppointmentType.VIDEO,
      status: AppointmentStatus.SCHEDULED,
      reason: 'Consultation nutritionnelle sportif',
    },
  });

  const appt3 = await prisma.appointment.create({
    data: {
      patientId: patient3.id,
      practitionerId: praticienne.id,
      startAt: new Date(today.getTime() + 24 * 3600 * 1000 + 10 * 3600 * 1000),
      endAt: new Date(today.getTime() + 24 * 3600 * 1000 + 11 * 3600 * 1000),
      duration: 60,
      type: AppointmentType.IN_PERSON,
      status: AppointmentStatus.SCHEDULED,
      reason: 'Suivi diabète et poids',
    },
  });

  // Past appointment with notes
  const apptPast = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      practitionerId: praticienne.id,
      startAt: new Date(today.getTime() - 30 * 24 * 3600 * 1000 + 9 * 3600 * 1000),
      endAt: new Date(today.getTime() - 30 * 24 * 3600 * 1000 + 10 * 3600 * 1000),
      duration: 60,
      type: AppointmentType.IN_PERSON,
      status: AppointmentStatus.COMPLETED,
      reason: 'Séance initiale de bilan',
      postNotes: 'Bonne première séance. Patiente motivée et honnête sur ses difficultés. Objectif prioritaire : régulariser le petit-déjeuner.',
    },
  });

  console.log('✅ Appointments created');

  // ── Clinical Notes ────────────────────────────────────────────────────────────

  await prisma.clinicalNote.create({
    data: {
      patientId: patient1.id,
      appointmentId: apptPast.id,
      authorId: praticienne.id,
      type: NoteType.STRUCTURED,
      status: NoteStatus.FINALIZED,
      title: 'Bilan initial — Marie Dubois',
      content:
        'Première consultation. Marie consulte suite à des épisodes de compulsion alimentaire répétés depuis 6 mois, aggravés par un changement de poste professionnel stressant.',
      sessionObjectives:
        '1. Comprendre le contexte et l'historique alimentaire\n2. Établir un bilan de la relation à la nourriture\n3. Identifier les déclencheurs principaux',
      actionPlan:
        '- Tenir un journal alimentaire + émotionnel pendant 2 semaines\n- Réintroduire le petit-déjeuner (même minimal)\n- Pratiquer 5min de cohérence cardiaque avant les repas stressants',
      followUpItems:
        '- Vérifier l'adhérence au journal au prochain RDV\n- Évaluer l'impact de la cohérence cardiaque',
      observations: 'Patiente ouverte et perspicace. Bonne alliance thérapeutique établie dès le départ.',
      finalizedAt: new Date(today.getTime() - 29 * 24 * 3600 * 1000),
    },
  });

  await prisma.clinicalNote.create({
    data: {
      patientId: patient1.id,
      authorId: praticienne.id,
      type: NoteType.FREE,
      status: NoteStatus.DRAFT,
      title: 'Note préparatoire — séance du jour',
      content:
        'Marie a envoyé un message la semaine dernière indiquant une période difficile avec 3 épisodes de compulsion en 10 jours. Préparer des outils concrets pour mieux gérer les crises nocturnes.',
    },
  });

  await prisma.clinicalNote.create({
    data: {
      patientId: patient2.id,
      authorId: praticienne.id,
      type: NoteType.STRUCTURED,
      status: NoteStatus.FINALIZED,
      title: 'Bilan nutritionnel sportif — Thomas Leroy',
      content:
        'Thomas est végétarien depuis 3 ans, pratique la musculation intensivement. Se plaint de stagnation musculaire malgré l'entraînement.',
      sessionObjectives:
        '1. Évaluer les apports protéiques actuels\n2. Identifier les lacunes nutritionnelles potentielles',
      actionPlan:
        '- Augmenter les protéines à 1,8g/kg/jour (objectif : 140g/jour)\n- Sources recommandées : tofu, seitan, légumineuses, œufs\n- Supplémenter en Zinc et Créatine',
      finalizedAt: new Date(today.getTime() - 15 * 24 * 3600 * 1000),
    },
  });

  console.log('✅ Clinical notes created');

  // ── Nutritional Entries ───────────────────────────────────────────────────────

  const entries = [];
  for (let i = 14; i >= 0; i--) {
    const entryDate = new Date(today.getTime() - i * 24 * 3600 * 1000);
    entries.push({
      patientId: patient1.id,
      date: entryDate,
      mood: Math.floor(Math.random() * 4) + 4, // 4-7
      energyLevel: Math.floor(Math.random() * 4) + 3,
      stressLevel: Math.floor(Math.random() * 5) + 5,
      sleepHours: parseFloat((Math.random() * 3 + 5.5).toFixed(1)),
      sleepQuality: Math.floor(Math.random() * 3) + 5,
      physicalActivity: i % 3 === 0 ? 'Marche 25min' : null,
      waterIntake: parseFloat((Math.random() * 1 + 1.2).toFixed(2)),
      mealNotes: i % 4 === 0 ? 'Episode de compulsion en soirée' : 'Repas structurés respectés',
    });
  }

  await prisma.nutritionalEntry.createMany({ data: entries, skipDuplicates: true });

  console.log('✅ Nutritional entries created');

  // ── Tasks ─────────────────────────────────────────────────────────────────────

  await prisma.task.createMany({
    data: [
      {
        title: 'Envoyer le plan alimentaire personnalisé',
        description: 'Préparer et envoyer le plan sur 4 semaines suite au bilan de Marie.',
        patientId: patient1.id,
        createdById: praticienne.id,
        assignedToId: praticienne.id,
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        dueAt: new Date(today.getTime() + 2 * 24 * 3600 * 1000),
      },
      {
        title: 'Appeler pour confirmer le prochain RDV',
        description: 'Claire Bernard n'a pas répondu au rappel email.',
        patientId: patient3.id,
        createdById: praticienne.id,
        assignedToId: assistante.id,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueAt: new Date(today.getTime() + 1 * 24 * 3600 * 1000),
      },
      {
        title: 'Finaliser la note de séance',
        patientId: patient1.id,
        appointmentId: appt1.id,
        createdById: praticienne.id,
        assignedToId: praticienne.id,
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueAt: new Date(today.getTime() + 24 * 3600 * 1000),
      },
      {
        title: 'Vérifier les résultats d'analyse sanguine',
        description: 'Thomas a promis d'envoyer ses résultats avant la séance.',
        patientId: patient2.id,
        createdById: praticienne.id,
        assignedToId: praticienne.id,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        dueAt: new Date(today.getTime() + 14 * 3600 * 1000),
      },
      {
        title: 'Renouveler stock de formulaires de consentement',
        createdById: praticienne.id,
        assignedToId: assistante.id,
        status: TaskStatus.DONE,
        priority: TaskPriority.LOW,
        completedAt: new Date(today.getTime() - 3 * 24 * 3600 * 1000),
      },
    ],
  });

  console.log('✅ Tasks created');

  // ── Consents ──────────────────────────────────────────────────────────────────

  await prisma.consent.createMany({
    data: [
      {
        patientId: patient1.id,
        type: 'data_processing',
        version: '1.0',
        givenAt: new Date(today.getTime() - 365 * 24 * 3600 * 1000),
        evidence: 'Formulaire papier signé — archivé cabinet',
      },
      {
        patientId: patient1.id,
        type: 'health_data',
        version: '1.0',
        givenAt: new Date(today.getTime() - 365 * 24 * 3600 * 1000),
        evidence: 'Formulaire papier signé — archivé cabinet',
      },
      {
        patientId: patient2.id,
        type: 'data_processing',
        version: '1.0',
        givenAt: new Date(today.getTime() - 180 * 24 * 3600 * 1000),
        evidence: 'Signature électronique via application',
      },
      {
        patientId: patient2.id,
        type: 'health_data',
        version: '1.0',
        givenAt: new Date(today.getTime() - 180 * 24 * 3600 * 1000),
        evidence: 'Signature électronique via application',
      },
    ],
  });

  console.log('✅ Consents created');

  console.log(`
✅ Seed terminé avec succès !

Comptes disponibles :
  admin@vp-dietetic.fr       / Admin1234!   (ADMIN)
  praticienne@vp-dietetic.fr / Pratic1234!  (PRATICIENNE)
  assistante@vp-dietetic.fr  / Assist1234!  (ASSISTANTE)

Données de démonstration :
  - 5 patients (dont 4 actifs, 1 inactif)
  - 10 tags
  - ${entries.length} entrées nutritionnelles (14 jours)
  - 4 rendez-vous (2 aujourd'hui, 1 demain, 1 passé)
  - 3 notes cliniques (2 finalisées, 1 brouillon)
  - 5 tâches
  - 4 consentements RGPD
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
