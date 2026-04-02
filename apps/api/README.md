# VP Dietetic Center — API

Backend NestJS pour l'application de gestion psycho-nutritionnelle.

## Stack

- Node.js 24 + NestJS 11 + TypeScript
- PostgreSQL 15 + Prisma 6
- JWT (access + refresh token httpOnly)
- Swagger UI : http://localhost:3000/api/docs

## Démarrage local

```bash
# Variables d'environnement
cp .env.example .env

# Démarrer PostgreSQL + Mailpit
docker compose up -d postgres mailpit

# Installer les dépendances
pnpm install

# Migration initiale + seed
pnpm db:migrate:init
pnpm db:seed

# Dev
pnpm dev
```

## Scripts

```bash
pnpm dev             # Watch mode
pnpm build           # Build production
pnpm test            # Tests unitaires
pnpm test:e2e        # Tests e2e
pnpm db:studio       # Prisma Studio
pnpm db:migrate:init # Créer la migration initiale
pnpm db:migrate      # Appliquer les migrations suivantes
pnpm db:seed         # Seeder
```

## Structure

```
src/
├── modules/
│   ├── auth/           # Auth JWT + refresh
│   ├── users/          # Gestion utilisateurs
│   ├── patients/       # Fiche patients
│   ├── appointments/   # Rendez-vous
│   ├── notes/          # Notes cliniques
│   ├── nutritional/    # Suivi nutritionnel
│   ├── documents/      # Documents (GCS)
│   ├── tasks/          # Tâches
│   ├── search/         # Recherche globale + dashboard
│   ├── reports/        # Reporting
│   └── audit/          # Logs d'audit
├── common/
│   ├── decorators/     # @CurrentUser, @Roles, @Public
│   ├── guards/         # JWT, Roles, Throttle
│   └── filters/        # Global exception filter
├── config/             # Configuration centralisée
└── prisma/             # PrismaService
```

## Auth

- `POST /api/v1/auth/login` → access_token (15min) + refresh_token (httpOnly cookie, 7j)
- `POST /api/v1/auth/refresh` → nouveau access_token
- `POST /api/v1/auth/logout` → révocation refresh token
