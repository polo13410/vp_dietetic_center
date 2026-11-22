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
5. **Le plus utile d'abord, le reste replié.** Les mesures complémentaires (tour de taille, masse grasse…) restent disponibles dans une section « Pour aller plus loin » repliée : Valérie les découvrira peut-être, mais elles ne doivent pas encombrer.
8. **Sa feuille montre ce qu'elle fait, pas tout ce dont elle a besoin.** Numbers l'a obligée à aller au plus simple. Il faut distinguer « ce n'est pas utile pour elle » de « ce n'est pas là parce que l'outil ne le permettait pas ». C'est sur le second point que l'app doit faire mieux que le tableur (voir § 2.1).

### 2.1 Ce que le tableur ne lui permettait pas

| Dans sa feuille                                                        | Limite du tableur                                                       | Ce que l'app apporte                                                                                      |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Une cellule par sujet du dossier (santé, psy, activité…)                | On écrase ou on allonge la cellule : on perd quand et comment ça a changé | **Chaque champ du dossier garde son historique daté** ; on voit la valeur actuelle et on peut remonter le temps |
| Poids, IMC, MB recopiés à chaque ligne                                  | Pas de courbe, les écarts se calculent de tête                           | **Courbe de poids** et écarts (depuis la dernière séance, depuis le bilan) affichés tout de suite          |
| « Conseils diététiques » écrits à chaque séance                        | Rien ne les rappelle à la séance suivante                                | **Retour sur les conseils** : au début de la séance, les conseils de la fois précédente avec « Appliqué / En partie / Pas appliqué » (remplace les objectifs actuels) |
| Aversions et goûts dans des colonnes de séance (souvent vides)          | Éparpillés sur les lignes, impossibles à retrouver                       | **Une liste par patient** (« Aime » / « N'aime pas ») alimentée depuis les séances, visible au moment de donner des conseils |
| Faits notés dans le texte (« retiré il y a 2 mois par le docteur M », « resto gastro samedi ») | Noyés dans les cellules                                    | **Faits marquants** datés, ajoutés en une ligne, affichés sur la courbe de poids (événements de vie actuels, simplifiés) |
| « Compte rendu : À faire »                                              | Elle doit tout recouper (feuille, notes papier) et rédiger à la main      | **Compte rendu au médecin pré-rempli** à partir du dossier, qu'elle relit et complète (lot 10)            |
| Onglet facture avec un total                                            | Pas de vraie facture, pas de numérotation                                | **Une facture par séance** et un récapitulatif par période (lot 5)                                        |
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
| `archivedAt`              | (patient archivé)             | date, remplace `status`     |

Garder : identité, contact, adresse, `dietaryRestrictions`, `consultationReason`, contact d'urgence, `privateNote`, `referralSource`, consentements.
Supprimer : `status` (+ enum `PatientStatus`), `Tag`, `PatientTag`, et `allergies` (passe dans le dossier médical ci-dessous).
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

- Une entrée = (patient, rubrique, texte, date, séance facultative). La valeur actuelle d'une rubrique est sa dernière entrée.
- Pour elle, c'est un simple champ de texte qu'elle modifie. L'app fait le reste : une modification **le même jour** (ou dans la même séance) met à jour l'entrée du jour ; une modification **un autre jour** crée une nouvelle version. Sous le champ : « Modifié le 12 mars · voir l'historique ».
- Une version de l'historique peut être corrigée ou supprimée (principe 2).
- Glycémie et cholestérol restent du texte libre (valeur + date du bilan sanguin) ; l'historique suffit à suivre leur évolution. Un vrai graphique des analyses est une question à poser à Valérie (§ 5).

**Préférences alimentaires** — nouveau modèle `FoodPreference` : patient, `kind` (`LIKE` / `DISLIKE`), aliment (texte court), note facultative, séance où c'est apparu (facultatif), date. Saisie en étiquettes (« + ajouter un aliment ») depuis la séance ou le dossier ; liste unique par patient, retirable.

**Faits marquants** — le modèle `LifeEvent` est gardé mais simplifié dans l'interface : date + une ligne de texte ; la catégorie devient facultative.

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
| `adviceFollowUp`      | Retour sur les conseils de la séance précédente | enum `APPLIED` / `PARTLY` / `NOT_APPLIED`, facultatif |
| `adviceFollowUpNote`  | (commentaire du retour)    | texte, facultatif                                                    |

Aversions et goûts ne sont plus des colonnes de séance : ils alimentent `FoodPreference` (lié à la séance où ils sont apparus).

Le **poids** de la séance reste une mesure `WEIGHT` liée à la séance (`consultationId`), ce qui garde les graphiques existants. L'API renvoie pour chaque séance : poids, IMC, MB (MJ), MB (kcal), et l'écart avec la séance précédente.
Supprimer : `status`, `finalizedAt`, enum `ConsultationStatus`, et toute la logique de verrouillage (`assertDraftSession`, contrôles `FINALIZED` dans `patient-file.service.ts` et `consultations.service.ts`, route `/finalize`). Créer une séance depuis un rendez-vous passe ce rendez-vous à `COMPLETED`.

**Thématiques** (`TopicNote`, `PatientTopic`) : leurs rubriques génériques (alimentation, sommeil, digestion…) disparaissent, mais leur mécanisme d'historique est réutilisé pour le dossier médical (ci-dessus).

**Objectifs** (`Goal`, `GoalReview`) : supprimés, remplacés par le retour sur les conseils (`adviceFollowUp`), qui part de ce qu'elle écrit déjà.

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
- Supprimer : verrouillage et finalisation des séances, rubriques génériques des thématiques, objectifs, échelles 1–10, notifications, tags, statut patient (remplacé par archiver/désarchiver).
- Créer : `FileEntry` (historique du dossier, avec la règle « même jour = mise à jour, autre jour = nouvelle version »), `FoodPreference`, `GpReport` (modèle et CRUD seulement, l'écran est au lot 10), et pour chaque séance le rappel des conseils de la séance précédente.
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
| Récapitulatif     | Carte identité (âge, téléphone cliquable, e-mail, situation familiale, profession, médecin traitant + dernier compte rendu), chiffres clés (poids actuel, IMC, MB, écart depuis le bilan), courbe de poids avec les faits marquants, dernière séance en bref (conseils donnés), « Aime / N'aime pas », allergies bien visibles |
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

Pendant une consultation la conversation saute d'un sujet à l'autre : la saisie n'est donc **pas** un assistant en étapes mais une seule page, dans l'ordre de sa feuille. En revanche, **se remémorer l'histoire du patient avant de commencer** est un moment à part, crucial, qui mérite son propre écran. D'où deux temps :

**Temps 1 — « Avant de commencer »** (en pleine page)
- S'affiche quand on démarre une nouvelle séance. Contenu : le récapitulatif du lot 4 en grand et lisible : histoire (motif, dossier médical), courbe de poids avec faits marquants, dernière séance (travail fait, conseils donnés), « Aime / N'aime pas », allergies.
- Un seul gros bouton : **« Commencer la séance »**.

**Temps 2 — la séance**
- Au clic, le récapitulatif **glisse vers la gauche** et devient un panneau étroit « Rappel » ; les champs de la séance arrivent au centre. L'animation est courte (≈ 300 ms, désactivée si l'appareil demande moins d'animations) : elle sert à montrer où le résumé est parti.
- Le panneau a une **poignée toujours visible** sur son bord (icône + « Rappel », flèche qui indique ouvrir / fermer), assez grande pour le doigt. La première fois, une bulle explique : « Le résumé du dossier reste ici, touchez pour l'ouvrir ou le fermer. » Son état (ouvert / fermé) est mémorisé.
- iPad portrait : le panneau passe par-dessus la séance (tiroir) au lieu de la pousser.
- Rouvrir une séance passée saute le temps 1 et arrive directement sur la saisie, panneau fermé.

**Champs de la séance**, dans l'ordre :
  1. Ligne d'en-tête : date (aujourd'hui), formule (pré-remplie : « Bilan » pour la première séance, « Suivi » ensuite), moyen de paiement (pré-rempli avec le dernier utilisé pour ce patient). Numéro affiché : « Bilan », « Suivi 3 »…
  2. **Retour sur les conseils** de la séance précédente : le texte de ces conseils, trois gros boutons « Appliqué / En partie / Pas appliqué » et un commentaire facultatif. Absent pour un bilan.
  3. Poids → IMC, MB MJ et MB kcal calculés aussitôt, en grandes tuiles, avec l'écart depuis la dernière séance et depuis le bilan.
  4. Habitudes et évolution · Travail en consultation — grandes zones de texte qui s'agrandissent avec le contenu.
  5. Aime / N'aime pas — étiquettes ajoutées en un geste, liste du patient déjà affichée.
  6. Conseils diététiques — grande zone de texte.
  7. Fait marquant — « + Ajouter un fait marquant » (date + une ligne).
  8. « Pour aller plus loin » replié : mesures complémentaires, et les rubriques du dossier médical modifiables sans quitter la séance.
- Enregistrement automatique partout, indicateur visible.
- Plus de « Finaliser » ni « Abandonner » : un bouton **« Terminer la séance »** ramène à la fiche et propose, dans une petite fenêtre, les deux suites naturelles : « Faire la facture » et « Prendre le prochain rendez-vous ». « Supprimer la séance » est dans un menu secondaire, avec confirmation (si elle est facturée, voir le tableau des erreurs du lot 5).
- Une séance passée se rouvre et se modifie exactement comme une séance du jour.
- Fini quand : une séance complète se saisit sur iPad paysage sans quitter la page, les calculs correspondent au cas de test de § 3.1, et une ancienne séance se corrige.

### Lot 8 — Accueil et pages restantes

- **Tableau de bord** simplifié : « Aujourd'hui » en grandes cartes (heure, patient, bouton « Démarrer la séance » ou « Rouvrir »), « À relancer » (sans séance depuis 6 semaines), « Factures à faire » (séances sans facture), « Tâches ». Retirer « Séances à finaliser ».
- Appliquer la charte à : liste des patients (archivés dans un filtre, plus de tags/statuts), agenda et formulaire de RDV, détail RDV, pages admin (utilisateurs, journal d'accès), connexion / mot de passe oublié, page 404.
- Fini quand : plus aucune page n'utilise une largeur, une carte ou une couleur hors charte (`grep` des couleurs Tailwind en dur dans `pages/` et `components/` hors `ui/` → vide).

### Lot 10 — Compte rendu au médecin

Contexte : c'est la tâche qu'elle redoute. Elle doit recouper sa feuille, ses notes papier, l'évolution du poids, puis tout rédiger. L'app a déjà toutes ces données : elle peut lui préparer le brouillon.

- Depuis la fiche patient : **« Rédiger un compte rendu »** ouvre un éditeur de texte simple **pré-rempli à partir du dossier** (sans IA) :
  - en-tête : cabinet (lot 3), médecin traitant, date ;
  - patient : nom, âge, motif de consultation ;
  - suivi : date du bilan, nombre de séances, date de la dernière ;
  - évolution : poids et IMC au bilan → aujourd'hui, écart, MB actuel ;
  - éléments du dossier : valeur actuelle des rubriques renseignées (santé, antécédents, activité, glycémie…) ;
  - conseils donnés : ceux des dernières séances, avec le retour (appliqué / en partie / pas appliqué) ;
  - formule de politesse et signature.
- Elle modifie librement le texte ; enregistrement automatique. Le brouillon est enregistré en base (`GpReport`) et retrouvable dans la fiche.
- Export PDF sur papier à en-tête du cabinet, puis « Marquer comme envoyé » (date d'envoi).
- Le récapitulatif de la fiche affiche « Compte rendu : à faire » s'il existe un brouillon, ou « envoyé le … ».
- Fini quand : sur le patient du seed, le brouillon généré contient les bons chiffres (cas de test § 3.1) et se relit comme une lettre, pas comme un export de base de données.

**Plus tard (hors de ce plan) — rédaction assistée par IA** : elle écrit une consigne courte (« insister sur la perte de poids et le travail émotionnel ») et l'IA rédige à partir du dossier. À cadrer avant de commencer, car ce sont des données de santé : n'envoyer que des données pseudonymisées (ni nom, ni date de naissance, ni coordonnées : âge, sexe, chiffres et notes uniquement), fournisseur sans conservation des données et hébergé dans l'UE, information du patient, et question de l'hébergement de données de santé (HDS).

### Lot 9 — Nettoyage, tests et documentation

À faire en dernier, après tous les autres lots.


- Supprimer ce qui ne sert plus (composants, routes, types, clés) — normalement déjà fait lot par lot, à vérifier.
- Réécrire les tests Playwright (`apps/frontend/e2e/`) sur les parcours réels : créer un patient avec l'assistant, faire un bilan, émettre la facture, corriger une ancienne séance. Les faire tourner en CI si le coût le permet.
- Remonter les seuils de couverture du frontend.
- Mettre à jour `docs/PLAN.md` (dossier patient, décisions produit, modèle de données) et les README.

---

## 5. À valider avec Valérie

Ces points ne bloquent pas le démarrage mais peuvent ajuster les lots concernés.

Déjà tranché : le « Compte rendu : À faire » est bien celui au médecin traitant (lot 10). Elle n'utilise pas Doctolib : l'agenda de l'app est son seul agenda et reste central.

**Le plus utile : l'observer.** 30 minutes à la regarder préparer puis mener une séance (réelle avec accord du patient, ou simulée) en apprendront plus que les questions. Noter tout ce qu'elle cherche, recopie, calcule de tête ou écrit sur papier.

**Questions pour séparer « pas utile » de « pas possible avec le tableur »** :

1. Qu'écrivez-vous sur papier pendant la séance qui n'arrive jamais dans la feuille ?
2. Avant une séance, qu'est-ce qui vous prend du temps à retrouver ?
3. Les lignes « Suivi 4 » à « Suivi 10 » déjà prêtes, avec « Non » en formule : prévoyez-vous un nombre de séances, ou vendez-vous des forfaits (bilan + N suivis) ? Si oui, l'app pourrait suivre les séances restantes d'un forfait.
4. Aime / N'aime pas en étiquettes (lot 7) : est-ce que ça vous convient, ou préférez-vous écrire des phrases ?
5. Glycémie, cholestérol : aimeriez-vous voir leur évolution en graphique, comme le poids ?
6. Remettez-vous des documents aux patients (plans alimentaires, menus, fiches conseils) ? Une bibliothèque de documents types pourrait les envoyer ou les imprimer en un geste.
7. Le retour sur les conseils (« appliqué / en partie / pas appliqué ») correspond-il à votre façon de faire le point en début de séance ?

**Pratique et facturation** :

8. Moyens de paiement : espèces, chèque, carte, virement — en manque-t-il ?
9. Mention TVA, numérotation, avoir ou simple annulation : à vérifier avec son comptable.
10. Envoi de la facture par e-mail au patient : utile ? (pas prévu ici ; Brevo est déjà branché, ce serait un petit lot de plus.)
11. Jours de consultation : travaille-t-elle le samedi ou le dimanche ? (le lot 0 affiche les 7 jours dans tous les cas.)
12. Calculs : confirmer sur sa feuille Numbers les formules exactes. D'après ses chiffres : Black et al. avec k = 0,963, kcal = MJ × 1000 / 4,185, et l'âge reste-t-il celui du bilan ou change-t-il à chaque séance ?
