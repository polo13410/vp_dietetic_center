# VP Dietetic Center — Frontend

React 19 + Vite + TypeScript + TanStack Query + React Hook Form + Tailwind CSS.

## Démarrage

```bash
cp .env.example .env
pnpm install
pnpm dev
```

## Structure
```
src/
├── components/
│   ├── auth/         # RequireAuth
│   ├── layout/       # AppLayout, AuthLayout, Sidebar, Header
│   └── ui/           # Button, Toaster, LoadingSpinner...
├── pages/
│   ├── auth/         # Login, ForgotPassword
│   ├── dashboard/    # Dashboard
│   ├── patients/     # List, Detail, New
│   ├── appointments/ # List, Detail
│   ├── notes/        # List, Detail
│   ├── tasks/        # Tasks
│   ├── nutritional/  # Suivi patient
│   ├── documents/    # Documents
│   ├── reports/      # Reporting
│   └── admin/        # Administration
├── hooks/            # useAuth, usePatients...
├── stores/           # Zustand (authStore)
├── lib/              # api.ts (Axios + interceptors), utils.ts
└── styles/           # globals.css (Tailwind)
```

## Design system
- Tailwind CSS 4
- Shadcn/ui components (Radix UI primitives)
- Palette : Indigo (primary), Slate (neutral)
- Typographie : System font stack

## Auth
- Store Zustand persisté (user + isAuthenticated)
- Access token en mémoire
- Refresh token en cookie httpOnly
- Intercepteur Axios pour renouvellement automatique
