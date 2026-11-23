# VP Dietetic Center — Frontend

React 19 + Vite + TypeScript + TanStack Query + React Hook Form + Tailwind CSS 4 + shadcn/ui (Radix).
Ce que fait l'app : [docs/PLAN.md](../../docs/PLAN.md). Charte visuelle et composants : [docs/DESIGN.md](../../docs/DESIGN.md).

## Démarrage

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Vite relaie `/api` vers l'API (`http://localhost:3000`, ou `API_PROXY_TARGET`).

## Connexion

Google uniquement (`VITE_GOOGLE_CLIENT_ID`, même client OAuth que l'API). En développement
(`pnpm dev`), un formulaire « Connexion de développement » sous le bouton Google connecte un
compte enregistré par son e-mail, sans Google : il faut que l'API tourne avec `DEV_LOGIN=true`
(voir `apps/api/README.md`). Ce formulaire n'existe pas dans le build de production.

## Tests

```bash
pnpm test            # Vitest + Testing Library (jsdom)
pnpm test:coverage   # avec couverture et seuils (vitest.config.ts)
pnpm test:e2e        # Playwright : parcours de bout en bout
```

### Tests de bout en bout (`e2e/`)

Les parcours réels, en Chromium, à la taille d'un iPad paysage : créer un patient avec
l'assistant, prendre un rendez-vous par type, mener un bilan (IMC et MB du cas de test), faire et
télécharger la facture, corriger le tarif d'une ancienne séance (avoir + nouvelle facture),
ajouter un poids ancien dans Mesures, préparer un compte rendu au médecin.

`pnpm test:e2e` fait tout : il reconstruit la base `E2E_DATABASE_URL` (par défaut
`postgresql://vp_user:vp_password@localhost:5432/vp_e2e`, à partir des migrations et du seed ;
le script refuse une base dont le nom ne contient pas « e2e »), construit et démarre l'API sur
le port 3900 avec `DEV_LOGIN=true`, puis Vite sur le port 5900. Il suffit que PostgreSQL tourne
(`docker compose up -d postgres`) et que Chromium soit installé (`pnpm exec playwright install chromium`).
Les tests se connectent avec la connexion de développement (`e2e/helpers.ts`). En CI, ils tournent
sur chaque PR vers `staging` (job « End-to-end tests »).

## Structure

```
src/
├── components/
│   ├── ui/              # Primitives shadcn/ui (bouton, dialogue, onglets, select…)
│   ├── shared/          # Composants de la charte : PageHeader, Section, Field, EmptyState,
│   │                    #   Stepper, StatusBadge, SaveIndicator, PearMascot, ConfirmDialog…
│   ├── layout/          # AppLayout, PageShell (largeurs), Sidebar, Header, AuthLayout, areas.ts (couleurs par espace)
│   ├── patient-file/    # Dossier : récapitulatif, dossier médical, mesures, suivi, courbes
│   ├── patients/        # Assistant de création, fiche, documents, tâches, historique des accès, export PDF
│   ├── consultations/   # Séance : panneau Rappel, champs, fin de séance
│   ├── invoices/        # Factures, avoirs, remise, organismes, prises en charge, PDF
│   ├── gp-reports/      # Comptes rendus au médecin et leur PDF
│   ├── appointments/    # Agenda (grille) et prise de rendez-vous
│   ├── settings/        # Sections des Paramètres et enregistrement automatique
│   ├── documents/, tasks/, search/, admin/, auth/
├── pages/               # Une page par route (router.tsx) : accueil, patients, séance, agenda,
│                        #   factures, compte rendu, paramètres, administration, connexion, 404
├── lib/                 # api.ts (Axios + rafraîchissement du jeton), requêtes et règles par domaine
│                        #   (patient-file, invoices, appointments, gp-reports…), téléchargements
├── hooks/               # useAuth, useMe, useAutosave, useGrowingTextarea…
├── stores/              # zustand : session (authStore), thème (themeStore)
├── styles/              # globals.css : variables de la charte, clair et sombre
└── test/                # Mise en place des tests, données de test
e2e/                     # Playwright
```

## Interface

- Charte tirée du logo (vert sauge, turquoise, vert poire), une couleur par espace, texte de base en
  16 px, thème clair / sombre / comme l'appareil ([docs/DESIGN.md](../../docs/DESIGN.md)).
- Pensée pour l'iPad : cibles tactiles, bon clavier pour chaque champ, le champ en cours reste au-dessus
  du clavier.
- Barre latérale réductible (`Alt+S`, état mémorisé), en tiroir sur les écrans étroits.
- Enregistrement automatique avec un indicateur visible (paramètres, dossier, séance, compte rendu).
- PDF (factures, avoirs, comptes rendus, export du dossier) faits dans le navigateur avec
  `@react-pdf/renderer` ; la CSP de `nginx.conf` autorise `'wasm-unsafe-eval'` pour son moteur de mise en page.

## Auth

- Store zustand : l'utilisateur est mémorisé dans le navigateur, le jeton d'accès reste en mémoire
  seulement ; la session est dans le cookie httpOnly `__session`.
- L'intercepteur Axios renouvelle le jeton d'accès quand il expire.
