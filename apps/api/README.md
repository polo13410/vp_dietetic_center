# VP Dietetic Center — API

Backend NestJS de l'application : dossier patient, séances, factures, rendez-vous. Voir [docs/PLAN.md](../../docs/PLAN.md).

## Stack

- Node.js 24 + NestJS 11 + TypeScript
- PostgreSQL 15 + Prisma 6
- JWT (access + refresh token httpOnly)
- Swagger UI : http://localhost:3000/api/docs

## Démarrage local

```bash
# Variables d'environnement
cp .env.example .env

# Démarrer PostgreSQL
docker compose up -d postgres

# Installer les dépendances
pnpm install

# Migrations + seed
pnpm db:migrate
pnpm db:seed

# Dev
pnpm dev
```

## Scripts

```bash
pnpm dev             # Watch mode
pnpm build           # Build production
pnpm test            # Tests (Vitest)
pnpm test:coverage   # Tests avec couverture et seuils (vitest.config.ts)
pnpm db:studio       # Prisma Studio
pnpm db:migrate      # Appliquer / créer les migrations
pnpm db:seed         # Seeder (recrée les patients de démonstration)
```

## Tests

- Tests unitaires et de services (`src/**/*.spec.ts`), avec un Prisma simulé (`src/test/setup.ts`).
- Tests sur une vraie base (`*.db.spec.ts` : numérotation des factures en concurrence, avoirs, déclencheurs, migrations) :
  ils ne tournent qu’avec `TEST_DATABASE_URL`, une base migrée dédiée aux tests. Turbo ne transmet pas
  cette variable : lancer `TEST_DATABASE_URL=… npx vitest run` ici. La CI les lance toujours, et les seuils
  de couverture sont calés sur ce résultat.
- Les parcours de bout en bout (Playwright) sont dans `apps/frontend/e2e` et démarrent cette API eux-mêmes.

## Structure

```
src/
├── modules/
│   ├── auth/           # Connexion Google, sessions, connexion de développement (dev-login/)
│   ├── users/          # Comptes (admin)
│   ├── me/             # Paramètres : profil, activité, cabinets, tarifs
│   ├── patients/       # Fiche administrative, archivage, historique des accès
│   ├── patient-file/   # Dossier : séances, mesures, rubriques, faits marquants, comptes rendus ;
│   │                   #   calculs IMC/MB et courbes IOTF (calculations.ts, iotf.ts)
│   ├── appointments/   # Rendez-vous et options de prise de rendez-vous (types, cabinets)
│   ├── invoices/       # Factures, avoirs, numérotation, remises, organismes et prises en charge, CSV
│   ├── dashboard/      # Accueil
│   ├── documents/      # Documents (Cloud Storage, dossier local en développement)
│   ├── tasks/          # Tâches
│   ├── search/         # Recherche globale
│   └── audit/          # Journal d’accès (@Audited + intercepteur)
├── common/
│   ├── access/         # PatientAccessService : qui accède à quel patient
│   ├── decorators/     # @CurrentUser, @Roles, @Public
│   ├── guards/         # JWT, rôles
│   ├── middleware/     # X-Proxy-Token (API joignable seulement par le frontend)
│   └── validation/     # SIRET, ADELI / RPPS
├── config/             # Configuration centralisée
└── prisma/             # PrismaService, tests des migrations
prisma/
├── schema.prisma
├── migrations/
├── seed.ts             # Données de démonstration (dont le cas de test des calculs)
└── create-user.cjs     # Premier compte d’un environnement
```

## Auth

Connexion avec Google uniquement : pas de mot de passe, et l'API n'envoie aucun e-mail.

- `POST /api/v1/auth/google` `{ idToken }` → jeton d'accès (15 min) + cookie httpOnly `__session`
  (session de 10 h). Le jeton Google est vérifié (client `GOOGLE_CLIENT_ID`), l'adresse doit être
  vérifiée par Google et appartenir à un compte enregistré et actif ; sinon 401 avec un message
  en français. Jamais de création de compte à la connexion. Le compte Google (`sub`) est rattaché
  à l'utilisateur à sa première connexion.
- `POST /api/v1/auth/refresh` → nouveau jeton d'accès (la session n'est pas prolongée)
- `POST /api/v1/auth/logout` → révocation de la session
- Connexions et déconnexions sont inscrites au journal d'accès (`LOGIN`, `LOGOUT`) ; 10 tentatives
  de connexion par minute et par IP.

### Connexion de développement (local et tests uniquement)

`POST /api/v1/auth/dev-login` `{ email }` connecte un compte enregistré et actif sans Google, avec
les mêmes vérifications. Le formulaire « Connexion de développement » de la page de connexion
(build de développement du frontend) et les tests Playwright l'utilisent.

- Activée par `DEV_LOGIN=true` (dans `.env.example`). Sans ce réglage, la route n'existe pas (404).
- L'API **refuse de démarrer** avec `DEV_LOGIN=true` si `NODE_ENV` n'est pas `development` ou
  `test`, ou sur Cloud Run (variable `K_SERVICE`) : impossible à activer sur staging ou prod.
  Les tests `src/modules/auth/dev-login/dev-login.spec.ts` le vérifient.

### Créer un compte

Depuis l'app : Administration > Utilisateurs (rôle ADMIN), avec l'adresse du compte Google de la
personne. Pour le premier compte d'un environnement :

```bash
USER_EMAIL=quelquun@gmail.com USER_ROLE=ADMIN USER_FIRST_NAME=Prénom USER_LAST_NAME=Nom   npx --no-install tsx prisma/create-user.cjs
```

(dans l'image de l'API, par exemple en exécution du job `<env>-api-migrate` ; détails en tête du
script). En local, `pnpm db:seed` crée les comptes de démonstration.
