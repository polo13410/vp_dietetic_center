# Plan directeur — VP Dietetic Center

> Référence pour toute personne (ou agent) qui travaille sur le projet : ce que fait l'app, comment elle est construite et déployée, ce qui reste à faire.
> Mis à jour le 2026-11-22.

---

## 1. Produit

Application web pour une **diététicienne / psycho-nutritionniste** : suivre ses patients d'une séance à l'autre, préparer chaque rendez-vous en un coup d'œil, et garder un dossier fiable et protégé (données de santé, RGPD).

### Rôles

| Rôle          | Ce qu'il fait                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------- |
| `ADMIN`       | Gère l'application et les comptes, consulte le journal d'accès. **Ne voit aucune donnée patient.** |
| `PRATICIENNE` | Travaille avec **ses** patients uniquement (dossier, rendez-vous, séances, documents, tâches).    |
| `ASSISTANTE`  | Existe dans le code (lecture du dossier + rendez-vous) mais n'est pas utilisé ni proposé à la création de compte. |

Le contrôle d'accès est centralisé dans `PatientAccessService` (API) : chaque requête sur un patient vérifie qu'il appartient à la praticienne connectée.

### Navigation

- **Praticienne** : Tableau de bord · Patients · Rendez-vous · Paramètres
- **Admin** : Utilisateurs · Journal d'accès · Paramètres

Les notes, tâches et documents n'ont pas de page à eux : ils vivent dans le dossier du patient.

### Dossier patient

| Élément                | Contenu                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Profil                 | Identité, sexe, contact, situation familiale, profession, médecin traitant, motif, adressé par, consentements ; archivé ou non |
| Mesures                | Poids, taille, tour de taille/hanches, masse grasse/musculaire — avec historique et graphiques             |
| IMC, MB                | Calculés par l'API, jamais stockés (formules de sa feuille, `docs/REFONTE.md` § 3.1)                       |
| Dossier médical        | Ses rubriques (santé, antécédents, psy, activité, histoire du poids, allergies, glycémie, cholestérol, aversions, goûts), chacune avec son historique daté |
| Faits marquants        | Événements datés, affichés sur les graphiques de mesures                                                  |
| Séances                | Une ligne de son suivi : formule, paiement, poids, habitudes et évolution, travail en consultation, conseils. Jamais verrouillée ; la démarrer depuis un rendez-vous le passe à « terminé » |
| Comptes rendus         | Comptes rendus au médecin traitant (brouillon, envoyé)                                                    |
| Documents              | Fichiers (PDF, images, documents bureautiques — liste blanche de formats, 10 Mo max), aperçu dans le navigateur |
| Tâches                 | Tâches liées au patient                                                                                   |
| Historique des accès   | Qui a consulté ou modifié le dossier                                                                     |

Avant une séance, le **brief** rassemble l'essentiel : dernière séance et ses conseils, mesures et évolution, IMC et MB, dossier médical, derniers événements.

### Tableau de bord et agenda

- Tableau de bord : prochain patient avec son brief, rendez-vous du jour, nombre de patients suivis, patients sans séance depuis 6 semaines.
- Rendez-vous : agenda semaine / jour / liste sur une grille horaire, création et modification depuis l'agenda.

### Décisions produit

- Pas de rappels de rendez-vous aux patients pour l'instant. L'app n'envoie aucun e-mail.
- Connexion avec Google uniquement, sans mot de passe (décision du 2026-11-23, [REFONTE.md](REFONTE.md) lot 14).
- Plusieurs praticiennes possibles, chacune ne voit que ses patients.
- Budget d'hébergement visé : 16 CHF/mois maximum.

---

## 2. Architecture

```
Navigateur
   │  https://staging.app.dietetiquecenter.fr  (même origine pour l'app et l'API)
   ▼
Firebase Hosting ──(rewrite **)──► Cloud Run « frontend » (nginx + build React)
                                       │  /api/* → ajoute l'en-tête secret X-Proxy-Token
                                       ▼
                                  Cloud Run « api » (NestJS)
                                       ├──► Cloud SQL PostgreSQL 15 (instance partagée, une base par env)
                                       ├──► Cloud Storage (documents patients)
                                       ├──► Secret Manager (secrets)
                                       └──► Google (vérification des jetons de connexion)
```

- **Même origine** : le navigateur ne parle qu'à l'app. nginx relaie `/api` vers l'API, donc pas de CORS et un cookie de session first-party.
- **API fermée** : l'API refuse (403) toute requête sans le bon `X-Proxy-Token`, sauf `/api/v1/health`. Seul le frontend connaît ce secret.
- **Firebase Hosting** sert le domaine personnalisé et le certificat (Cloud Run ne mappe pas de domaine en europe-west9, et un load balancer coûterait plus que le reste du projet). Il ne transmet que le cookie `__session`, d'où son nom.
- **Mise à l'échelle à zéro** pour les deux services Cloud Run.
- Région : **europe-west9 (Paris)**. Fuseau de l'API : `Europe/Paris`.

### Environnements

| Env     | Branche   | Adresse                                   | État                 |
| ------- | --------- | ----------------------------------------- | -------------------- |
| local   | toutes    | http://localhost:5173 (docker compose)    | —                    |
| staging | `staging` | https://staging.app.dietetiquecenter.fr   | En ligne             |
| prod    | `prod`    | https://app.dietetiquecenter.fr           | **Pas encore créée** |

Le domaine `dietetiquecenter.fr` est chez LWS (site vitrine actuel). Les enregistrements DNS de l'app y sont ajoutés à la main ; `terraform output dns_records` donne ceux de l'app.

---

## 3. Stack

| Partie      | Outils                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| Frontend    | React 19, Vite, TypeScript, React Router, TanStack Query, zustand, React Hook Form + zod, Tailwind CSS 4, shadcn/ui (Radix), Recharts, date-fns |
| API         | Node.js 24, NestJS 11, Prisma 6, PostgreSQL 15, Passport (JWT, Google), class-validator, helmet, throttler, pino, Swagger |
| Tests       | Vitest (API et frontend), Playwright (scaffold, hors CI)                                                 |
| Monorepo    | pnpm workspaces + Turborepo ; `packages/types` (types partagés), `packages/config` (ESLint, Prettier, TS) |
| Infra       | Terraform (`infra/terraform`), script d'amorçage (`infra/bootstrap`), coupure budgétaire (`infra/budget-cutoff`) |
| CI/CD       | GitHub Actions (`ci.yml`, `cd.yml`)                                                                      |

---

## 4. Modèle de données

```
User ─── rôle, préférences, sessions (RefreshToken)
Formula ─── tarif d'une praticienne (libellé, prix), copié dans chaque séance
Patient ─── appartient à une praticienne ; archivedAt, consentements (Consent)
 ├── Appointment ─── rendez-vous (type, statut)
 │    └── Consultation ─── séance (formule, paiement, textes), liée ou non au rendez-vous
 ├── Measurement ─── une valeur par type (MetricType) et par date, liée ou non à une séance
 ├── FileEntry ─── une version d'une rubrique du dossier médical (FileField)
 ├── LifeEvent ─── fait marquant (catégorie facultative)
 ├── GpReport ─── compte rendu au médecin traitant
 ├── Document ─── fichier dans Cloud Storage (patients/<id>/<uuid>.<ext>)
 └── Task
AuditLog ─── qui, quoi, quand, sur quel patient
```

Rien n'est verrouillé : une séance passée se corrige comme celle du jour, le journal d'accès garde la trace. Une rubrique modifiée le même jour (ou dans la même séance) met à jour sa version du jour ; un autre jour, elle en crée une nouvelle.

---

## 5. Authentification et sécurité

- **Connexion** : avec Google uniquement, aucun mot de passe dans l'app. L'API vérifie le jeton d'identité Google (signature, client OAuth) et exige une adresse vérifiée par Google. Seul un compte déjà enregistré et actif peut se connecter : la connexion ne crée jamais de compte (les comptes sont créés par l'admin, ou par `create-user.cjs`). À la première connexion, le compte Google (`sub`) est rattaché à l'utilisateur. La sécurité repose sur celle du compte Google : la validation en deux étapes est conseillée dans Paramètres > Sécurité.
- **Connexion de développement** : pour le développement local et les tests de bout en bout, `POST /api/v1/auth/dev-login` connecte un compte enregistré par son e-mail, avec les mêmes vérifications. La route n'existe qu'avec `DEV_LOGIN=true`, et l'API refuse de démarrer avec ce réglage hors `NODE_ENV=development`/`test` ou sur Cloud Run (staging et prod). Le formulaire n'est présent que dans le build de développement du frontend.
- **Jetons** : jeton d'accès de 15 minutes, gardé en mémoire uniquement. Session de **10 heures** depuis la connexion (une journée de travail) dans le cookie httpOnly `__session` (chemin `/api/v1/auth`). Chaque rafraîchissement fait tourner le jeton sans prolonger la session.
- **Limites de débit** : 300 requêtes/min par IP, 10/min sur la connexion (Google et connexion de développement).
- **Journal d'accès** : décorateur `@Audited` + intercepteur global ; consultation et modification des dossiers, connexions. Visible par l'admin (page Journal d'accès) et sur chaque dossier.
- **En-têtes** : helmet côté API ; CSP, X-Frame-Options, nosniff côté nginx. Les réponses `/api` sont `no-store`.
- **Secrets** : uniquement dans Secret Manager (prod/staging) ou `.env` (local). Aucune clé de compte de service (interdit par une règle d'organisation). Tous les secrets ont été renouvelés le 2026-11-20 après l'incident du 16 octobre.
- **RGPD** : minimisation, consentements tracés, accès réservé à la praticienne du patient, journal des accès.

---

## 6. Déploiement et façon de travailler

### Branches et PR

- Une branche par sujet (`feat/…`, `fix/…`, `chore/…`, `docs/…`) depuis `staging`, PR vers `staging`.
- La CI (lint, types, tests avec seuils de couverture, build) doit passer avant le merge.
- Fusionner `staging` dans `prod` déploie en production (l'environnement GitHub `production` demande une approbation).
- Plusieurs PR fusionnées à la suite : ajouter `[skip ci]` au message de merge de toutes sauf la dernière, pour ne lancer qu'un déploiement.
- Commits : [Conventional Commits](https://www.conventionalcommits.org/) en minuscules (`feat(patients): …`), vérifiés par commitlint.

### CD (`cd.yml`)

Sur push vers `staging` ou `prod` : build des images modifiées (API, frontend), push dans Artifact Registry, migrations Prisma (job Cloud Run), puis déploiement des services. Authentification à GCP par Workload Identity Federation (pas de clé).

### Infrastructure

- Terraform est appliqué **en local par le propriétaire** (pas depuis la CI) ; la CD ne fait que déployer des images. Détails : [infra/terraform/README.md](../infra/terraform/README.md).
- `infra/bootstrap/bootstrap.sh` crée ce que Terraform suppose déjà là (APIs, secrets, comptes de service, WIF).
- Créer un compte sur un environnement : `apps/api/prisma/create-user.cjs`, lancé via le job de migration (voir le README Terraform).

---

## 7. Où en est le projet

### Fait

- Rôles et navigation séparés admin / praticienne.
- Dossier patient complet : mesures, IMC et MB, dossier médical avec historique, faits marquants, séances, brief.
- Tableau de bord et agenda semaine / jour / liste.
- Documents dans Cloud Storage avec aperçu.
- Journal d'accès.
- Connexion avec Google uniquement.
- API accessible uniquement par le frontend.
- Domaine personnalisé pour staging.
- Région Paris, coupure budgétaire.
- Dépendances sans vulnérabilité connue.

### À faire

1. **Rotation du secret du client OAuth** Google (côté propriétaire ; l'app n'utilise que l'identifiant client, rien à changer dans le code).
2. **Mise en production** :
   - `ENVS=prod` pour le bootstrap ;
   - `terraform apply` avec `env=prod` ;
   - CNAME `app.dietetiquecenter.fr` → `vp-dietetic-prod.web.app` chez LWS ;
   - origine ajoutée au client OAuth ;
   - comptes créés avec `create-user.cjs` ;
   - merge `staging` → `prod`.
3. **Refonte métier et UX** : dossier calqué sur la façon de travailler de la praticienne, facturation, paramètres réels, création guidée, charte visuelle. Plan et lots dans [REFONTE.md](REFONTE.md).
4. **Qualité** :
   - couverture de tests du frontend très faible (seuils ~4-7 %, à remonter au fil des ajouts) ;
   - les tests Playwright datent de l'ancienne interface (pages notes) et ne tournent pas en CI.
5. **Plus tard** :
   - refaire le site vitrine en site statique sur un bucket ;
   - quitter LWS pour le domaine ;
   - rappels de rendez-vous si besoin.

---

## 8. Variables d'environnement

Les modèles commentés sont dans `apps/api/.env.example` et `apps/frontend/.env.example`. En staging/prod, Terraform les fournit aux services Cloud Run, et les valeurs sensibles viennent de Secret Manager : `DATABASE_URL`, `JWT_SECRET`, `PROXY_TOKEN`, `GOOGLE_CLIENT_ID`.
