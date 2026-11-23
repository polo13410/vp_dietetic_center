# VP Dietetic Center — Frontend

React 19 + Vite + TypeScript + TanStack Query + React Hook Form + Tailwind CSS.

## Démarrage

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Connexion

Google uniquement (`VITE_GOOGLE_CLIENT_ID`, même client OAuth que l'API). En développement
(`pnpm dev`), un formulaire « Connexion de développement » sous le bouton Google connecte un
compte enregistré par son e-mail, sans Google : il faut que l'API tourne avec `DEV_LOGIN=true`
(voir `apps/api/README.md`). Ce formulaire n'existe pas dans le build de production.

## Tests de bout en bout (Playwright)

Base migrée et seedée (`pnpm db:seed`), API lancée avec `DEV_LOGIN=true`, puis
`pnpm test:e2e`. Les tests se connectent avec la connexion de développement (`e2e/sign-in.ts`).

## Structure

```
src/
├── components/
│   ├── analytics/       # PatientStatistics, NutritionTrends, AppointmentOverview
│   ├── auth/            # RequireAuth
│   ├── layout/          # AppLayout, AuthLayout, Sidebar (collapsible), Header
│   ├── notifications/   # NotificationCenter (bell dropdown)
│   └── ui/              # Button, Card, Tabs, Input, Badge, Switch, Toaster...
├── pages/
│   ├── auth/            # Login (Google, et connexion de développement en local)
│   ├── dashboard/       # Dashboard
│   ├── patients/        # List, Detail, New
│   ├── appointments/    # List, Detail
│   ├── calendar/        # Calendrier hebdomadaire + agenda journalier
│   ├── notes/           # List, Detail
│   ├── tasks/           # Tasks
│   ├── nutritional/     # Suivi patient
│   ├── documents/       # Documents
│   ├── reports/         # Reporting
│   ├── analytics/       # Tableau de bord analytique (charts)
│   ├── profile/         # Profil utilisateur
│   ├── settings/        # Paramètres (Profil, Sécurité, Notifications, Apparence)
│   └── admin/           # Administration
├── hooks/               # useAuth, useLocalStorage...
├── stores/              # Zustand (authStore, notificationStore)
├── lib/                 # api.ts (Axios + interceptors), utils.ts
└── styles/              # globals.css (Tailwind + dark mode)
```

## Fonctionnalités UI/UX

- **Sidebar collapsible** : réduisible avec le raccourci `Alt+S`, état persisté en localStorage
- **Thème sombre/clair** : toggle dans le header, persisté en localStorage
- **Centre de notifications** : icône cloche avec badge de comptage, dropdown
- **Menu utilisateur** : dropdown avec accès rapide au Profil, Paramètres, Déconnexion
- **Analytiques** : graphiques Recharts (statistiques patients, tendances nutrition, vue RDV)
- **Calendrier** : vue hebdomadaire avec agenda journalier
- **Paramètres** : 4 onglets (Profil, Sécurité, Notifications, Apparence)

## Design system

- Tailwind CSS 4 avec support dark mode (classe `.dark` sur `<html>`)
- Shadcn/ui components (Radix UI primitives)
- Palette : Indigo (primary), Slate (neutral)
- Typographie : System font stack

## Auth

- Store Zustand persisté (user + isAuthenticated)
- Access token en mémoire
- Refresh token en cookie httpOnly
- Intercepteur Axios pour renouvellement automatique
