# Refonte métier et UX — plan d'action

> Plan rédigé le 2026-11-22 pour être découpé en lots confiés à des agents.
> Chaque lot est autonome : contexte métier, décisions déjà prises, ce qu'il faut livrer, critères de fin.
> Les **contrats partagés** (§ 3) sont fixés ici et ne se rediscutent pas dans un lot : plusieurs lots en dépendent.
> Pour le reste (structure du code, découpage en composants, nommage), l'agent décide en suivant les conventions du dépôt.
>
> **État au 2026-11-24** : lots 0 à 10 et 12 à 16 faits (PR indiquée sous chaque lot). Reste le lot 11, la recette avec Valérie. L'app telle qu'elle est maintenant : [PLAN.md](PLAN.md).

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
5. **Le plus utile d'abord, le reste replié.** Les mesures complémentaires (tour de taille, masse grasse…) et les faits marquants restent disponibles dans une section « Pour aller plus loin » repliée : Valérie les découvrira peut-être, mais ils ne doivent pas encombrer.
6. **iPad et ordinateur.** iPad (paysage surtout, portrait toléré) pendant la consultation, ordinateur pour l'administratif. Cibles tactiles ≥ 44 px, rien qui ne marche qu'au survol (pas d'info uniquement en `title`), le clavier virtuel ne doit pas masquer le champ actif.
7. **Des états vides qui guident** : illustration ou icône colorée + une phrase + le bouton qui fait avancer (« Aucune séance pour l'instant — Démarrer le bilan »).
8. **Sa feuille montre ce qu'elle fait, pas tout ce dont elle a besoin.** Numbers l'a obligée à aller au plus simple : il faut distinguer « pas utile pour elle » de « pas possible avec le tableur ». Mais l'inverse est aussi vrai : beaucoup de choses qu'un logiciel « complet » proposerait ne correspondent pas à sa pratique. **Test pour tout ajout : il prolonge un geste qu'elle fait déjà, sans lui demander une saisie de plus.** Un ajout qui demande de remplir, noter ou classer en plus de ce qu'elle fait aujourd'hui n'entre pas dans cette refonte ; il attend son retour (§ 5).

### 2.1 Ce que le tableur ne lui permettait pas

Gardé, parce que ça ne lui demande rien de plus :

| Dans sa feuille                                                  | Limite du tableur                                                          | Ce que l'app apporte                                                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Une cellule par rubrique du dossier (santé, psy, activité…)      | On écrase ou on allonge la cellule : on perd quand et comment ça a changé   | **Historique daté automatique** de chaque rubrique : elle modifie le texte comme avant, l'app garde les versions |
| Poids, IMC, MB recopiés à chaque ligne                           | Pas de courbe, les écarts se calculent de tête                              | **Calculs automatiques, courbe de poids** et écarts (depuis la dernière séance, depuis le bilan)            |
| « Conseils diététiques » écrits à chaque séance                  | Il faut remonter la feuille pour relire ceux de la dernière fois            | **Les conseils de la dernière séance affichés** en haut de la nouvelle, là où elle fait le point             |
| Aversions et goûts dans des colonnes de séance (souvent vides)   | Éparpillés sur les lignes, impossibles à retrouver d'un coup d'œil          | **Une rubrique « Aversions » et une « Goûts » par patient** (texte libre avec historique), modifiables depuis la séance |
| « Compte rendu : À faire »                                       | Elle doit tout recouper (feuille, notes papier) et rédiger à la main         | **Compte rendu au médecin pré-rempli** avec ses données, qu'elle relit et complète (lot 10)               |
| Onglet facture avec un total                                     | Pas de vraie facture, pas de numérotation                                   | **Une facture par séance** et un récapitulatif par période (lot 5)                                         |

Écarté, parce que ça ajoute de la saisie ou ne correspond pas à sa pratique :

| Idée                                                             | Pourquoi on ne la fait pas                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Objectifs suivis avec un statut à chaque séance (existant)       | Elle fait le point en racontant (« Habitudes et évolution »), pas en cochant des cases. Supprimés.                   |
| Note « appliqué / en partie / pas appliqué » sur les conseils    | Un conseil en contient plusieurs, une note globale ne dirait rien. On affiche les conseils, elle écrit le retour.    |
| Aliments aimés / pas aimés en étiquettes                         | Elle écrit des phrases (« n'aime pas les légumes cuits, sauf en soupe »). Texte libre.                              |
| Thématiques génériques (sommeil, digestion…), échelles 1–10       | Pas son vocabulaire ni sa méthode. Supprimées.                                                                      |
| Contact d'urgence, régime particulier, note privée, tags, statuts | Pas utiles en cabinet de diététique libéral, et le RGPD demande de ne collecter que le nécessaire. Supprimés.        |
| Faits marquants mis en avant dans la séance                      | Elle les écrit déjà dans ses textes. Gardés seulement en « Pour aller plus loin », pour annoter la courbe si elle veut. |

## 3. Contrats partagés

### 3.1 Calculs (API, jamais stockés)

Formules confirmées sur sa feuille Numbers (2026-11-22) :

| Valeur        | Formule Numbers                                          | Dans l'app                                              |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| Constante     | `=SI(Sexe="F";0,963;1,083)`                              | `k = 0,963` (F) ou `1,083` (M) ; affichée « 0,96 »      |
| IMC           | `=Poids÷PUISSANCE(Taille;2)`                             | poids (kg) / taille (m)²                                |
| MB (MJ/jour)  | `=Constante×PUISSANCE(Poids;0,48)×PUISSANCE(Taille;0,5)×PUISSANCE(Âge;−0,13)` | formule de Black et al., taille en mètres |
| MB (kcal/jour)| `=(MB MJ÷4,185)×1000`                                    | MB (MJ) × 1000 / 4,185                                  |

- Catégories d'IMC inchangées (`apps/api/src/modules/patient-file/bmi.ts`).
- Âge : dans sa feuille, c'est un nombre saisi une fois au bilan. Dans l'app, il est calculé depuis la date de naissance, à la date de chaque séance (plus juste sur un suivi long). Si elle ne connaît que l'âge, le champ « date de naissance » permet de saisir « âge : 56 » à la place ; l'app enregistre alors l'année de naissance estimée et l'indique (« 56 ans, âge déclaré »).
- Taille = dernière taille connue **à la date de la mesure ou de la séance** (pas la dernière tout court) : elle suit les enfants et ados en croissance, et un poids ancien se calcule avec la taille de l'époque.
- **Moins de 18 ans** (elle suit des enfants et des ados, confirmé le 2026-11-23) : l'IMC s'affiche sans les catégories adultes ; il est placé sur une courbe de corpulence avec les seuils IOTF (Cole et al. 2000 pour surpoids/obésité, Cole et al. 2007 pour la minceur), données reprises des tables publiées et citées dans le code, jamais inventées. La formule de Black est une formule adulte : avant 18 ans, le MB s'affiche avec la mention « formule adulte » (question pour Valérie, § 5).
- Si sexe, âge ou taille manquent : pas de calcul, et l'interface dit ce qui manque (« Ajoutez la taille pour calculer l'IMC »).
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
| `birthDateEstimated`      | (âge déclaré, voir § 3.1)     | booléen                     |
| `archivedAt`              | (patient archivé)             | date, remplace `status`     |

Garder : identité, contact, adresse (facultative, utile sur les factures), `consultationReason` (motif), `referralSource` (adressé par), consentements.
Supprimer : `status` (+ enum `PatientStatus`), `Tag`, `PatientTag`, contact d'urgence (3 champs), `dietaryRestrictions`, `privateNote`, et `allergies` (passe dans le dossier médical ci-dessous).
La **taille** reste une mesure `HEIGHT` (table `Measurement`), saisie depuis le dossier.

**Dossier médical avec historique** — reprend le mécanisme des thématiques actuelles (`TopicNote`), mais avec **ses** rubriques. Renommer le modèle en `FileEntry` et l'enum en `FileField` :

| Valeur de `FileField`        | Libellé                       |
| ---------------------------- | ----------------------------- |
| `HEALTH`                     | Santé, maladies               |
| `FAMILY_HISTORY`             | Antécédents familiaux         |
| `PSYCHOLOGY`                 | Psy                           |
| `PHYSICAL_ACTIVITY`          | Activité physique et sportive |
| `WEIGHT_HISTORY`             | Histoire du poids et régimes  |
| `ALLERGIES`                  | Allergies                     |
| `BLOOD_GLUCOSE`              | Glycémie                      |
| `CHOLESTEROL_TRIGLYCERIDES`  | Cholestérol et triglycérides  |
| `AVERSIONS`                  | Aversions                     |
| `TASTES`                     | Goûts                         |

- Une entrée = (patient, rubrique, texte, date, séance facultative). La valeur actuelle d'une rubrique est sa dernière entrée.
- Pour elle, c'est un simple champ de texte qu'elle modifie. L'app fait le reste : une modification **le même jour** (ou dans la même séance) met à jour l'entrée du jour ; une modification **un autre jour** crée une nouvelle version. Sous le champ : « Modifié le 12 mars · voir l'historique ».
- Une version de l'historique peut être corrigée ou supprimée (principe 2).
- Glycémie et cholestérol restent du texte libre (valeur + date du bilan sanguin) ; l'historique suffit à suivre leur évolution. Un vrai graphique des analyses est une question à poser à Valérie (§ 5).

Aversions et goûts sont des rubriques comme les autres : un texte libre par patient, avec historique, modifiable depuis le dossier ou depuis la séance (l'entrée est alors liée à la séance).

**Faits marquants** — le modèle `LifeEvent` est gardé mais simplifié : date + une ligne de texte, catégorie facultative. Uniquement dans « Pour aller plus loin » ; s'il y en a, ils annotent la courbe de poids.

**Compte rendu au médecin** — nouveau modèle `GpReport` : patient, date, texte, `status` (`DRAFT` / `SENT`), `sentAt`. Plusieurs comptes rendus possibles dans la vie d'un dossier. Voir lot 10.

**Consultation (séance)** — devient la ligne de son « Suivi » :

| Champ                 | Libellé                    | Type                                                                 |
| --------------------- | -------------------------- | -------------------------------------------------------------------- |
| `date`                | Date                       | existant                                                             |
| `formulaId`           | Formule                    | réf. vers `Formula` (lot 2), facultatif                              |
| `formulaLabel`, `priceCents` | (copie au moment de la séance) | le prix ne change pas si le tarif change ensuite             |
| `paymentMethod`       | Moyen de paiement          | enum `CASH` / `CHECK` / `CARD` / `TRANSFER` / `NONE` (« Non réglé ») |
| `habits`              | Habitudes et évolution     | texte                                                                |
| `sessionWork`         | Travail en consultation    | texte (remplace `summary`)                                           |
| `advice`              | Conseils diététiques       | existant                                                             |

Aversions et goûts ne sont plus des colonnes de séance : ce sont des rubriques du dossier (ci-dessus), modifiables depuis la séance.

Le **poids** de la séance reste une mesure `WEIGHT` liée à la séance (`consultationId`), ce qui garde les graphiques existants. L'API renvoie pour chaque séance : poids, IMC, MB (MJ), MB (kcal), et l'écart avec la séance précédente.
Supprimer : `status`, `finalizedAt`, enum `ConsultationStatus`, et toute la logique de verrouillage (`assertDraftSession`, contrôles `FINALIZED` dans `patient-file.service.ts` et `consultations.service.ts`, route `/finalize`). Créer une séance depuis un rendez-vous passe ce rendez-vous à `COMPLETED`.

**Thématiques** (`TopicNote`, `PatientTopic`) : leurs rubriques génériques (alimentation, sommeil, digestion…) disparaissent, mais leur mécanisme d'historique est réutilisé pour le dossier médical (ci-dessus).

**Objectifs** (`Goal`, `GoalReview`) : supprimés. À la place, chaque séance affiche les conseils de la séance précédente ; son retour s'écrit dans « Habitudes et évolution », comme aujourd'hui.

**Gardé en « Pour aller plus loin »** (replié dans l'interface) : mesures complémentaires (tour de taille, hanches, masse grasse, masse musculaire). Les échelles 1–10 (énergie, sommeil, stress, faim) sont supprimées.

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
                                     │                        ├► Lot 7 Séance
                                     │                        └► Lot 10 Compte rendu médecin (après lot 3)
                                     └─► Lot 8 Accueil + pages restantes
Lot 9  Nettoyage, tests de bout en bout, documentation (à la fin)
Lot 11 Recette avec Valérie, puis ajustements (après le lot 9)
```

Lots 1 et 2 peuvent avancer en parallèle : le lot 1 ne touche que `components/ui`, `components/layout`, les styles et de nouveaux composants partagés ; le lot 2 que l'API, Prisma, `packages/types` et les adaptations minimales du frontend pour que tout compile.

Chaque lot : une branche depuis `staging`, une PR vers `staging`, CI verte, tests ajoutés pour ce qui est nouveau, captures d'écran iPad paysage + ordinateur dans la PR pour les lots d'interface.

### Lot 0 — Agenda : afficher toute la semaine

**Fait** : PR [#18](https://github.com/polo13410/vp_dietetic_center/pull/18).

- La vue semaine affiche les 7 jours, lundi → dimanche, même vides, et on peut créer un rendez-vous en cliquant sur n'importe quel jour.
- Retirer le filtre `shownDays` de `apps/frontend/src/pages/appointments/AppointmentsPage.tsx`.
- Fini quand : un créneau du dimanche est cliquable en vue semaine et crée un rendez-vous à la bonne date.

### Lot 1 — Charte visuelle et composants de base

**Fait** : PR [#19](https://github.com/polo13410/vp_dietetic_center/pull/19).

- Écrire `docs/DESIGN.md` : palette (valeurs), typographie, espacements, largeurs de page, composants et quand les utiliser, règles tactiles, ton des textes (vouvoiement, phrases courtes, pas de jargon technique).
- Poser les variables dans `apps/frontend/src/styles/globals.css` (clair et sombre).
- Créer ou unifier les composants listés en § 3.3, et un gabarit de page commun (largeur, marges, en-tête) utilisé par `AppLayout`.
- Barre latérale : libellés plus grands, icônes colorées par espace, état actif évident ; repliable sur iPad portrait.
- En-tête : retirer la cloche de notifications (le lot 2 supprime le reste). Garder la recherche globale et le choix du thème.
- **Ne pas réécrire les pages** dans ce lot (sauf ce qui casse) : les lots suivants les migrent. Faire une seule page témoin (la liste des patients) pour valider la charte.
- Fini quand : `DESIGN.md` existe, la liste des patients l'applique, les composants partagés ont des tests de rendu simples.

### Lot 2 — Modèle de données et API

**Fait** : PR [#20](https://github.com/polo13410/vp_dietetic_center/pull/20).

- Appliquer § 3.1 et § 3.2 : schéma Prisma, une migration, DTO, services, contrôleurs, `packages/types`, seed.
- Fonctions de calcul IMC/MB pures et testées avec le cas de test de § 3.1.
- Supprimer : verrouillage et finalisation des séances, rubriques génériques des thématiques, objectifs, échelles 1–10, notifications, tags, statut patient (remplacé par archiver/désarchiver).
- Créer : `FileEntry` (historique du dossier, avec la règle « même jour = mise à jour, autre jour = nouvelle version »), `GpReport` (modèle et CRUD seulement, l'écran est au lot 10), la saisie de l'âge à la place de la date de naissance (§ 3.1), et pour chaque séance les conseils de la séance précédente dans la réponse de l'API.
- Supprimer aussi les champs patient listés en § 3.2 (contact d'urgence, régime particulier, note privée).
- Côté frontend, seulement le nécessaire pour compiler et ne pas casser : retirer les écrans et appels des fonctions supprimées, renommer `summary` → `sessionWork`. Les vrais écrans arrivent aux lots 4 à 7.
- Garder le contrôle d'accès (`PatientAccessService`) et l'audit (`@Audited`) sur toutes les nouvelles routes.
- Fini quand : migration appliquée sur une base vide, seed OK, tests API verts avec seuils de couverture tenus, une séance « finalisée » n'existe plus nulle part dans le code.

### Lot 3 — Paramètres (à refaire entièrement)

**Fait** : PR [#21](https://github.com/polo13410/vp_dietetic_center/pull/21).

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

**Fait** : PR [#22](https://github.com/polo13410/vp_dietetic_center/pull/22).

Reprendre `apps/frontend/src/pages/patients/PatientDetailPage.tsx` sur le modèle de ses onglets Numbers. Passer de 9 onglets à 5 :

| Onglet            | Contenu                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Récapitulatif     | Carte identité (âge, téléphone cliquable, e-mail, situation familiale, profession, médecin traitant + dernier compte rendu), chiffres clés (poids actuel, IMC, MB, écart depuis le bilan), courbe de poids avec les faits marquants, dernière séance en bref (conseils donnés), aversions et goûts, allergies bien visibles |
| Dossier médical   | Ses rubriques (§ 3.2) dans son ordre, modifiables sur place avec enregistrement automatique et historique par rubrique ; taille et sexe ici |
| Suivi             | Tableau des séances comme sa feuille : n° (Bilan, Suivi 1, 2…), date, formule, paiement, poids, IMC, MB MJ, MB kcal ; une ligne se déplie pour lire les textes ; toucher une ligne ouvre la séance. Bouton « Nouvelle séance » |
| Factures          | Liste des factures du patient + total (lot 5 ; onglet masqué tant que le lot 5 n'est pas livré)                                   |
| Documents         | Existant, restylé                                                                                                             |

- « Pour aller plus loin » (replié, dans le Récapitulatif ou un menu « Plus ») : mesures complémentaires, tâches, historique des accès, export PDF.
- Le récapitulatif est aussi le **« Rappel »** de la séance (lot 7) : un seul composant, en deux tailles (pleine page et panneau latéral).
- En-tête de la fiche : nom, âge, actions principales « Nouvelle séance » (ou « Démarrer la séance du jour » s'il y a un RDV) et « Prendre rendez-vous ». « Modifier » disparaît : tout se modifie sur place.
- Archiver le patient : dans un menu secondaire, avec confirmation.
- Fini quand : on lit tout ce que contient sa feuille Numbers sur un seul écran Récapitulatif (iPad paysage, sans défiler pour l'essentiel), et on peut tout modifier sans changer de page.

### Lot 5 — Facturation

**Fait** : PR [#25](https://github.com/polo13410/vp_dietetic_center/pull/25).

Contexte : une facture par séance. Les paiements se font hors de l'app ; l'app garde la trace et produit la facture.

- Modèle `Invoice` : praticienne, patient, séance (facultative, voir plus bas), type (`INVOICE` / `CREDIT_NOTE`), numéro, date d'émission, montant, moyen de paiement, **copie** des infos du cabinet et du patient au moment de l'émission (une facture ne change pas si l'adresse change ensuite), `cancelledAt`, lien vers l'avoir et vers la facture de remplacement.
- **Numérotation** : continue, par praticienne et par année, sans trou, attribuée à l'émission (`2026-0001`). Générée dans une transaction pour éviter les doublons.
- **Règle légale** : une facture émise ne se modifie pas et ne se supprime pas, et la numérotation n'a pas de trou. La praticienne n'a pas à connaître cette règle : l'app l'applique toute seule et lui donne des boutons simples pour corriger une erreur.
- **Quand la facture existe-t-elle ?** Jamais automatiquement : elle est émise quand la praticienne clique sur « Faire la facture » (proposé à la fin de la séance). Avant ce clic, la séance (tarif, paiement, date) se modifie ou se supprime librement : la plupart des erreurs se corrigent là, sans aucune trace à gérer.
- **Corriger les erreurs après émission** :

| Erreur                                         | Ce qu'elle fait                                                    | Ce que fait l'app                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Mauvais tarif, mauvais moyen de paiement, mauvaise date | Elle corrige la séance, puis touche **« Corriger la facture »** (bandeau « La facture n° 2026-0012 ne correspond plus à la séance ») | Annule l'ancienne en émettant un **avoir** (document numéroté `A-2026-0001` qui la reprend en négatif), émet une nouvelle facture, et lie les trois (« remplace la n° 2026-0012 ») |
| Séance créée par erreur (déjà facturée)        | **« Supprimer la séance »** ; la confirmation précise que la facture sera annulée | Émet l'avoir, supprime la séance ; facture et avoir restent dans la liste des factures (ils gardent leurs copies des données) |
| Facture faite par erreur (séance offerte, pas due) | **« Annuler la facture »**, avec un motif facultatif             | Émet l'avoir ; la séance redevient « sans facture »                                                                    |
| Mauvaises infos du cabinet ou du patient sur la facture | Elle corrige dans Paramètres ou la fiche, puis « Corriger la facture » | Même mécanique : avoir + nouvelle facture avec les infos à jour                                              |

- Factures annulées et avoirs : visibles dans les listes (barrés, avec le lien vers la facture de remplacement), exclus des totaux, présents dans l'export CSV avec leur statut (le comptable en a besoin).
- Avoir plutôt que simple mention « annulée » : c'est la pratique comptable française. À confirmer avec son comptable (§ 5) ; si une mention suffit, l'avoir se retire sans toucher au reste.
- `Invoice` garde ses copies des données : supprimer une séance ou un patient ne doit jamais supprimer ni vider une facture (`consultationId` passe à `null`). Les factures sont conservées 10 ans (obligation comptable), même si le dossier patient est supprimé.
- Mentions : celles du cabinet (lot 3) + numéro, date, patient, prestation (formule + date de séance), montant, moyen de paiement, « Acquittée » si réglée. La mention d'exonération de TVA est saisie par la praticienne dans « Mon cabinet » (à valider avec son comptable, typiquement l'article 261-4-1° du CGI pour les diététiciens) : ne pas la coder en dur.
- PDF avec `@react-pdf/renderer` (déjà utilisé par l'export patient).
- Écrans : bouton « Facture » sur la séance (émettre / télécharger / annuler et refaire), onglet Factures de la fiche patient, et une page **Factures** (barre latérale) : liste par période, total encaissé par période et par moyen de paiement, export CSV pour le comptable.
- Fini quand : tests sur la numérotation (concurrence, annuel, sans trou, factures et avoirs séparés), sur chaque ligne du tableau des erreurs, PDF lisible avec le cas de test, export CSV.

### Lot 6 — Création d'un patient guidée

**Fait** : PR [#24](https://github.com/polo13410/vp_dietetic_center/pull/24).

Remplacer le formulaire en une colonne (`PatientForm.tsx`, `PatientNewPage.tsx`) par un assistant en étapes, avec la barre d'étapes visible en haut :

1. **Qui est-ce ?** — prénom, nom (obligatoires, marqués « obligatoire ») ; sexe et date de naissance, ou âge s'il n'est pas connu (marqués « pour calculer le MB »). Le patient est **créé à la fin de cette étape** : rien n'est perdu si elle s'arrête là.
2. **Le joindre** — téléphone, e-mail, adresse.
3. **Sa situation** — situation familiale, profession, médecin traitant, adressé par.
4. **Dossier médical** — taille, ses champs (§ 3.2), allergies.
5. **C'est prêt** — récapitulatif et deux choix : « Ouvrir le dossier » ou « Démarrer le bilan ».

- Chaque étape après la première a « Passer cette étape » et « Retour ». Ce qui est saisi est enregistré en passant à l'étape suivante.
- Sur iPad : un champ à la fois visible au-dessus du clavier, bon type de clavier (`inputmode` téléphone, e-mail, décimal pour la taille).
- Depuis la prise de rendez-vous : « Nouveau patient » ouvre une version courte (étape 1 + téléphone) sans quitter l'agenda.
- La modification d'un patient existant ne passe pas par l'assistant : elle se fait sur place dans la fiche (lot 4). Supprimer `PatientEditPage.tsx` et la route `/patients/:id/edit`.

### Lot 7 — Séance

**Fait** : PR [#28](https://github.com/polo13410/vp_dietetic_center/pull/28).

Pendant une consultation la conversation saute d'un sujet à l'autre : la saisie n'est donc **pas** un assistant en étapes mais une seule page, dans l'ordre de sa feuille. En revanche, **se remémorer l'histoire du patient avant de commencer** est un moment à part, crucial, qui mérite son propre écran. D'où deux temps :

**Temps 1 — « Avant de commencer »** (en pleine page)
- S'affiche quand on démarre une nouvelle séance. Contenu : le récapitulatif du lot 4 en grand et lisible : histoire (motif, dossier médical), courbe de poids, dernière séance (travail fait, conseils donnés), aversions et goûts, allergies.
- Un seul gros bouton : **« Commencer la séance »**.

**Temps 2 — la séance**
- Au clic, le récapitulatif **glisse vers la gauche** et devient un panneau étroit « Rappel » ; les champs de la séance arrivent au centre. L'animation est courte (≈ 300 ms, désactivée si l'appareil demande moins d'animations) : elle sert à montrer où le résumé est parti.
- Le panneau a une **poignée toujours visible** sur son bord (icône + « Rappel », flèche qui indique ouvrir / fermer), assez grande pour le doigt. La première fois, une bulle explique : « Le résumé du dossier reste ici, touchez pour l'ouvrir ou le fermer. » Son état (ouvert / fermé) est mémorisé.
- iPad portrait : le panneau passe par-dessus la séance (tiroir) au lieu de la pousser.
- Rouvrir une séance passée saute le temps 1 et arrive directement sur la saisie, panneau fermé.

**Champs de la séance**, dans l'ordre :
  1. Ligne d'en-tête : date (aujourd'hui), formule (pré-remplie : « Bilan » pour la première séance, « Suivi » ensuite), moyen de paiement (pré-rempli avec le dernier utilisé pour ce patient). Numéro affiché : « Bilan », « Suivi 3 »…
  2. Poids → IMC, MB MJ et MB kcal calculés aussitôt, en grandes tuiles, avec l'écart depuis la dernière séance et depuis le bilan.
  3. **Habitudes et évolution**, avec juste au-dessus, en encadré discret, les conseils donnés à la séance précédente (absent pour un bilan) : c'est là qu'elle fait le point.
  4. Travail en consultation.
  5. Aversions · Goûts — les rubriques du patient, déjà remplies avec ce qu'on sait, qu'elle complète.
  6. Conseils diététiques.
  7. « Pour aller plus loin » replié : mesures complémentaires, fait marquant, autres rubriques du dossier médical modifiables sans quitter la séance.
- Les zones de texte sont grandes et s'agrandissent avec le contenu.
- Enregistrement automatique partout, indicateur visible.
- Plus de « Finaliser » ni « Abandonner » : un bouton **« Terminer la séance »** ramène à la fiche et propose, dans une petite fenêtre, les deux suites naturelles : « Faire la facture » et « Prendre le prochain rendez-vous ». « Supprimer la séance » est dans un menu secondaire, avec confirmation (si elle est facturée, voir le tableau des erreurs du lot 5).
- Une séance passée se rouvre et se modifie exactement comme une séance du jour.
- Fini quand : une séance complète se saisit sur iPad paysage sans quitter la page, les calculs correspondent au cas de test de § 3.1, et une ancienne séance se corrige.

### Lot 8 — Accueil et pages restantes

**Fait** : PR [#29](https://github.com/polo13410/vp_dietetic_center/pull/29).

- **Tableau de bord** simplifié : « Aujourd'hui » en grandes cartes (heure, patient, bouton « Démarrer la séance » ou « Rouvrir »), « À relancer » (sans séance depuis 6 semaines), « Factures à faire » (séances sans facture), « Tâches ». Retirer « Séances à finaliser ».
- Appliquer la charte à : liste des patients (archivés dans un filtre, plus de tags/statuts), agenda et formulaire de RDV, détail RDV, pages admin (utilisateurs, journal d'accès), connexion / mot de passe oublié, page 404.
- Fini quand : plus aucune page n'utilise une largeur, une carte ou une couleur hors charte (`grep` des couleurs Tailwind en dur dans `pages/` et `components/` hors `ui/` → vide).

### Lot 10 — Compte rendu au médecin

**Fait** : PR [#27](https://github.com/polo13410/vp_dietetic_center/pull/27).

Contexte : c'est la tâche qu'elle redoute. Elle doit recouper sa feuille, ses notes papier, l'évolution du poids, puis tout rédiger. L'app a déjà toutes ces données : elle peut lui préparer le brouillon.

- Depuis la fiche patient : **« Rédiger un compte rendu »** ouvre un éditeur de texte simple **pré-rempli à partir du dossier** (sans IA) :
  - en-tête : cabinet (lot 3), médecin traitant, date ;
  - patient : nom, âge, motif de consultation ;
  - suivi : date du bilan, nombre de séances, date de la dernière ;
  - évolution : poids et IMC au bilan → aujourd'hui, écart, MB actuel ;
  - éléments du dossier : valeur actuelle des rubriques renseignées (santé, antécédents, activité, glycémie…) ;
  - travail mené et conseils donnés : ceux des dernières séances ;
  - formule de politesse et signature.
- Elle modifie librement le texte ; enregistrement automatique. Le brouillon est enregistré en base (`GpReport`) et retrouvable dans la fiche.
- Export PDF sur papier à en-tête du cabinet, puis « Marquer comme envoyé » (date d'envoi).
- Le récapitulatif de la fiche affiche « Compte rendu : à faire » s'il existe un brouillon, ou « envoyé le … ».
- Fini quand : sur le patient du seed, le brouillon généré contient les bons chiffres (cas de test § 3.1) et se relit comme une lettre, pas comme un export de base de données.

**Plus tard (hors de ce plan) — rédaction assistée par IA** : elle écrit une consigne courte (« insister sur la perte de poids et le travail émotionnel ») et l'IA rédige à partir du dossier. À cadrer avant de commencer, car ce sont des données de santé : n'envoyer que des données pseudonymisées (ni nom, ni date de naissance, ni coordonnées : âge, sexe, chiffres et notes uniquement), fournisseur sans conservation des données et hébergé dans l'UE, information du patient, et question de l'hébergement de données de santé (HDS).

### Lot 9 — Nettoyage, tests et documentation

**Fait** : PR [#36](https://github.com/polo13410/vp_dietetic_center/pull/36).

À faire en dernier, après tous les autres lots.


- Supprimer ce qui ne sert plus (composants, routes, types, clés) — normalement déjà fait lot par lot, à vérifier.
- Réécrire les tests Playwright (`apps/frontend/e2e/`) sur les parcours réels : créer un patient avec l'assistant, faire un bilan, émettre la facture, corriger une ancienne séance. Les faire tourner en CI si le coût le permet.
- Remonter les seuils de couverture du frontend.
- Mettre à jour `docs/PLAN.md` (dossier patient, décisions produit, modèle de données) et les README.

---

### Deuxième passe — retours du 2026-11-23

Après les lots 0 à 8 et 10, retours sur staging. À faire avant les lots 9 et 11.

Ordre :

```
Lot 12 Bugs ────────────────────┐
Lot 13 Fiche patient et mesures ├─► Lot 15 Cabinets et types de RDV ─► Lot 16 Remise et tiers payant ─► Lots 9, 11
Lot 14 Connexion Google seule ──┘
```

#### Lot 12 — Bugs

**Fait** : PR [#31](https://github.com/polo13410/vp_dietetic_center/pull/31).

- **Téléchargement des PDF impossible** (factures ; vérifier aussi le compte rendu au médecin et l'export du dossier, même moteur) : l'appel à l'API renvoie bien les données, mais aucun fichier n'arrive et rien ne s'affiche. Piste à vérifier en premier : le PDF est fabriqué dans le navigateur par `@react-pdf/renderer`, dont le moteur de mise en page (yoga) est en WebAssembly ; la CSP de `apps/frontend/nginx.conf` n'autorise pas `'wasm-unsafe-eval'`, et en local (Vite, sans nginx) tout marche. Reproduire avec l'image nginx de production (docker compose), corriger à la racine (CSP minimale nécessaire, jamais `'unsafe-eval'`), et faire en sorte qu'un échec affiche toujours un message.
- **Double défilement sur Paramètres** : la page défile dans son conteneur et la page entière défile aussi, barre latérale comprise. Un seul défilement, celui du contenu, comme sur les autres pages ; vérifier qu'aucune autre page n'a le problème.
- Fini quand : une facture, un avoir, un compte rendu et l'export du dossier se téléchargent depuis l'image de production ; Paramètres défile comme les autres pages.

#### Lot 13 — Fiche patient : un récapitulatif qui se lit, des modifications qui se font ailleurs

**Fait** : PR [#33](https://github.com/polo13410/vp_dietetic_center/pull/33).

Constat : « Pour aller plus loin » mélange les logiques. « Mesures complémentaires → Modifier » ouvre une fenêtre, « Aversions / goûts → Modifier » emmène à l'onglet Dossier médical. Et on ne peut pas saisir de mesure à une date passée (« à cette époque je faisais 70 kg, puis tel événement, j'ai pris 8 kg en 6 mois »), ni suivre la taille d'un enfant.

Règle : **le Récapitulatif se lit, il ne se modifie pas.** Chaque bloc du récapitulatif a un lien « Modifier » qui emmène à l'onglet qui possède la donnée, à l'endroit de la donnée. Plus aucune fenêtre de modification pour les données du dossier.

- Onglets : Récapitulatif · Dossier médical · **Mesures** (nouveau) · Suivi · Factures · Documents.
- Supprimer l'accordéon « Pour aller plus loin » : ce qu'il contenait est affiché dans le récapitulatif (en lecture) ou rangé dans l'onglet qui le possède :
  - mesures complémentaires → onglet Mesures ;
  - tâches → onglet Suivi (« À faire pour ce patient ») et un résumé lisible dans le récapitulatif ;
  - historique des accès, export du dossier en PDF, archiver → menu « … » de l'en-tête de la fiche.
- **Onglet Mesures** : une frise unique, du plus récent au plus ancien, avec le poids, la taille, les mesures complémentaires et les faits marquants. « Ajouter une mesure » à n'importe quelle date (y compris avant le suivi), avec une note facultative (« avant sa grossesse », « pendant le traitement »). Chaque ligne se corrige ou se supprime sur place. Les mesures prises en séance y apparaissent avec le lien vers la séance. La courbe de poids (et de taille si elle change) est en haut ; avant 18 ans, la courbe de corpulence de § 3.1.
- L'IMC et le MB de chaque mesure utilisent la taille connue à sa date (§ 3.1).
- Fini quand : le récapitulatif n'a plus de champ modifiable ni de fenêtre de modification, chaque « Modifier » mène au bon onglet, on peut saisir l'histoire du poids d'un patient avant son bilan et la voir sur la courbe, et la taille d'un enfant suit sa croissance.

#### Lot 14 — Connexion avec Google uniquement

**Fait** : PR [#32](https://github.com/polo13410/vp_dietetic_center/pull/32).

Décision du 2026-11-23 : plus de mot de passe. On s'appuie sur la sécurité du compte Google (validation en deux étapes conseillée à chaque praticienne).

- Supprimer : connexion par e-mail et mot de passe (stratégie locale, hachage, verrouillage après échecs), mot de passe oublié et réinitialisation (pages, routes, jetons), changement de mot de passe dans Paramètres, et le module d'envoi d'e-mails (plus aucun e-mail n'est envoyé). Retirer les variables SMTP de l'API et de `infra/terraform` ; le propriétaire applique Terraform lui-même.
- Garder : seule une adresse déjà enregistrée et active peut se connecter (jamais de création de compte à la connexion), e-mail Google vérifié obligatoire, session de 10 h, journal des connexions.
- Paramètres > Sécurité devient une simple information : « Vous vous connectez avec votre compte Google (adresse). Pour plus de sécurité, activez la validation en deux étapes sur ce compte. » avec le lien vers la page Google.
- La page de connexion n'a plus qu'un bouton « Se connecter avec Google », gros et clair.
- **Développement local et tests de bout en bout** : prévoir un moyen de se connecter sans Google, qui ne peut **pas** être activé sur staging ou prod (refusé au démarrage si l'environnement n'est pas local/test, avec un test qui le prouve). Mettre à jour `create-user.cjs`, le seed, les README et `docs/PLAN.md` (§ 5).
- Fini quand : aucune route, page ou colonne de mot de passe ne reste, la connexion Google marche, l'accès de développement est impossible à activer en production.

#### Lot 15 — Plusieurs cabinets et types de rendez-vous

**Fait** : PR [#34](https://github.com/polo13410/vp_dietetic_center/pull/34).

Elle peut consulter dans plusieurs cabinets. Et le motif d'un rendez-vous, c'est en fait un type de séance avec son tarif et sa durée.

- **Cabinets** : nouveau modèle (praticienne, nom, adresse, téléphone facultatif, SIRET facultatif s'il diffère de celui de l'activité, par défaut oui/non, archivé). L'identité de l'activité reste dans `PractitionerProfile` (nom affiché, SIRET, ADELI/RPPS, mention TVA, pied de facture) ; l'adresse passe au cabinet. Paramètres : section « Mes cabinets » (ajouter, modifier, choisir celui par défaut, archiver). Au moins un cabinet par praticienne, créé avec l'adresse actuelle.
- **Types de rendez-vous** = les formules de « Mes tarifs », avec en plus une **durée** (ex. Bilan 60 €, 1 h ; Suivi 50 €, 45 min).
- **Prise de rendez-vous** : « Type de rendez-vous » est un sélecteur des formules (fini le motif en texte libre ; une note facultative reste possible). Choisir un type remplit la durée, qui reste modifiable. « Cabinet » : sélecteur affiché seulement s'il y en a plusieurs, pré-rempli avec celui par défaut, masqué pour une consultation en visio ou par téléphone.
- La séance créée depuis un rendez-vous reprend son type (formule et prix) et son cabinet. La facture reprend l'adresse et, s'il y en a un, le SIRET du cabinet de la séance.
- Agenda : le type et, s'il y a plusieurs cabinets, le cabinet sont visibles sur chaque rendez-vous.
- Fini quand : un rendez-vous se prend en trois choix (patient, type, créneau), la durée suit le type, la facture porte l'adresse du bon cabinet.

#### Lot 16 — Remise et tiers payant

**Fait** : PR [#35](https://github.com/polo13410/vp_dietetic_center/pull/35).

Deux réalités de son cabinet : elle fait parfois un geste pour un patient qui ne peut pas payer, et certains patients ont un organisme qui paie tout ou partie (mutuelle, employeur, association, convention…).

**Remise** (le terme d'usage sur une facture)
- Sur la séance : remise en euros ou en %, avec un motif facultatif (« geste », « tarif solidaire »…). Pré-remplie avec celle de la séance précédente du patient, pour ne pas la ressaisir.
- La facture affiche le prix, la remise et le net à payer (la remise doit figurer sur la facture). Une remise de 100 % = séance offerte : pas de facture à faire, et elle ne figure pas dans « Factures à faire ».

**Tiers payant**
- **Organismes** : gérés dans un 2e onglet « Organismes » de la page Factures (décision du 2026-11-23). Un organisme a : nom, adresse, contact, référence de convention, rythme de facturation (tous les mois, tous les N mois, ou à la demande), notes.
- **Prise en charge** d'un patient (dans sa fiche, onglet Factures, bloc lisible dans le récapitulatif) : organisme, part prise en charge en euros **ou** en % par séance (au choix, décision du 2026-11-23), nombre de séances et période couverts (facultatifs), numéro de prise en charge.
- Calcul par séance : prix de la formule − remise = net ; part de l'organisme (plafonnée au net, et arrêtée quand le nombre de séances ou la période est dépassé) ; le patient paie le reste.
- **Facture du patient** : seulement sa part, avec la mention « dont X € pris en charge par (organisme) ». Si l'organisme paie tout, pas de facture patient.
- **Facture de l'organisme** : groupée par période. Dans l'onglet Organismes, chaque organisme montre la prochaine période à facturer selon son rythme ; « Préparer la facture » propose la période (modifiable : dates de début et de fin), affiche les séances incluses, puis l'émet. Contenu : par séance, la date, le patient, la prestation et le montant pris en charge, rien de médical. Même numérotation continue que les factures patients (une seule série de factures) ; corrections par avoir comme au lot 5.
- Suivi du règlement : une facture d'organisme est « en attente » jusqu'à ce qu'on indique « réglée le … ». Le tableau de bord signale les périodes terminées à facturer et les factures en attente depuis plus de 60 jours.
- Totaux et export CSV de la page Factures : distinguer ce qui est payé par les patients et par les organismes.
- Fini quand : une séance avec remise et tiers payant donne la bonne facture patient, la facture groupée d'un organisme sur une période choisie reprend exactement les bonnes séances, les tests couvrent les plafonds (montant, %, nombre de séances, période).

### Lot 11 — Recette avec Valérie

La refonte fait des choix sur sa pratique (§ 2.1) : c'est elle qui les valide.

- Préparer sur staging un compte de démonstration avec deux ou trois patients fictifs réalistes (dont celui du cas de test), sur son iPad.
- Lui faire dérouler sans aide, en la regardant : créer un patient, préparer puis mener un bilan, faire la facture, corriger un tarif, rouvrir une ancienne séance, rédiger un compte rendu. Noter où elle hésite, cherche ou se trompe.
- Lui poser les questions du § 5 qui restent ouvertes, et revoir avec elle le tableau « Écarté » du § 2.1 : ce qu'elle réclame entre dans un lot d'ajustements.
- Livrable : une liste d'ajustements classés (bloquant / gênant / confort), qui devient le plan suivant.

## 5. À valider avec Valérie

Ces points ne bloquent pas le démarrage mais peuvent ajuster les lots concernés. Ceux qui restent ouverts sont posés pendant la recette (lot 11).

Déjà tranché : le « Compte rendu : À faire » est bien celui au médecin traitant (lot 10). Elle n'utilise pas Doctolib : l'agenda de l'app est son seul agenda et reste central.

**Le plus utile : l'observer.** 30 minutes à la regarder préparer puis mener une séance (réelle avec accord du patient, ou simulée) en apprendront plus que les questions. Noter tout ce qu'elle cherche, recopie, calcule de tête ou écrit sur papier.

**Questions pour séparer « pas utile » de « pas possible avec le tableur »** :

1. Qu'écrivez-vous sur papier pendant la séance qui n'arrive jamais dans la feuille ?
2. Avant une séance, qu'est-ce qui vous prend du temps à retrouver ?
3. Les lignes « Suivi 4 » à « Suivi 10 » déjà prêtes, avec « Non » en formule : prévoyez-vous un nombre de séances, ou vendez-vous des forfaits (bilan + N suivis) ? Si oui, l'app pourrait suivre les séances restantes d'un forfait.
4. Glycémie, cholestérol : aimeriez-vous voir leur évolution en graphique, comme le poids ?
5. Remettez-vous des documents aux patients (plans alimentaires, menus, fiches conseils) ? Une bibliothèque de documents types pourrait les envoyer ou les imprimer en un geste.
6. Connaissez-vous la date de naissance de vos patients, ou seulement leur âge ?

**Pratique et facturation** :

7. Moyens de paiement : espèces, chèque, carte, virement — en manque-t-il ?
8. Mention TVA, numérotation, avoir ou simple annulation : à vérifier avec son comptable.
9. Envoi de la facture par e-mail au patient (ou à un organisme) : utile ? Pas prévu ici ; le lot 14 retire l’envoi d’e-mails, il faudrait le remettre (Brevo est toujours configuré côté domaine).
10. Jours de consultation : travaille-t-elle le samedi ou le dimanche ? (le lot 0 affiche les 7 jours dans tous les cas.)
11. Enfants : quelle formule de MB utilisez-vous avant 18 ans (Black est une formule adulte ; Schofield est courante chez l'enfant) ? Et quelles courbes de corpulence (IOTF, carnet de santé) ?
12. Tiers payant : quels organismes rencontrez-vous, et ont-ils un format de facture imposé ?
