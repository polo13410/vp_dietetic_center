# Plan Directeur — VP Dietetic Center

> **Document de référence pour tous les agents et développeurs travaillant sur ce projet.**
> Version : 1.0 | Date : 2026-04-02 | Statut : Actif

---

## 1. Vision produit

Application web métier destinée à une **psycho-nutritionniste** pour gérer l'intégralité de son activité :
patients, rendez-vous, notes cliniques, suivi psycho-nutritionnel, documents, tâches administratives et reporting.

**Valeur clé** : vitesse d'usage quotidien, ergonomie praticienne, données patients fiables et sécurisées, architecture conforme RGPD/données de santé.

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────────────┐
│                        GitHub                               │
│   monorepo (Turborepo + pnpm workspaces)                    │
│   apps/api  |  apps/frontend  |  packages/*                 │
└──────────────────────────┬──────────────────────────────────┘
                           │ GitHub Actions CI/CD
          ┌────────────────┴────────────────┐
          ▼                                 ▼
┌──────────────────┐             ┌──────────────────┐
│  Cloud Run API   │             │ Cloud Run Frontend│
│  (NestJS + Node) │             │  (Nginx + React)  │
│  :3000           │             │  :80              │
└────────┬─────────┘             └──────────────────┘
         │                              │
         ├──► Cloud SQL (PostgreSQL 15) │
         ├──► Cloud Storage (fichiers)  │
         ├──► Secret Manager (secrets)  │
         └──► Cloud Logging/Monitoring  │
                                        │
              Artifact Registry ◄───────┘
              (images Docker)
```

### Environnements

| Env     | Branche      | Déploiement     | Base de données   |
| ------- | ------------ | --------------- | ----------------- |
| local   | any          | docker-compose  | PostgreSQL local  |
| dev     | develop      | automatique     | Cloud SQL dev     |
| staging | develop→main | automatique     | Cloud SQL staging |
| prod    | main         | manuel approuvé | Cloud SQL prod    |

---

## 3. Stack technique

### Frontend — `apps/frontend`

| Outil           | Version | Usage                 |
| --------------- | ------- | --------------------- |
| React           | 19.x    | UI framework          |
| TypeScript      | 5.x     | Typage                |
| Vite            | 6.x     | Build/Dev server      |
| React Router    | 7.x     | Routing               |
| TanStack Query  | 5.x     | Server state          |
| React Hook Form | 7.x     | Formulaires           |
| Zod             | 3.x     | Validation schémas    |
| Tailwind CSS    | 4.x     | Styles                |
| Shadcn/ui       | latest  | Composants (Radix UI) |
| Recharts        | 2.x     | Graphiques            |
| date-fns        | 3.x     | Dates                 |
| Vitest          | 3.x     | Tests unitaires       |
| Playwright      | latest  | Tests E2E (scaffold)  |

### Backend — `apps/api`

| Outil             | Version | Usage                   |
| ----------------- | ------- | ----------------------- |
| Node.js           | 24.x    | Runtime                 |
| NestJS            | 11.x    | Framework               |
| TypeScript        | 5.x     | Typage                  |
| Prisma            | 6.x     | ORM                     |
| PostgreSQL        | 15.x    | Base de données         |
| Passport.js       | 0.7.x   | Auth stratégies         |
| JWT               | -       | Access + Refresh tokens |
| bcrypt            | -       | Hashing passwords       |
| class-validator   | -       | Validation DTO          |
| class-transformer | -       | Transformation DTO      |
| nestjs-throttler  | -       | Rate limiting           |
| helmet            | -       | Headers sécurité        |
| pino              | -       | Logs structurés         |
| Swagger/OpenAPI   | -       | Documentation API       |
| Vitest            | 3.x     | Tests                   |

### Packages partagés — `packages/`

- `packages/types` — Types TypeScript partagés (DTOs, enums, interfaces)
- `packages/config` — Configs ESLint, Prettier, TypeScript base

### Infrastructure

| Outil     | Usage                  |
| --------- | ---------------------- |
| Terraform | IaC Google Cloud       |
| Docker    | Containerisation       |
| Turborepo | Orchestration monorepo |
| pnpm      | Gestion dépendances    |

---

## 4. Modèle de données (Prisma)

### Entités principales

```
User ──────────────────── rôles : admin | praticienne | assistante
Patient ──────────────── lié à User (praticienne), soft-delete
Appointment ──────────── lié Patient + User, statuts multiples
ClinicalNote ─────────── lié Patient + Appointment (optionnel)
NutritionalProfile ───── 1:1 avec Patient
NutritionalEntry ─────── journal quotidien lié Patient
Document ─────────────── lié Patient, stocké Cloud Storage
Task ─────────────────── lié Patient (optionnel) + User
AuditLog ─────────────── toutes les actions sensibles
Consent ──────────────── RGPD : consentements patients
UserPreferences ─────── 1:1 avec User
Tag ──────────────────── tags configurables, ManyToMany Patient
```

### Règles métier clés

- Soft delete sur Patient (statut : ACTIVE | INACTIVE | ARCHIVED | DELETED)
- Notes cliniques : brouillon → finalisé (verrouillé après finalisation)
- Audit log : toute action CREATE/UPDATE/DELETE sur entités sensibles
- Consentements stockés avec date, version et preuve (texte signé)

---

## 5. API REST — Conventions

### Versioning

Toutes les routes préfixées `/api/v1/`

### Endpoints principaux

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password

GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PATCH  /api/v1/users/:id
DELETE /api/v1/users/:id

GET    /api/v1/patients          ?page&limit&search&status&tag
POST   /api/v1/patients
GET    /api/v1/patients/:id
PATCH  /api/v1/patients/:id
DELETE /api/v1/patients/:id      (soft delete)
GET    /api/v1/patients/:id/timeline

GET    /api/v1/appointments      ?page&limit&patientId&status&from&to
POST   /api/v1/appointments
GET    /api/v1/appointments/:id
PATCH  /api/v1/appointments/:id
DELETE /api/v1/appointments/:id

GET    /api/v1/notes             ?patientId&appointmentId&status
POST   /api/v1/notes
GET    /api/v1/notes/:id
PATCH  /api/v1/notes/:id
DELETE /api/v1/notes/:id
POST   /api/v1/notes/:id/finalize

GET    /api/v1/documents         ?patientId
POST   /api/v1/documents/upload
GET    /api/v1/documents/:id
DELETE /api/v1/documents/:id
GET    /api/v1/documents/:id/download

GET    /api/v1/tasks             ?patientId&status&dueDate
POST   /api/v1/tasks
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id

GET    /api/v1/nutritional/profile/:patientId
PATCH  /api/v1/nutritional/profile/:patientId
GET    /api/v1/nutritional/entries?patientId&from&to
POST   /api/v1/nutritional/entries

GET    /api/v1/search?q=         (recherche globale)
GET    /api/v1/dashboard/summary (métriques dashboard)

GET    /api/v1/reports/activity
GET    /api/v1/reports/patients
GET    /api/v1/reports/export    ?format=csv|pdf

GET    /api/v1/audit-logs        (admin only)

GET    /api/v1/health
```

---

## 6. Authentification & Sécurité

### Flux JWT

1. `POST /auth/login` → access_token (15min) + refresh_token httpOnly cookie (7j)
2. Client utilise access_token dans header `Authorization: Bearer ...`
3. Sur 401, client appelle `POST /auth/refresh` avec cookie
4. Nouveau access_token émis

### Rôles & Permissions

```
ADMIN        → tout + gestion utilisateurs + audit logs
PRATICIENNE  → ses patients + rendez-vous + notes + documents + tâches
ASSISTANTE   → lecture patients + gestion rendez-vous + tâches administratives
```

### Mesures de sécurité

- Helmet (headers HTTP sécurisés)
- Rate limiting : 100 req/15min global, 5 req/min sur auth
- CORS restreint aux origines connues
- Validation stricte tous les inputs (class-validator)
- Pas d'exposition d'IDs séquentiels (UUIDs v7)
- Audit log automatique via intercepteur NestJS
- Refresh tokens rotés et révocables
- Bcrypt rounds=12 pour mots de passe
- Secrets jamais en clair dans le code (Secret Manager / .env)

### RGPD / Données de santé

- Minimisation des données collectées
- Consentements versionnés et traçables
- Export données patient (droit d'accès)
- Anonymisation/suppression sur demande
- Politique de rétention configurable (default: 5 ans données inactives)
- Logs d'accès aux dossiers patients
- Architecture préparée pour hébergement données de santé FR

---

## 7. Structure du monorepo

```
vp_dietetic_center/
├── apps/
│   ├── api/                    # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── patients/
│   │   │   │   ├── appointments/
│   │   │   │   ├── notes/
│   │   │   │   ├── documents/
│   │   │   │   ├── tasks/
│   │   │   │   ├── nutritional/
│   │   │   │   ├── search/
│   │   │   │   ├── reports/
│   │   │   │   └── audit/
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   ├── filters/
│   │   │   │   ├── guards/
│   │   │   │   ├── interceptors/
│   │   │   │   └── pipes/
│   │   │   ├── config/
│   │   │   ├── prisma/
│   │   │   └── app.module.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   └── package.json
│   │
│   └── frontend/               # Frontend React
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/         # Shadcn components
│       │   │   ├── layout/
│       │   │   └── business/   # Composants métier
│       │   ├── pages/
│       │   │   ├── auth/
│       │   │   ├── dashboard/
│       │   │   ├── patients/
│       │   │   ├── appointments/
│       │   │   ├── notes/
│       │   │   ├── nutritional/
│       │   │   ├── documents/
│       │   │   ├── tasks/
│       │   │   ├── reports/
│       │   │   └── admin/
│       │   ├── hooks/
│       │   ├── services/
│       │   ├── stores/
│       │   ├── lib/
│       │   └── types/
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── types/                  # Types partagés
│   └── config/                 # Configs partagées (ESLint, TS, Prettier)
│
├── infra/
│   └── terraform/
│       ├── modules/
│       │   ├── artifact-registry/
│       │   ├── cloud-run/
│       │   ├── cloud-sql/
│       │   ├── storage/
│       │   ├── secret-manager/
│       │   ├── service-accounts/
│       │   ├── iam/
│       │   ├── project-services/
│       │   └── monitoring/
│       ├── envs/
│       │   ├── dev/
│       │   ├── staging/
│       │   └── prod/
│       └── README.md
│
├── docs/
│   ├── PLAN.md                 # CE DOCUMENT
│   ├── ADR/                    # Architecture Decision Records
│   └── api/                    # Docs API complémentaires
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── cd-api.yml
│       ├── cd-frontend.yml
│       ├── terraform-plan.yml
│       └── terraform-apply.yml
│
├── docker-compose.yml
├── docker-compose.override.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

---

## 8. Roadmap et phases de développement

### Phase 1 — Fondations (Semaines 1-3) ✅ SCAFFOLD CRÉÉ

- [x] Monorepo configuré (Turborepo + pnpm)
- [x] Backend NestJS bootstrapé avec auth JWT
- [x] Frontend React bootstrapé avec routing protégé
- [x] Prisma schema complet
- [x] Docker Compose local fonctionnel
- [x] Terraform modules créés (non appliqués)
- [x] GitHub Actions CI de base
- [ ] Déploiement dev fonctionnel end-to-end
- [ ] Seeds de démonstration complets

### Phase 2 — Core fonctionnel (Semaines 4-7) ✅ TERMINÉ

- [x] Module patients CRUD complet + fiche complète
- [x] Module rendez-vous avec vue liste et agenda
- [x] Module notes cliniques (libre + structurée)
- [x] Tableau de bord avec vraies données
- [x] Recherche globale
- [x] Upload documents Cloud Storage

### Phase 3 — Métier avancé (Semaines 8-11) ✅ TERMINÉ

- [x] Suivi psycho-nutritionnel complet + graphiques
- [x] Tâches et rappels
- [x] Timeline patient
- [x] Export PDF fiche patient
- [x] Reporting + exports CSV
- [x] Notifications in-app

### Phase 4 — Qualité & Production (Semaines 12-14) ✅ TERMINÉ

- [x] Tests couverture ≥ 70% (43 backend + 26 frontend unit tests)
- [x] Tests E2E Playwright critiques (4 suites : auth, patients, RDV, notes)
- [x] Audit sécurité (dépendances, headers, auth, password complexity)
- [x] Performance frontend (bundle optimisé, PDF lazy-loaded)
- [ ] Déploiement staging complet (infra Terraform prête, non appliquée)
- [ ] Documentation utilisateur
- [ ] Monitoring et alerting GCP
- [ ] Déploiement production

### Phase 5 — Améliorations futures

- [ ] Application mobile (React Native ou PWA)
- [ ] Rappels SMS/email automatisés
- [ ] Portail patient (accès limité)
- [ ] Téléconsultation intégrée (Jitsi ou équivalent)
- [ ] Intelligence artificielle : résumé de séance
- [ ] Facturation et notes d'honoraires
- [ ] Agenda partagé avec synchronisation calendrier
- [ ] Connexion API Doctolib (si disponible)

---

## 9. Conventions de code

### Commits (Conventional Commits)

```
feat(patients): add timeline view
fix(auth): refresh token not invalidated on logout
chore(deps): upgrade prisma to 6.x
docs(api): add swagger annotations to patients module
test(appointments): add unit tests for status transitions
refactor(notes): extract note finalizer service
```

### Branches

```
main         → production
develop      → intégration, déploiement staging auto
feature/xxx  → fonctionnalités
fix/xxx      → corrections
chore/xxx    → maintenance
```

### Nommage fichiers

- Backend : `kebab-case.ts` (NestJS convention)
- Frontend : `PascalCase.tsx` pour composants, `camelCase.ts` pour autres
- Tests : `*.spec.ts` (backend), `*.test.tsx` (frontend)

---

## 10. Variables d'environnement clés

### Backend (`apps/api/.env`)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
GCS_BUCKET_NAME=...
GOOGLE_CLOUD_PROJECT=...
CORS_ORIGINS=http://localhost:5173
```

### Frontend (`apps/frontend/.env`)

```
VITE_API_URL=http://localhost:3000/api/v1
VITE_APP_NAME=VP Dietetic Center
```

---

## 11. Contacts et responsabilités

| Rôle           | Responsabilité                                    |
| -------------- | ------------------------------------------------- |
| Chef de projet | Architecture globale, cohérence technique, revues |
| Dev Backend    | Modules NestJS, API, Prisma, sécurité             |
| Dev Frontend   | Pages React, composants, intégration API          |
| DevOps         | Terraform, CI/CD, monitoring, déploiements        |
| QA             | Tests, recette fonctionnelle                      |

---

_Document maintenu par l'équipe technique. Toute décision architecturale structurante doit être consignée dans `docs/ADR/`._
