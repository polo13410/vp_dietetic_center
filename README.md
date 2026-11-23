# VP Dietetic Center

Application métier pour diététicienne / psycho-nutritionniste : dossier patient (récapitulatif, dossier médical, mesures, IMC et MB, séances), séance en deux temps, factures avec avoirs, remises et tiers payant, plusieurs cabinets, agenda par type de rendez-vous, compte rendu au médecin traitant, documents, journal d'accès. Connexion avec Google uniquement.

## Architecture

- **Frontend** : React 19 + Vite + TypeScript + TanStack Query + React Hook Form + Recharts
- **Backend** : NestJS + Node.js 24 + TypeScript + Prisma
- **Base de données** : PostgreSQL 15
- **Déploiement** : Google Cloud, région Paris (Firebase Hosting + Cloud Run + Cloud SQL + Cloud Storage)
- **IaC** : Terraform
- **CI/CD** : GitHub Actions

Voir [docs/PLAN.md](docs/PLAN.md) pour le produit, l'architecture et ce qui reste à faire.

---

## Démarrage local

### Prérequis

- Node.js 24
- pnpm 10 (`corepack enable`, la version vient de `packageManager` dans `package.json`)
- Docker + Docker Compose

### Installation

```bash
# 1. Installer les dépendances
pnpm install

# 2. Copier les variables d'environnement
cp apps/api/.env.example apps/api/.env
cp apps/frontend/.env.example apps/frontend/.env   # VITE_GOOGLE_CLIENT_ID, facultatif en local

# 3. Démarrer PostgreSQL
docker compose up -d postgres

# 4. Appliquer les migrations puis seeder la base
pnpm db:migrate
pnpm db:seed

# 5. Démarrer en mode développement
pnpm dev
```

L'application sera disponible sur :

- Frontend : http://localhost:5173
- API : http://localhost:3000
- Swagger : http://localhost:3000/api/docs

### Connexion en local

On se connecte uniquement avec Google : il n'y a pas de mot de passe. En local, sans Google, la
**connexion de développement** (sous le bouton Google de la page de connexion) connecte un compte
enregistré avec son e-mail. Elle est activée par `DEV_LOGIN=true` dans `apps/api/.env` (déjà
présent dans `.env.example` et dans `docker-compose.yml`) ; l'API refuse de démarrer avec ce
réglage sur staging ou prod.

Comptes de démonstration créés par le seed (local uniquement) :

| Email                      | Rôle        |
| -------------------------- | ----------- |
| admin@vp-dietetic.fr       | ADMIN       |
| praticienne@vp-dietetic.fr | PRATICIENNE |
| assistante@vp-dietetic.fr  | ASSISTANTE  |

La praticienne a deux cabinets, deux tarifs (Bilan, Suivi), un organisme et sept patients avec
leurs séances, factures et comptes rendus, dont Martine Roux, le cas de test des calculs.

Pour tester la vraie connexion Google en local : renseigner `GOOGLE_CLIENT_ID` (API) et
`VITE_GOOGLE_CLIENT_ID` (frontend) avec un client OAuth qui autorise `http://localhost:5173`, et
créer un compte avec l'adresse de votre compte Google (voir `apps/api/README.md`).

---

## Scripts disponibles

```bash
pnpm dev          # Démarrer tous les services en mode dev
pnpm build        # Builder tous les packages
pnpm test         # Lancer les tests unitaires (Vitest)
pnpm test:e2e     # Tests de bout en bout (Playwright, voir apps/frontend/README.md)
pnpm lint         # Linter tout le code
pnpm typecheck    # Vérifier les types TypeScript

pnpm db:generate      # Générer le client Prisma
pnpm db:migrate       # Appliquer les migrations (et en créer une après un changement du schéma)
pnpm db:seed          # Seeder la base de données (recrée les patients de démonstration)
pnpm db:studio    # Ouvrir Prisma Studio

pnpm docker:up    # Démarrer l'environnement Docker complet
pnpm docker:down  # Arrêter l'environnement Docker
pnpm docker:logs  # Voir les logs Docker
```

---

## Structure du monorepo

```
vp_dietetic_center/
├── apps/
│   ├── api/          # Backend NestJS
│   └── frontend/     # Frontend React
├── packages/
│   ├── types/        # Types TypeScript partagés
│   └── config/       # Configs ESLint, Prettier, TypeScript
├── infra/
│   ├── bootstrap/    # Amorçage du projet GCP (APIs, secrets, comptes de service)
│   ├── budget-cutoff/ # Coupure automatique si le budget est dépassé
│   └── terraform/    # Infrastructure Google Cloud
├── docs/
│   ├── PLAN.md       # Plan directeur du projet
│   ├── DESIGN.md     # Charte visuelle et composants
│   └── REFONTE.md    # Refonte métier et UX : lots et décisions
└── .github/
    └── workflows/    # Pipelines CI/CD
```

---

## Documentation

- [Plan directeur](docs/PLAN.md)
- [Charte visuelle](docs/DESIGN.md)
- [Refonte métier et UX](docs/REFONTE.md)
- [README Backend](apps/api/README.md)
- [README Frontend](apps/frontend/README.md)
- [README Terraform](infra/terraform/README.md)

---

## Contribution

1. Créer une branche `feat/ma-fonctionnalite` (ou `fix/…`, `chore/…`, `docs/…`) depuis `staging`
2. Suivre les conventions [Conventional Commits](https://www.conventionalcommits.org/), en minuscules
3. Ouvrir une PR vers `staging` : la CI doit passer (lint + typecheck + tests avec seuils de couverture + build, tests de bout en bout, Terraform)
4. Le merge dans `staging` déploie sur staging ; le merge `staging` → `prod` déploie en production (approbation requise)

Détails dans [docs/PLAN.md](docs/PLAN.md).
