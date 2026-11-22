# Refonte métier et UX — plan d'action

> Plan rédigé le 2026-11-22 pour être découpé en lots confiés à des agents.
> Chaque lot est autonome : contexte métier, décisions déjà prises, ce qu'il faut livrer, critères de fin.
> Les **contrats partagés** (§ 3) sont fixés ici et ne se rediscutent pas dans un lot : plusieurs lots en dépendent.
> Pour le reste (structure du code, découpage en composants, nommage), l'agent décide en suivant les conventions du dépôt.

---

## 1. Pourquoi cette refonte

L'app est techniquement prête (staging, CI/CD, tests). Elle a été construite à partir d'une idée générale du métier, pas de la façon dont **Valérie Pera** travaille réellement. Aujourd'hui elle suit chaque patient dans une feuille Numbers sur iPad :

| Onglet          | Contenu                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Récapitulatif   | Patient, téléphone, e-mail, situation familiale, profession, médecin traitant, compte rendu (« À faire »)                       |
| Dossier médical | Âge, sexe, poids, taille, constante, IMC, MB (MJ/jour), MB (kcal/jour), santé/maladie, ATCD familiaux, psy, activité physique et sportive, histoire du poids et régimes, allergies, glycémie, cholestérol et TG |
| Suivi           | Une ligne par séance (Bilan, Suivi 1, Suivi 2…) : date, formule (prix), moyen de paiement, poids, IMC, MB (MJ), MB (kcal), habitudes et évolution, travail en consultation, aversions, goûts, conseils diététiques |
| Facture         | Total des séances                                                                                                             |

Ce qui ne va pas dans l'app :

- **Le dossier ne parle pas sa langue** : thématiques, objectifs, événements de vie, 10 types de mesures (énergie, stress, faim sur 10…) au lieu de ses champs à elle.
- **Paramètres entièrement factices** : rien n'est enregistré, valeurs en dur (« Dr. Sarah Johnson »), 2FA, langue, taille de police… qui n'existent pas.
- **Pas de facturation.**
- **Séance verrouillée après « Finaliser »** : impossible de corriger une faute ou de compléter une note.
- **Pas de dimanche (ni de samedi) dans la vue semaine** de l'agenda : les week-ends sont masqués quand ils sont vides (`AppointmentsPage.tsx`, `shownDays`), donc on ne peut pas y créer de rendez-vous.
- **Trop dense pour le public visé** : texte en `text-sm`/`text-xs` presque partout (≈ 325 occurrences), 9 onglets sur la fiche patient, formulaires en une longue colonne, couleur principale indigo sans lien avec le logo.
- **Incohérences** : largeurs de page différentes (`max-w-2xl` à `max-w-7xl`, centrées ou non : la fiche patient et le détail RDV sont collés à gauche), quatre façons différentes de dessiner une carte (`Block`, `Section`, `Panel`, `InfoCard`, plus `Card`), couleurs Tailwind codées en dur un peu partout.

## 2. Principes pour toute la refonte

Les utilisatrices sont des soignantes, pas des informaticiennes. Elles se perdent vite dans une app chargée.

1. **Ses mots, son ordre.** Les libellés et l'ordre des champs reprennent ceux de la feuille de Valérie.
2. **Rien n'est verrouillé.** Tout ce qui a été saisi reste modifiable et supprimable (avec confirmation pour supprimer). La traçabilité est assurée par le journal d'accès existant, pas par des verrous. Seule exception : une facture émise (obligation légale, voir lot 5).
3. **Enregistrement automatique** des textes et des valeurs, avec un indicateur visible (« Enregistré à 14 h 32 »). Pas de bouton « Enregistrer » à chercher, sauf dans les assistants de création.
4. **Une action principale par écran**, en gros bouton coloré. Les actions secondaires sont plus discrètes.
5. **Le plus utile d'abord, le reste replié.** Les outils hérités (objectifs, événements de vie, mesures complémentaires) restent disponibles dans une section « Pour aller plus loin » repliée : Valérie les découvrira peut-être, mais ils ne doivent pas encombrer.
6. **iPad et ordinateur.** iPad (paysage surtout, portrait toléré) pendant la consultation, ordinateur pour l'administratif. Cibles tactiles ≥ 44 px, rien qui ne marche qu'au survol (pas d'info uniquement en `title`), le clavier virtuel ne doit pas masquer le champ actif.
7. **Des états vides qui guident** : illustration ou icône colorée + une phrase + le bouton qui fait avancer (« Aucune séance pour l'instant — Démarrer le bilan »).

## 3. Contrats partagés

### 3.1 Calculs (API, jamais stockés)

- **IMC** = poids (kg) / taille (m)². Catégories inchangées (`apps/api/src/modules/patient-file/bmi.ts`).
- **MB (formule de Black et al.)**, en MJ/jour : `k × poids^0,48 × taille(m)^0,50 × âge^-0,13`, avec `k = 0,963` (femme) ou `1,083` (homme). C'est la « constante » de sa feuille (affichée arrondie à 0,96).
- **MB en kcal/jour** = MB (MJ) × 1000 / 4,185 (c'est le facteur qu'utilise sa feuille, vérifié sur ses chiffres).
- Âge = âge du patient à la date de la séance. Taille = dernière taille connue.
- Si sexe, date de naissance ou taille manquent : pas de calcul, et l'interface dit ce qui manque (« Ajoutez la taille pour calculer l'IMC »).
- **Cas de test obligatoire** (tiré de sa feuille) : femme, 56 ans, 1,59 m, 79 kg → IMC 31,25 · MB 5,86 MJ · 1 400,3 kcal. Puis 78,2 kg → 5,83 MJ · 1 393,5 kcal ; 76,5 kg → 5,77 MJ · 1 378,9 kcal.

### 3.2 Modèle de données cible

La prod n'existe pas encore et le staging ne contient aucune donnée réelle : **les migrations peuvent être destructives**, pas de reprise de données à prévoir. Le seed (`apps/api/prisma/seed.ts`) doit être mis à jour avec des données réalistes (dont le cas de test ci-dessus).

**Patient** — ajouter :

| Champ (Prisma)            | Libellé                       | Type                        |
| ------------------------- | ----------------------------- | --------------------------- |
| `sex`                     | Sexe                          | enum `F` / `M`, facultatif  |
| `familySituation`         | Situation familiale           | texte                       |
| `profession`              | Profession                    | texte court                 |
| `gpName`                  | Médecin traitant              | texte court                 |
| `gpReportStatus`          | Compte rendu au médecin       | enum `TODO` / `SENT` / `NOT_NEEDED`, facultatif |
| `healthHistory`           | Santé, maladies               | texte                       |
| `familyHistory`           | Antécédents familiaux         | texte                       |
| `psychology`              | Psy                           | texte                       |
| `physicalActivity`        | Activité physique et sportive | texte                       |
| `weightHistory`           | Histoire du poids et régimes  | texte                       |
| `bloodGlucose`            | Glycémie                      | texte                       |
| `cholesterolTriglycerides`| Cholestérol et triglycérides  | texte                       |
| `archivedAt`              | (patient archivé)             | date, remplace `status`     |

Garder : identité, contact, adresse, `allergies`, `dietaryRestrictions`, `consultationReason`, contact d'urgence, `privateNote`, `referralSource`, consentements.
Supprimer : `status` (+ enum `PatientStatus`), `Tag`, `PatientTag`.
Glycémie et cholestérol restent du texte libre (valeur + date, comme elle le fait aujourd'hui).
La **taille** reste une mesure `HEIGHT` (table `Measurement`), saisie depuis le dossier.

**Consultation (séance)** — devient la ligne de son « Suivi » :

| Champ                 | Libellé                    | Type                                                                 |
| --------------------- | -------------------------- | -------------------------------------------------------------------- |
| `date`                | Date                       | existant                                                             |
| `formulaId`           | Formule                    | réf. vers `Formula` (lot 2), facultatif                              |
| `formulaLabel`, `priceCents` | (copie au moment de la séance) | le prix ne change pas si le tarif change ensuite             |
| `paymentMethod`       | Moyen de paiement          | enum `CASH` / `CHECK` / `CARD` / `TRANSFER` / `NONE` (« Non réglé ») |
| `habits`              | Habitudes et évolution     | texte                                                                |
| `sessionWork`         | Travail en consultation    | texte (remplace `summary`)                                           |
| `aversions`           | Aversions                  | texte                                                                |
| `tastes`              | Goûts                      | texte                                                                |
| `advice`              | Conseils diététiques       | existant                                                             |

Le **poids** de la séance reste une mesure `WEIGHT` liée à la séance (`consultationId`), ce qui garde les graphiques existants. L'API renvoie pour chaque séance : poids, IMC, MB (MJ), MB (kcal), et l'écart avec la séance précédente.
Supprimer : `status`, `finalizedAt`, enum `ConsultationStatus`, et toute la logique de verrouillage (`assertDraftSession`, contrôles `FINALIZED` dans `patient-file.service.ts` et `consultations.service.ts`, route `/finalize`). Créer une séance depuis un rendez-vous passe ce rendez-vous à `COMPLETED`.

**Thématiques** (`TopicNote`, `PatientTopic`) : supprimées. Elles font doublon avec les champs du dossier (activité, santé, psy…) et les textes de séance (habitudes, goûts…).

**Gardés en « Pour aller plus loin »** (code existant, juste repliés dans l'interface) : objectifs (`Goal`, `GoalReview`), événements de vie (`LifeEvent`), mesures complémentaires (tour de taille, hanches, masse grasse, masse musculaire). Les échelles 1–10 (énergie, sommeil, stress, faim) sont supprimées.

**Notifications** : supprimées (modèle, module API, centre de notifications, appels depuis `appointments.service.ts` et `tasks.service.ts`).

**Tâches** et **documents** : gardés tels quels.

### 3.3 Charte visuelle

Le lot 1 la pose dans `docs/DESIGN.md` et dans le code ; tous les lots d'interface l'appliquent ensuite. Points fixés :

- **Couleurs tirées du logo** (`apps/frontend/public/logo_full_transparent.png`) : vert sauge/feuille en couleur principale, turquoise du « VP » en secondaire, vert poire en accent doux. Fini l'indigo. Contraste AA minimum.
- **Une couleur par grand espace**, reprise dans la barre latérale, les titres de page et les icônes : par exemple Patients, Agenda, Factures. Elle aide à savoir où l'on est.
- **Texte de base 16 px** (`text-base`) ; `text-sm` pour le secondaire ; `text-xs` réservé aux mentions techniques.
- **Une seule largeur de page, centrée**, pour toutes les pages (y compris fiche patient et détail RDV), avec une variante large pour l'agenda et la séance.
- **Un seul composant par usage** : `PageHeader` (retour, titre, sous-titre, actions), `Section` (carte avec icône colorée + titre + action), `Field` (libellé, aide, mention « obligatoire », erreur), `EmptyState`, `Stepper` (assistants), `StatusBadge` à couleurs sémantiques via des variables CSS (plus de `bg-blue-100` en dur).
- **La mascotte poire** du logo peut illustrer les états vides, l'accueil et la fin des assistants (déclinaisons simples, pas d'images lourdes).
- Le mode sombre est gardé mais doit suivre la nouvelle palette.

---

## 4. Les lots

Ordre et dépendances :

```
Lot 0  Agenda 7 jours ─────────────────────────────── (indépendant, tout de suite)
Lot 1  Charte visuelle + composants ─┐
Lot 2  Modèle de données + API ──────┼─► Lot 3 Paramètres ─► Lot 5 Facturation
                                     ├─► Lot 4 Fiche patient ─► Lot 6 Nouveau patient
                                     │                        └► Lot 7 Séance
                                     └─► Lot 8 Accueil + pages restantes
Lot 9  Nettoyage, tests de bout en bout, documentation (à la fin)
```

Lots 1 et 2 peuvent avancer en parallèle : le lot 1 ne touche que `components/ui`, `components/layout`, les styles et de nouveaux composants partagés ; le lot 2 que l'API, Prisma, `packages/types` et les adaptations minimales du frontend pour que tout compile.

Chaque lot : une branche depuis `staging`, une PR vers `staging`, CI verte, tests ajoutés pour ce qui est nouveau, captures d'écran iPad paysage + ordinateur dans la PR pour les lots d'interface.

### Lot 0 — Agenda : afficher toute la semaine

- La vue semaine affiche les 7 jours, lundi → dimanche, même vides, et on peut créer un rendez-vous en cliquant sur n'importe quel jour.
- Retirer le filtre `shownDays` de `apps/frontend/src/pages/appointments/AppointmentsPage.tsx`.
- Fini quand : un créneau du dimanche est cliquable en vue semaine et crée un rendez-vous à la bonne date.

### Lot 1 — Charte visuelle et composants de base

- Écrire `docs/DESIGN.md` : palette (valeurs), typographie, espacements, largeurs de page, composants et quand les utiliser, règles tactiles, ton des textes (vouvoiement, phrases courtes, pas de jargon technique).
- Poser les variables dans `apps/frontend/src/styles/globals.css` (clair et sombre).
- Créer ou unifier les composants listés en § 3.3, et un gabarit de page commun (largeur, marges, en-tête) utilisé par `AppLayout`.
- Barre latérale : libellés plus grands, icônes colorées par espace, état actif évident ; repliable sur iPad portrait.
- En-tête : retirer la cloche de notifications (le lot 2 supprime le reste). Garder la recherche globale et le choix du thème.
- **Ne pas réécrire les pages** dans ce lot (sauf ce qui casse) : les lots suivants les migrent. Faire une seule page témoin (la liste des patients) pour valider la charte.
- Fini quand : `DESIGN.md` existe, la liste des patients l'applique, les composants partagés ont des tests de rendu simples.

### Lot 2 — Modèle de données et API

- Appliquer § 3.1 et § 3.2 : schéma Prisma, une migration, DTO, services, contrôleurs, `packages/types`, seed.
- Fonctions de calcul IMC/MB pures et testées avec le cas de test de § 3.1.
- Supprimer : verrouillage et finalisation des séances, thématiques, échelles 1–10, notifications, tags, statut patient (remplacé par archiver/désarchiver).
- Côté frontend, seulement le nécessaire pour compiler et ne pas casser : retirer les écrans et appels des fonctions supprimées, renommer `summary` → `sessionWork`. Les vrais écrans arrivent aux lots 4 à 7.
- Garder le contrôle d'accès (`PatientAccessService`) et l'audit (`@Audited`) sur toutes les nouvelles routes.
- Fini quand : migration appliquée sur une base vide, seed OK, tests API verts avec seuils de couverture tenus, une séance « finalisée » n'existe plus nulle part dans le code.

### Lot 3 — Paramètres (à refaire entièrement)

Supprimer la page actuelle (`apps/frontend/src/pages/settings/SettingsPage.tsx`) : tout y est factice. La remplacer par quelques sections qui marchent vraiment, toutes enregistrées en base :

| Section         | Contenu                                                                                                  | Qui                |
| --------------- | -------------------------------------------------------------------------------------------------------- | ------------------ |
| Mon profil      | Prénom, nom, téléphone ; e-mail affiché (non modifiable ici)                                              | tous               |
| Mon cabinet     | Nom affiché sur les factures, adresse, SIRET, n° ADELI ou RPPS, mention TVA, mentions libres de bas de facture | praticienne    |
| Mes tarifs      | Liste des formules (libellé + prix), ex. « Bilan 60 € », « Suivi 50 € » ; ajouter, modifier, archiver, choisir l'ordre | praticienne |
| Sécurité        | Changer son mot de passe (si le compte en a un) ; indiquer « connexion Google » sinon                      | tous               |
| Apparence       | Clair / sombre / comme l'appareil                                                                         | tous               |

- Données : un modèle `PractitionerProfile` (1–1 avec `User`) pour le cabinet, un modèle `Formula` (praticienne, libellé, prix en centimes, ordre, archivé). Les infos du cabinet sont **en base, par praticienne**, pas dans Secret Manager (décision du 2026-11-22 : elles figurent sur chaque facture remise au patient, l'ADELI est public, et chaque praticienne a les siens).
- API : `GET/PATCH /me`, `GET/PATCH /me/practice`, CRUD `/me/formulas`, `POST /auth/change-password` (vérifie l'ancien mot de passe, ferme les autres sessions).
- Validation : SIRET 14 chiffres (avec contrôle de Luhn), ADELI 9 chiffres ou RPPS 11 chiffres.
- Nettoyer `UserPreferences` : ne garder que ce qui sert (thème si on le stocke côté serveur, sinon supprimer le modèle).
- À la création d'une praticienne, créer deux formules par défaut : « Bilan » et « Suivi » (prix vides à compléter, la page le signale).
- Fini quand : chaque champ affiché est enregistré et relu après rechargement, aucune valeur en dur, tests API et composants.

### Lot 4 — Fiche patient

Reprendre `apps/frontend/src/pages/patients/PatientDetailPage.tsx` sur le modèle de ses onglets Numbers. Passer de 9 onglets à 5 :

| Onglet            | Contenu                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Récapitulatif     | Carte identité (âge, téléphone cliquable, e-mail, situation familiale, profession, médecin traitant + statut du compte rendu), chiffres clés (poids actuel, IMC, MB, écart depuis le bilan), courbe de poids, dernière séance en bref, aversions et goûts connus (cumul des séances), allergies bien visibles |
| Dossier médical   | Ses champs (§ 3.2) dans son ordre, modifiables sur place avec enregistrement automatique ; taille et sexe ici                   |
| Suivi             | Tableau des séances comme sa feuille : n° (Bilan, Suivi 1, 2…), date, formule, paiement, poids, IMC, MB MJ, MB kcal ; une ligne se déplie pour lire les textes ; toucher une ligne ouvre la séance. Bouton « Nouvelle séance » |
| Factures          | Liste des factures du patient + total (lot 5 ; onglet masqué tant que le lot 5 n'est pas livré)                                   |
| Documents         | Existant, restylé                                                                                                             |

- « Pour aller plus loin » (replié, dans le Récapitulatif ou un menu « Plus ») : objectifs, événements de vie, mesures complémentaires, tâches, historique des accès, export PDF.
- En-tête de la fiche : nom, âge, actions principales « Nouvelle séance » (ou « Démarrer la séance du jour » s'il y a un RDV) et « Prendre rendez-vous ». « Modifier » disparaît : tout se modifie sur place.
- Archiver le patient : dans un menu secondaire, avec confirmation.
- Fini quand : on lit tout ce que contient sa feuille Numbers sur un seul écran Récapitulatif (iPad paysage, sans défiler pour l'essentiel), et on peut tout modifier sans changer de page.

### Lot 5 — Facturation

Contexte : une facture par séance. Les paiements se font hors de l'app ; l'app garde la trace et produit la facture.

- Modèle `Invoice` : praticienne, patient, séance (1–1), numéro, date d'émission, montant, moyen de paiement, et **copie** des infos du cabinet et du patient au moment de l'émission (une facture ne change pas si l'adresse change ensuite), `cancelledAt`.
- **Numérotation** : continue, par praticienne et par année, sans trou, attribuée à l'émission (`2026-0001`). Générée dans une transaction pour éviter les doublons.
- **Règle légale** : une facture émise ne se modifie pas et ne se supprime pas. Pour corriger : « Annuler et refaire » — l'ancienne est marquée annulée (elle garde son numéro), une nouvelle est émise. Si la séance est modifiée après émission (formule, prix, paiement), la séance affiche « La facture ne correspond plus » avec le bouton pour la refaire.
- Mentions : celles du cabinet (lot 3) + numéro, date, patient, prestation (formule + date de séance), montant, moyen de paiement, « Acquittée » si réglée. La mention d'exonération de TVA est saisie par la praticienne dans « Mon cabinet » (à valider avec son comptable, typiquement l'article 261-4-1° du CGI pour les diététiciens) : ne pas la coder en dur.
- PDF avec `@react-pdf/renderer` (déjà utilisé par l'export patient).
- Écrans : bouton « Facture » sur la séance (émettre / télécharger / annuler et refaire), onglet Factures de la fiche patient, et une page **Factures** (barre latérale) : liste par période, total encaissé par période et par moyen de paiement, export CSV pour le comptable.
- Fini quand : tests sur la numérotation (concurrence, annuel, sans trou), PDF lisible avec le cas de test, export CSV.

### Lot 6 — Création d'un patient guidée

Remplacer le formulaire en une colonne (`PatientForm.tsx`, `PatientNewPage.tsx`) par un assistant en étapes, avec la barre d'étapes visible en haut :

1. **Qui est-ce ?** — prénom, nom (obligatoires, marqués « obligatoire ») ; sexe et date de naissance (marqués « pour calculer le MB »). Le patient est **créé à la fin de cette étape** : rien n'est perdu si elle s'arrête là.
2. **Le joindre** — téléphone, e-mail, adresse.
3. **Sa situation** — situation familiale, profession, médecin traitant, adressé par.
4. **Dossier médical** — taille, ses champs (§ 3.2), allergies.
5. **C'est prêt** — récapitulatif et deux choix : « Ouvrir le dossier » ou « Démarrer le bilan ».

- Chaque étape après la première a « Passer cette étape » et « Retour ». Ce qui est saisi est enregistré en passant à l'étape suivante.
- Sur iPad : un champ à la fois visible au-dessus du clavier, bon type de clavier (`inputmode` téléphone, e-mail, décimal pour la taille).
- Depuis la prise de rendez-vous : « Nouveau patient » ouvre une version courte (étape 1 + téléphone) sans quitter l'agenda.
- La modification d'un patient existant ne passe pas par l'assistant : elle se fait sur place dans la fiche (lot 4). Supprimer `PatientEditPage.tsx` et la route `/patients/:id/edit`.

### Lot 7 — Séance

**Choix retenu (à la place d'un assistant en étapes)** : pendant une consultation la conversation saute d'un sujet à l'autre ; un assistant imposerait un ordre et cacherait les champs. La séance est donc **une seule page**, dans l'ordre de sa feuille, avec le rappel du dossier à côté. L'idée du résumé qui reste visible sur la gauche est gardée.

- **Colonne de gauche « Rappel »** (repliable, mémorisée ; tiroir en iPad portrait) : dernière séance (conseils donnés, travail fait), courbe de poids, aversions et goûts connus, allergies, points du dossier médical.
- **Colonne principale**, dans l'ordre :
  1. Ligne d'en-tête : date (aujourd'hui), formule (pré-remplie : « Bilan » pour la première séance, « Suivi » ensuite), moyen de paiement (pré-rempli avec le dernier utilisé pour ce patient). Numéro affiché : « Bilan », « Suivi 3 »…
  2. Poids → IMC, MB MJ et MB kcal calculés aussitôt, en grandes tuiles, avec l'écart depuis la dernière séance et depuis le bilan.
  3. Habitudes et évolution · Travail en consultation · Aversions · Goûts · Conseils diététiques — grandes zones de texte qui s'agrandissent avec le contenu.
  4. « Pour aller plus loin » replié : objectifs (revue des précédents + nouveaux), événements de vie, mesures complémentaires.
- Enregistrement automatique partout, indicateur visible.
- Plus de « Finaliser » ni « Abandonner » : un bouton **« Terminer la séance »** ramène à la fiche et propose, dans une petite fenêtre, les deux suites naturelles : « Faire la facture » et « Prendre le prochain rendez-vous ». « Supprimer la séance » est dans un menu secondaire, avec confirmation.
- Une séance passée se rouvre et se modifie exactement comme une séance du jour.
- Fini quand : une séance complète se saisit sur iPad paysage sans quitter la page, les calculs correspondent au cas de test de § 3.1, et une ancienne séance se corrige.

### Lot 8 — Accueil et pages restantes

- **Tableau de bord** simplifié : « Aujourd'hui » en grandes cartes (heure, patient, bouton « Démarrer la séance » ou « Rouvrir »), « À relancer » (sans séance depuis 6 semaines), « Factures à faire » (séances sans facture), « Tâches ». Retirer « Séances à finaliser ».
- Appliquer la charte à : liste des patients (archivés dans un filtre, plus de tags/statuts), agenda et formulaire de RDV, détail RDV, pages admin (utilisateurs, journal d'accès), connexion / mot de passe oublié, page 404.
- Fini quand : plus aucune page n'utilise une largeur, une carte ou une couleur hors charte (`grep` des couleurs Tailwind en dur dans `pages/` et `components/` hors `ui/` → vide).

### Lot 9 — Nettoyage, tests et documentation

- Supprimer ce qui ne sert plus (composants, routes, types, clés) — normalement déjà fait lot par lot, à vérifier.
- Réécrire les tests Playwright (`apps/frontend/e2e/`) sur les parcours réels : créer un patient avec l'assistant, faire un bilan, émettre la facture, corriger une ancienne séance. Les faire tourner en CI si le coût le permet.
- Remonter les seuils de couverture du frontend.
- Mettre à jour `docs/PLAN.md` (dossier patient, décisions produit, modèle de données) et les README.

---

## 5. À valider avec Valérie

Ces points ne bloquent pas le démarrage mais peuvent ajuster les lots concernés :

1. **« Compte rendu : À faire »** du récapitulatif : est-ce bien le compte rendu au médecin traitant ? (lot 2 suppose que oui.)
2. **Aversions et goûts** : les note-t-elle à chaque séance, ou est-ce une liste qu'elle complète ? (lot 7 les garde par séance et les cumule dans le récapitulatif.)
3. **Moyens de paiement** : espèces, chèque, carte, virement — en manque-t-il ?
4. **Mention TVA et numérotation** des factures : à vérifier avec son comptable.
5. **Envoi de la facture par e-mail** au patient : utile ? (pas prévu ici ; Brevo est déjà branché, ce serait un petit lot de plus.)
6. **Agenda** : utilise-t-elle un autre outil de prise de rendez-vous (Doctolib…) ? Si oui, l'agenda de l'app pourrait être simplifié encore.
