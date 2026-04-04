# VP Dietetic Center

Application métier pour psycho-nutritionniste — gestion patients, rendez-vous, notes cliniques, suivi nutritionnel.

## Architecture

- **Frontend** : React 19 + Vite + TypeScript + TanStack Query + React Hook Form + Recharts
- **Backend** : NestJS + Node.js 24 + TypeScript + Prisma
- **Base de données** : PostgreSQL 15
- **Déploiement** : Google Cloud (Cloud Run + Cloud SQL + Cloud Storage)
- **IaC** : Terraform
- **CI/CD** : GitHub Actions

Voir [docs/PLAN.md](docs/PLAN.md) pour l'architecture complète et la roadmap.

---

## Démarrage local

### Prérequis

- Node.js >= 20
- pnpm >= 9 (`npm install -g pnpm`)
- Docker + Docker Compose

### Installation

```bash
# 1. Installer les dépendances
pnpm install

# 2. Copier les variables d'environnement
cp apps/api/.env.example apps/api/.env
cp apps/frontend/.env.example apps/frontend/.env

# 3. Démarrer PostgreSQL + Mailpit
docker compose up -d postgres mailpit

# 4. Créer la migration initiale puis seeder la base
pnpm db:migrate:init
pnpm db:seed

# 5. Démarrer en mode développement
pnpm dev
```

L'application sera disponible sur :

- Frontend : http://localhost:5173
- API : http://localhost:3000
- Swagger : http://localhost:3000/api/docs
- Mailpit : http://localhost:8025

### Comptes de démonstration

| Email                      | Mot de passe | Rôle        |
| -------------------------- | ------------ | ----------- |
| admin@vp-dietetic.fr       | Admin1234!   | ADMIN       |
| praticienne@vp-dietetic.fr | Pratic1234!  | PRATICIENNE |
| assistante@vp-dietetic.fr  | Assist1234!  | ASSISTANTE  |

---

## Scripts disponibles

```bash
pnpm dev          # Démarrer tous les services en mode dev
pnpm build        # Builder tous les packages
pnpm test         # Lancer tous les tests
pnpm lint         # Linter tout le code
pnpm typecheck    # Vérifier les types TypeScript

pnpm db:generate      # Générer le client Prisma
pnpm db:migrate:init  # Créer la migration initiale (premier lancement)
pnpm db:migrate       # Appliquer les migrations suivantes
pnpm db:seed          # Seeder la base de données
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
│   └── terraform/    # Infrastructure Google Cloud
├── docs/
│   └── PLAN.md       # Plan directeur du projet
└── .github/
    └── workflows/    # Pipelines CI/CD
```

---

## Documentation

- [Plan directeur](docs/PLAN.md)
- [README Backend](apps/api/README.md)
- [README Frontend](apps/frontend/README.md)
- [README Terraform](infra/terraform/README.md)

---

## Contribution

1. Créer une branche `feature/ma-fonctionnalite` depuis `develop`
2. Suivre les conventions [Conventional Commits](https://www.conventionalcommits.org/)
3. Ouvrir une PR vers `develop`
4. La PR doit passer CI (lint + typecheck + tests + build)
5. Review requise avant merge
