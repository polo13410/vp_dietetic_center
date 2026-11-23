# Plan directeur — VP Dietetic Center

> Référence pour toute personne (ou agent) qui travaille sur le projet : ce que fait l'app, comment elle est construite et déployée, ce qui reste à faire.
> Mis à jour le 2026-11-24, après la refonte métier et UX ([REFONTE.md](REFONTE.md), lots 0 à 10 et 12 à 16). La charte visuelle est dans [DESIGN.md](DESIGN.md).

---

## 1. Produit

Application web pour une **diététicienne / psycho-nutritionniste** en libéral, pensée sur iPad (paysage) et ordinateur. Elle remplace sa feuille Numbers (un onglet par patient : récapitulatif, dossier médical, suivi des séances, facture) : suivre ses patients d'une séance à l'autre, se remémorer leur histoire avant de commencer, faire ses factures et ses comptes rendus au médecin, avec un dossier fiable et protégé (données de santé, RGPD).

### Rôles

| Rôle          | Ce qu'il fait                                                                                                         |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ADMIN`       | Gère l'application et les comptes, consulte le journal d'accès. **Ne voit aucune donnée patient.**                      |
| `PRATICIENNE` | Travaille avec **ses** patients uniquement : dossier, séances, rendez-vous, factures, organismes, comptes rendus, documents, tâches. |
| `ASSISTANTE`  | Lit la fiche administrative de tous les patients (identité, contact, situation) et gère les rendez-vous de toutes les praticiennes. Jamais le dossier médical, les séances, les factures ni les comptes rendus. |

Le contrôle d'accès est centralisé dans `PatientAccessService` (API) : chaque requête sur un patient vérifie qui le demande et à quel niveau (`record` ou `full`).

### Navigation

- **Praticienne** : Accueil · Patients · Agenda · Factures · Paramètres
- **Assistante** : Accueil · Patients · Agenda · Paramètres
- **Admin** : Utilisateurs · Journal d'accès · Paramètres

Une recherche globale (patients, rendez-vous, séances) est dans l'en-tête. Séances, mesures, documents, tâches et comptes rendus n'ont pas de page de liste à eux : ils vivent dans le dossier du patient.

### Calculs (jamais stockés)

Formules de sa feuille, calculées par l'API ([REFONTE.md](REFONTE.md) § 3.1) : IMC = poids / taille², MB de Black et al. (MJ et kcal). La taille utilisée est la dernière connue **à la date** de la mesure ou de la séance ; l'âge est calculé à la date de chaque séance (ou déclaré : « 56 ans, âge déclaré »). Avant 18 ans, l'IMC est placé sur les courbes de corpulence IOTF, sans les catégories adultes, et le MB porte la mention « formule adulte ». S'il manque le sexe, l'âge ou la taille, l'interface dit quoi ajouter.
Cas de test (dans le seed, les tests unitaires et les tests de bout en bout) : femme, 56 ans, 1,59 m, 79 kg → IMC 31,25 · MB 5,86 MJ · 1 400,3 kcal.

### Dossier patient

Six onglets :

| Onglet            | Contenu                                                                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Récapitulatif     | **En lecture seule.** Identité, chiffres clés (poids, IMC, MB, écart depuis le bilan), courbe de poids avec les faits marquants, dernière séance et ses conseils, aversions et goûts, allergies, prise en charge, tâches, comptes rendus au médecin. Chaque bloc a un lien « Modifier » vers l'onglet qui possède la donnée. |
| Dossier médical   | Ses rubriques dans son ordre (santé, antécédents familiaux, psy, activité physique, histoire du poids, allergies, glycémie, cholestérol, aversions, goûts), modifiées sur place avec enregistrement automatique ; chaque rubrique garde son historique daté. Identité, contact et situation se modifient ici aussi. |
| Mesures           | Une frise du plus récent au plus ancien : poids, taille, mesures complémentaires, faits marquants. Une mesure s'ajoute à n'importe quelle date (même avant le suivi), avec une note ; chaque ligne se corrige ou se supprime. Courbes de poids, de taille et, avant 18 ans, de corpulence. |
| Suivi             | Le tableau des séances comme sa feuille (Bilan, Suivi 1, 2… ; date, formule, paiement, poids, IMC, MB) ; une ligne se déplie pour lire les textes, la toucher ouvre la séance. Tâches du patient. |
| Factures          | Prise en charge par un organisme, factures et avoirs du patient, total.                                                                          |
| Documents         | Fichiers (PDF, images, documents bureautiques, liste blanche de formats, 10 Mo max), aperçu dans le navigateur.                                  |

Le menu « … » de l'en-tête donne l'historique des accès au dossier, l'export du dossier en PDF et l'archivage. Un patient archivé sort de la liste (filtre « Archivés »).

**Création** : un assistant en cinq étapes (qui est-ce ?, le joindre, sa situation, dossier médical, c'est prêt). Le patient est créé dès la première étape (prénom et nom suffisent) ; les suivantes peuvent être passées. Depuis l'agenda, une version courte crée le patient sans quitter la prise de rendez-vous.

### Séance

- **Temps 1, « Avant de commencer »** : le récapitulatif en pleine page pour se remémorer l'histoire du patient, puis « Commencer la séance ».
- **Temps 2, la séance** : le récapitulatif devient un panneau « Rappel » sur le côté (tiroir en iPad portrait), et les champs dans l'ordre de sa feuille : date, formule (pré-remplie Bilan ou Suivi), cabinet, moyen de paiement, remise ; poids avec IMC et MB aussitôt calculés et les écarts ; habitudes et évolution (avec les conseils de la séance précédente au-dessus) ; travail en consultation ; aversions et goûts ; conseils diététiques ; mesures complémentaires, faits marquants et autres rubriques du dossier.
- Enregistrement automatique partout. « Terminer la séance » ramène au dossier et propose « Faire la facture » et « Prendre le prochain rendez-vous ».
- Rien n'est verrouillé : une séance passée se rouvre (directement au temps 2) et se corrige comme celle du jour. Démarrer une séance depuis un rendez-vous le passe à « terminé » et reprend son type et son cabinet.

### Factures, avoirs et tiers payant

- Une facture par séance, **émise seulement quand elle clique** « Faire la facture ». Numérotation continue par praticienne et par année, sans trou (`2026-0001`), attribuée dans une transaction ; les avoirs ont leur série (`A-2026-0001`). Une facture émise garde une copie des infos du cabinet et du patient, et un déclencheur en base refuse de la modifier ou de la supprimer.
- **Corriger** : si la séance ne correspond plus à sa facture (tarif, remise, paiement, date, cabinet, prise en charge), un bandeau le dit et « Corriger la facture » émet un avoir et une nouvelle facture liés entre eux. « Annuler la facture » émet un avoir ; supprimer une séance facturée aussi. Factures annulées et avoirs restent visibles, exclus des totaux.
- **Remise** en euros ou en %, avec un motif, pré-remplie avec celle de la séance précédente. Une remise de 100 % = séance offerte, sans facture.
- **Organismes** (mutuelle, employeur, association…) : nom, adresse, contact, référence de convention, rythme de facturation (tous les mois, tous les N mois, à la demande). Une **prise en charge** d'un patient : organisme, part en euros ou en % par séance, nombre de séances et période facultatifs. La facture du patient ne porte que sa part (« dont X € pris en charge par… ») ; l'organisme reçoit une facture groupée par période, dans la même série de numéros, sans rien de médical, suivie « en attente » jusqu'à « réglée le … ».
- Page **Factures** : liste par période, totaux par moyen de paiement et par payeur (patients, organismes), export CSV pour le comptable ; onglet **Organismes** (prochaine période à facturer, « Préparer la facture », règlements).
- PDF faits dans le navigateur (`@react-pdf/renderer`), comme le compte rendu et l'export du dossier.

### Cabinets et types de rendez-vous

- **Mon activité** (Paramètres) : nom affiché sur les factures, SIRET, ADELI ou RPPS, mention TVA, pied de facture.
- **Mes cabinets** : elle peut consulter dans plusieurs cabinets (nom, adresse, téléphone, SIRET s'il diffère) ; un est le cabinet par défaut. La facture porte l'adresse du cabinet de la séance.
- **Mes tarifs** = les types de rendez-vous : libellé, prix, durée (ex. Bilan 60 €, 1 h ; Suivi 50 €, 45 min). Deux formules sont créées pour chaque nouvelle praticienne.
- **Prise de rendez-vous** en trois choix : patient, type (qui donne la durée, modifiable), créneau. Le cabinet n'est demandé que s'il y en a plusieurs.

### Compte rendu au médecin traitant

« Rédiger un compte rendu » prépare un brouillon **pré-rempli à partir du dossier** (sans IA) : en-tête du cabinet, patient et motif, suivi, évolution du poids, de l'IMC et du MB, rubriques renseignées, travail mené et conseils des dernières séances, formule de politesse. Elle le modifie librement (enregistrement automatique), le télécharge en PDF sur l'en-tête de son activité, puis le marque comme envoyé. Le récapitulatif affiche « Compte rendu : à faire » ou « envoyé le … ».

### Accueil et agenda

- **Accueil** : les rendez-vous du jour (« Démarrer la séance » ou « Rouvrir »), les patients à relancer (sans séance depuis 6 semaines), les factures à faire, les organismes (périodes à facturer, factures en attente depuis plus de 60 jours) et les tâches.
- **Agenda** : semaine (7 jours) / jour / liste sur une grille horaire ; toucher un créneau libre prend un rendez-vous à cette heure. Chaque rendez-vous montre son type et, s'il y en a plusieurs, son cabinet.

### Paramètres

Mon profil · Mon activité · Mes cabinets · Mes tarifs · Sécurité (information sur la connexion Google et la validation en deux étapes) · Apparence (clair, sombre, comme l'appareil). Tout est enregistré en base, automatiquement.

### Décisions produit

- Connexion avec Google uniquement, sans mot de passe (2026-11-23). L'app n'envoie aucun e-mail ; pas de rappels de rendez-vous.
- Plusieurs praticiennes possibles, chacune ne voit que ses patients ; les infos du cabinet sont en base, par praticienne.
- Les factures sont conservées même si la séance ou le patient est supprimé (obligation comptable de 10 ans).
- Budget d'hébergement visé : 16 CHF/mois maximum.
- Écarté après observation de sa pratique : objectifs à cocher, échelles 1–10, thématiques génériques, tags et statuts patients, notifications ([REFONTE.md](REFONTE.md) § 2.1).

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
| Frontend    | React 19, Vite, TypeScript, React Router, TanStack Query, zustand, React Hook Form + zod, Tailwind CSS 4, shadcn/ui (Radix), Recharts, date-fns, `@react-pdf/renderer` |
| API         | Node.js 24, NestJS 11, Prisma 6, PostgreSQL 15, Passport (JWT), google-auth-library, class-validator, helmet, throttler, pino, Swagger |
| Tests       | Vitest (API, avec des tests sur une vraie base ; frontend avec Testing Library), Playwright (parcours de bout en bout) |
| Monorepo    | pnpm workspaces + Turborepo ; `packages/types` (types partagés), `packages/config` (ESLint, TS)          |
| Infra       | Terraform (`infra/terraform`), script d'amorçage (`infra/bootstrap`), coupure budgétaire (`infra/budget-cutoff`) |
| CI/CD       | GitHub Actions (`ci.yml`, `cd.yml`), actions épinglées par SHA                                            |

---

## 4. Modèle de données

```
User ─── rôle, préférences (thème), sessions (RefreshToken)
 ├── PractitionerProfile ─── son activité (nom, SIRET, ADELI/RPPS, mention TVA, pied de facture)
 ├── Practice ─── ses cabinets (adresse, SIRET facultatif, par défaut, archivé)
 ├── Formula ─── ses tarifs = types de rendez-vous (libellé, prix, durée, ordre, archivé)
 └── Payer ─── organismes qui prennent en charge (rythme de facturation, archivé)
Patient ─── appartient à une praticienne ; sexe, âge déclaré, situation, médecin traitant, archivedAt, consentements (Consent)
 ├── Appointment ─── rendez-vous (formule, cabinet, lieu, statut)
 │    └── Consultation ─── séance : copie de la formule et du prix, cabinet, paiement, remise,
 │                         répartition patient / organisme, textes ; liée ou non au rendez-vous
 ├── Measurement ─── une valeur par type (MetricType) et par date, note, liée ou non à une séance
 ├── FileEntry ─── une version d'une rubrique du dossier médical (FileField)
 ├── LifeEvent ─── fait marquant (catégorie facultative)
 ├── PatientCoverage ─── prise en charge par un organisme (montant ou %, séances, période)
 ├── GpReport ─── compte rendu au médecin traitant (brouillon, envoyé)
 ├── Document ─── fichier dans Cloud Storage (patients/<id>/<uuid>.<ext>)
 └── Task
Invoice ─── facture ou avoir, au patient ou à un organisme ; numéro, copies du cabinet et du
            destinataire, liens avoir / remplacement ; garde ses données si la séance disparaît
 └── InvoiceLine ─── séances d'une facture d'organisme (copies)
AuditLog ─── qui, quoi, quand, sur quel patient
```

- Une rubrique modifiée le même jour (ou dans la même séance) met à jour sa version du jour ; un autre jour, elle en crée une nouvelle.
- Les factures et leurs lignes sont protégées par des déclencheurs PostgreSQL (`invoice_guard`, `invoice_line_guard`) : seul le seed peut les supprimer, en levant explicitement la protection.
- Le seed (`apps/api/prisma/seed.ts`) crée trois comptes, l'activité, deux cabinets, deux formules, un organisme et sept patients réalistes dont Martine Roux (le cas de test) et Hugo, 10 ans (courbes de croissance). Les dates sont relatives au jour où on le lance.

---

## 5. Authentification et sécurité

- **Connexion** : avec Google uniquement, aucun mot de passe dans l'app. L'API vérifie le jeton d'identité Google (signature, client OAuth) et exige une adresse vérifiée par Google. Seul un compte déjà enregistré et actif peut se connecter : la connexion ne crée jamais de compte (les comptes sont créés par l'admin, ou par `create-user.cjs`). À la première connexion, le compte Google (`sub`) est rattaché à l'utilisateur. La sécurité repose sur celle du compte Google : la validation en deux étapes est conseillée dans Paramètres > Sécurité.
- **Connexion de développement** : pour le développement local et les tests de bout en bout, `POST /api/v1/auth/dev-login` connecte un compte enregistré par son e-mail, avec les mêmes vérifications. La route n'existe qu'avec `DEV_LOGIN=true`, et l'API refuse de démarrer avec ce réglage hors `NODE_ENV=development`/`test` ou sur Cloud Run (staging et prod). Le formulaire n'est présent que dans le build de développement du frontend.
- **Jetons** : jeton d'accès de 15 minutes, gardé en mémoire uniquement. Session de **10 heures** depuis la connexion (une journée de travail) dans le cookie httpOnly `__session` (chemin `/api/v1/auth`). Chaque rafraîchissement fait tourner le jeton sans prolonger la session.
- **Limites de débit** : 300 requêtes/min par IP, 10/min sur la connexion (Google et connexion de développement).
- **Journal d'accès** : décorateur `@Audited` + intercepteur global ; consultation et modification des dossiers, exports (PDF, CSV, documents), connexions. Visible par l'admin (page Journal d'accès) et sur chaque dossier.
- **En-têtes** : helmet côté API ; CSP (avec `'wasm-unsafe-eval'` pour le moteur de mise en page des PDF, jamais `'unsafe-eval'`), X-Frame-Options, nosniff côté nginx. Les réponses `/api` sont `no-store`.
- **Secrets** : uniquement dans Secret Manager (prod/staging) ou `.env` (local). Aucune clé de compte de service (interdit par une règle d'organisation). Tous les secrets ont été renouvelés le 2026-11-20 après l'incident du 16 octobre.
- **RGPD** : minimisation (seulement ce qui sert à son suivi), consentements tracés, accès réservé à la praticienne du patient, journal des accès.

---

## 6. Déploiement et façon de travailler

### Branches et PR

- Une branche par sujet depuis `staging`, PR vers `staging`.
- La CI doit passer avant le merge.
- Fusionner `staging` dans `prod` déploie en production (l'environnement GitHub `production` demande une approbation).
- Plusieurs PR fusionnées à la suite : ajouter `[skip ci]` au message de merge de toutes sauf la dernière, pour ne lancer qu'un déploiement (la suivante rattrape les changements, voir plus bas).
- Commits : [Conventional Commits](https://www.conventionalcommits.org/) en minuscules (`feat(patients): …`), vérifiés par commitlint.

### CI (`ci.yml`, sur chaque PR vers `staging` ou `prod`)

| Job                    | Ce qu'il fait                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Lint + Typecheck + Test + Build | ESLint, TypeScript, migrations appliquées à une base vide, tests Vitest avec couverture et seuils (API avec les tests sur base), build |
| End-to-end tests       | PR vers `staging` : Playwright (Chromium) sur les parcours réels, contre l'API et Vite, sur une base reconstruite depuis les migrations et le seed |
| Terraform fmt + validate | Format et validité de `infra/terraform`, sans accès à Google Cloud                                             |

Les tests de bout en bout (`apps/frontend/e2e/`) couvrent : création d'un patient avec l'assistant, prise de rendez-vous par type, bilan avec les chiffres du cas de test, facture émise et téléchargée, correction du tarif d'une ancienne séance (avoir + nouvelle facture), poids ancien dans Mesures, brouillon de compte rendu au médecin.

### CD (`cd.yml`, sur push vers `staging` ou `prod`)

1. **Détection des changements** : comparaison avec le commit du dernier déploiement réussi de la branche (pas avec le push précédent), pour que les merges en `[skip ci]` soient rattrapés et qu'un déploiement raté soit refait. `apps/api/` → API, `apps/frontend/` → frontend ; `packages/`, `package.json`, le lockfile, `pnpm-workspace.yaml`, `turbo.json` ou `.dockerignore` → les deux. Sans base utilisable (premier déploiement, historique réécrit) ou en lancement manuel : tout.
2. **API** : image construite et poussée dans Artifact Registry, migrations Prisma par le job Cloud Run `<env>-api-migrate` avec la nouvelle image, puis déploiement du service et vérification de `/api/v1/health`.
3. **Frontend** : après l'API (si elle a été déployée), image construite et déployée, vérification de la page et de `/api/v1/health` à travers le proxy.

Authentification à Google Cloud par Workload Identity Federation (pas de clé). Le compte de déploiement ne peut que pousser des images et mettre à jour les services et jobs existants.

### Infrastructure

- Terraform est appliqué **en local par le propriétaire** (pas depuis la CI) ; la CD ne fait que déployer des images. Détails : [infra/terraform/README.md](../infra/terraform/README.md).
- `infra/bootstrap/bootstrap.sh` crée ce que Terraform suppose déjà là (APIs, secrets, comptes de service, WIF).
- Créer un compte sur un environnement : `apps/api/prisma/create-user.cjs`, lancé via le job de migration (voir le README de l'API).

---

## 7. Où en est le projet

### Fait

- Refonte métier et UX terminée ([REFONTE.md](REFONTE.md), lots 0 à 10 et 12 à 16) : charte visuelle, modèle de données tiré de sa feuille, paramètres réels, dossier en six onglets avec onglet Mesures et règles des moins de 18 ans, création guidée, séance en deux temps, factures avec avoirs, remises et tiers payant, plusieurs cabinets et types de rendez-vous, accueil, compte rendu au médecin, connexion Google seule.
- Nettoyage, tests de bout en bout en CI, seuils de couverture remontés, documentation à jour (lot 9).
- Documents dans Cloud Storage avec aperçu, journal d'accès, API accessible uniquement par le frontend.
- Staging en ligne sur son domaine, région Paris, coupure budgétaire.

### À faire

1. **Recette avec Valérie** ([REFONTE.md](REFONTE.md), lot 11) : compte de démonstration sur staging, parcours sans aide sur son iPad, questions encore ouvertes (§ 5), liste d'ajustements classés qui devient le plan suivant.
2. **Rotation du secret du client OAuth** Google (côté propriétaire ; l'app n'utilise que l'identifiant client, rien à changer dans le code).
3. **Mise en production** :
   - `ENVS=prod` pour le bootstrap ;
   - `terraform apply` avec `env=prod` ;
   - CNAME `app.dietetiquecenter.fr` → `vp-dietetic-prod.web.app` chez LWS ;
   - origine ajoutée au client OAuth ;
   - comptes créés avec `create-user.cjs` ;
   - activité, cabinets et tarifs saisis dans Paramètres ;
   - mention TVA, numérotation et avoirs validés avec son comptable ;
   - merge `staging` → `prod`.
4. **Plus tard** :
   - rédaction du compte rendu assistée par IA (à cadrer avant : données pseudonymisées, hébergement dans l'UE, information du patient, question de l'HDS) ;
   - envoi des factures par e-mail si elle le demande (la connexion Google seule a retiré l'envoi d'e-mails) ;
   - refaire le site vitrine en site statique sur un bucket, quitter LWS pour le domaine.

---

## 8. Variables d'environnement

Les modèles commentés sont dans `apps/api/.env.example` et `apps/frontend/.env.example`. En staging/prod, Terraform les fournit aux services Cloud Run, et les valeurs sensibles viennent de Secret Manager : `DATABASE_URL`, `JWT_SECRET`, `PROXY_TOKEN`, `GOOGLE_CLIENT_ID`. Le frontend ne lit que `VITE_GOOGLE_CLIENT_ID`, fourni au build par la CD.

Tests : `TEST_DATABASE_URL` (tests de l'API sur une vraie base, migrée, dédiée aux tests ; sans elle, ces tests sont sautés) et `E2E_DATABASE_URL` (tests de bout en bout, base reconstruite à chaque lancement ; par défaut `vp_e2e` en local).
