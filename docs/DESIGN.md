# Charte visuelle et composants

> Contrat d'interface de la refonte (voir `docs/REFONTE.md` § 2 et § 3.3).
> Tout écran nouveau ou migré suit ce document. Si un besoin n'y est pas couvert, on complète ce document dans la même PR plutôt que d'inventer un style local.

Les utilisatrices sont des soignantes : sur iPad pendant la consultation (paysage surtout, portrait toléré), sur ordinateur pour l'administratif. L'interface doit être **grande, calme et prévisible** : peu d'éléments par écran, une action principale bien visible, les mêmes composants partout.

---

## 1. Couleurs

Les couleurs viennent du logo (`apps/frontend/public/logo_full_transparent.png`) : le vert feuille de « Dietetic Center » devient la couleur principale, le turquoise du « VP » la couleur secondaire, le vert poire de la mascotte un accent doux. Les teintes du logo sont trop claires pour du texte ; les valeurs ci-dessous sont des versions assombries (mode clair) ou éclaircies (mode sombre) qui tiennent le **contraste AA** (4,5:1 pour le texte, 3:1 pour les bordures de champ et l'anneau de focus).

Les variables sont dans `apps/frontend/src/styles/globals.css` (`:root` pour le clair, `.dark` pour le sombre), au format HSL `H S% L%` comme le veut shadcn/ui. Elles sont exposées à Tailwind : `bg-primary`, `text-area-patients`, `bg-success-soft`… **Aucune couleur Tailwind en dur** (`bg-blue-100`, `text-emerald-600`…) dans le nouveau code : si une couleur manque, on ajoute une variable.

### 1.1 Base

| Variable                 | Clair     | Sombre    | Usage                                                     |
| ------------------------ | --------- | --------- | --------------------------------------------------------- |
| `--background`           | `#F6F8F3` | `#0F1712` | Fond de l'app (légèrement vert, moins dur que le blanc)   |
| `--foreground`           | `#1B2A21` | `#E4ECE5` | Texte principal (vert très foncé, celui du contour poire) |
| `--card`                 | `#FFFFFF` | `#17221B` | Cartes, sections, barre latérale, en-tête                 |
| `--popover`              | `#FFFFFF` | `#17221B` | Menus, listes déroulantes, fenêtres                       |
| `--primary`              | `#3D7A2C` | `#86C467` | Vert feuille : bouton principal, lien, état actif, focus  |
| `--primary-foreground`   | `#FFFFFF` | `#0F1A0C` | Texte sur `primary`                                       |
| `--secondary`            | `#E3F2EE` | `#143A33` | Turquoise doux : bouton secondaire                        |
| `--secondary-foreground` | `#14594D` | `#9FE0D2` | Texte sur `secondary`                                     |
| `--accent`               | `#EEF5D3` | `#26341C` | Vert poire doux : survol, élément sélectionné d'un menu   |
| `--accent-foreground`    | `#2E4A1B` | `#D8EBA6` | Texte sur `accent`                                        |
| `--muted`                | `#EDF1E8` | `#1F2C24` | Fonds discrets (en-tête de tableau, champ de recherche)   |
| `--muted-foreground`     | `#56655B` | `#A3B3A8` | Texte secondaire, aides, sous-titres                      |
| `--destructive`          | `#B42D24` | `#E5675D` | Supprimer, désactiver, erreurs de champ                   |
| `--border`               | `#D9E0D3` | `#2B3A31` | Bordures de cartes et séparateurs                         |
| `--input`                | `#8A9885` | `#6A7E71` | Bordure des champs (3:1 sur la carte)                     |
| `--ring`                 | `#3D7A2C` | `#86C467` | Anneau de focus clavier                                   |

Couleurs du logo, **décoratives uniquement** (illustrations, mascotte, jamais pour du texte) : `--brand-leaf` `#7DAA4F`, `--brand-teal` `#4DBFA8`, `--brand-pear` `#D6E87C`, `--brand-ink` `#1F3A2B`, `--brand-blush` `#F2A7A0` (joues de la mascotte). Classes : `fill-brand-pear`, `stroke-brand-ink`…

### 1.2 Couleurs sémantiques (badges, alertes)

Chaque ton a une couleur forte (texte, icône) et une version douce (fond). Le texte fort sur le fond doux tient 4,5:1.

| Ton       | Fort clair | Doux clair | Fort sombre | Doux sombre | Sens                                          |
| --------- | ---------- | ---------- | ----------- | ----------- | --------------------------------------------- |
| `success` | `#2F7A3A`  | `#E3F3E2`  | `#7FCB86`   | `#173322`   | Fait, actif, réglé                             |
| `warning` | `#8A5A00`  | `#FCF1D6`  | `#E9B95A`   | `#382A10`   | À faire, en attente d'action, brouillon        |
| `danger`  | `#B42D24`  | `#FBE6E3`  | `#F08A80`   | `#3D1A17`   | Annulé, désactivé, urgent                      |
| `info`    | `#1F6390`  | `#E1EEF8`  | `#7DB8E8`   | `#132D42`   | Prévu, en cours, information neutre utile      |
| `neutral` | `#56655B`  | `#EDF1E8`  | `#A3B3A8`   | `#1F2C24`   | Archivé, autre, sans importance particulière   |

Classes : `text-success bg-success-soft`, etc. `StatusBadge` les utilise ; ne pas refaire de badge à la main.

### 1.3 Une couleur par espace

Chaque grand espace a sa couleur, reprise dans la barre latérale (icône), l'icône du `PageHeader` et les icônes de `Section`. Elle aide à savoir où l'on est. La source unique est `apps/frontend/src/components/layout/areas.ts`.

| Espace              | Clé        | Fort clair | Doux clair | Fort sombre | Doux sombre | Icône (lucide)    |
| ------------------- | ---------- | ---------- | ---------- | ----------- | ----------- | ----------------- |
| Accueil             | `home`     | `#3D7A2C`  | `#EAF4E3`  | `#86C467`   | `#1F3318`   | `LayoutDashboard` |
| Patients            | `patients` | `#167565`  | `#DDF1EC`  | `#5CCDB6`   | `#123630`   | `Users`           |
| Agenda              | `agenda`   | `#2563A6`  | `#E1ECF8`  | `#7DB0EC`   | `#152B45`   | `CalendarDays`    |
| Factures            | `invoices` | `#9A5B0B`  | `#FBEEDB`  | `#E7AE5C`   | `#3A2910`   | `Receipt`         |
| Paramètres          | `settings` | `#52606D`  | `#E9EDF0`  | `#A9B6C2`   | `#232C33`   | `Settings`        |
| Utilisateurs        | `users`    | `#8E3F72`  | `#F6E4EF`  | `#E08CC2`   | `#3A1830`   | `UserCog`         |
| Journal d'accès     | `audit`    | `#5B55A0`  | `#ECEAF7`  | `#A9A3E6`   | `#24223F`   | `ScrollText`      |

Classes : `text-area-patients`, `bg-area-patients-soft`. La couleur d'espace sert aux **icônes et repères**, pas aux boutons : le bouton principal reste `primary` partout, pour qu'on le reconnaisse d'un écran à l'autre.

### 1.4 Vérifier le contraste

Toute nouvelle couleur est vérifiée en clair **et** en sombre : 4,5:1 pour un texte, 3:1 pour une icône seule, une bordure de champ ou un anneau de focus. Le calcul utilisé est celui des WCAG 2.1 (luminance relative).

## 2. Typographie

Police système (`font-sans` de Tailwind), aucune police à télécharger. **Texte de base 16 px.**

| Rôle                         | Classe                      | Taille     | Graisse    |
| ---------------------------- | --------------------------- | ---------- | ---------- |
| Titre de page (`PageHeader`) | `text-2xl sm:text-3xl`      | 24 → 30 px | `semibold` |
| Titre de section / fenêtre   | `text-xl`                   | 20 px      | `semibold` |
| Sous-titre, intertitre       | `text-lg`                   | 18 px      | `medium`   |
| Texte courant, champs, boutons, menus | `text-base`        | 16 px      | `normal` / `medium` |
| Secondaire (aide, sous-titre de page, en-tête de tableau, badge) | `text-sm` | 14 px | `normal` / `medium` |
| Mentions techniques uniquement (raccourci clavier, identifiant technique, date de version) | `text-xs` | 12 px | `normal` |

- Pas de texte plus petit que 12 px, pas de `text-[10px]`.
- Pas de texte en capitales pour les titres ; les en-têtes de tableau restent en casse normale.
- Interlignage par défaut de Tailwind ; `leading-relaxed` pour les longs textes (notes, conseils).

## 3. Espacements, formes, ombres

- Échelle Tailwind (4 px). Valeurs usuelles : `gap-2` (8) entre icône et texte, `gap-3`/`gap-4` entre éléments d'une ligne, `space-y-6` (24) entre sections d'une page, `p-5 sm:p-6` dans une carte.
- Marges de page (gabarit) : `px-4 py-6` sur iPad portrait, `px-6 lg:px-8 lg:py-8` au-delà.
- Rayon : `--radius` = 0,75 rem (12 px). `rounded-xl` pour les cartes, `rounded-lg` pour les boutons et champs, `rounded-full` pour les badges et pastilles.
- Ombres très légères (`shadow-sm`) sur les cartes ; les fenêtres et menus ont `shadow-lg`. Pas d'ombres décoratives.

## 4. Largeur de page

Une seule largeur, centrée, pour toutes les pages ; une variante large pour les écrans qui ont besoin de place.

| Variante  | Largeur max            | Pages                                              |
| --------- | ---------------------- | -------------------------------------------------- |
| `default` | `max-w-5xl` (1024 px)  | Toutes, y compris fiche patient et détail de RDV   |
| `wide`    | `max-w-screen-2xl` (1536 px) | Agenda (`/appointments`) et séance (`/consultations/:id`) |

C'est le gabarit `PageShell` (`components/layout/PageShell.tsx`), utilisé par `AppLayout`, qui fixe largeur et marges selon l'adresse (`getPageWidth`). **Une page ne pose plus de `max-w-*` ni de `mx-auto` sur son conteneur racine** : quand on migre une page, on retire ces classes. Pour passer une nouvelle page en large, on l'ajoute dans `getPageWidth`.

## 5. Règles tactiles et d'accès

- **Cibles ≥ 44 × 44 px** : boutons (`h-11`), champs (`h-11`), éléments de menu (`min-h-11`), liens de la barre latérale, boutons-icônes (`size-11`). La taille `sm` des boutons garde 44 px de haut (texte et marges plus petits) ; ne pas réduire les boutons par `className="h-8"` dans le nouveau code.
- **Rien qui ne marche qu'au survol** : pas d'information seulement dans un `title` ou une infobulle, pas d'action qui n'apparaît qu'au survol d'une ligne. Une infobulle peut répéter un libellé visible, jamais le remplacer. Les boutons-icônes ont un `aria-label`.
- **Clavier virtuel** : les champs sont dans le flux normal de la page (pas de pied de page fixe qui recouvre le champ actif) ; les fenêtres longues défilent.
  - Un formulaire de plusieurs champs pose le hook `useKeepFieldVisible` (`hooks/useKeepFieldVisible.ts`) sur son conteneur : il fait défiler le champ actif au-dessus du clavier de l'iPad (qui recouvre `<main>` sans le redimensionner) et donne la hauteur cachée (`keyboardInset`) à ajouter en bas. Sur une fenêtre, il la remonte en haut de l'écran (voir `AppointmentFormDialog`).
  - Bon clavier pour chaque champ : `type="tel"` + `inputMode="tel"`, `type="email"` + `inputMode="email"`, `inputMode="decimal"` pour une taille ou un poids, `inputMode="numeric"` pour un âge ou un code postal. `focusNextOnEnter` sur le `<form>` : la touche « Suivant » passe au champ suivant et n'envoie le formulaire que depuis le dernier.
- Focus visible partout (`ring-2 ring-ring`), ordre de tabulation naturel.
- Une couleur n'est jamais la seule information : un badge a toujours un libellé, une erreur un texte.

### Barre latérale

- Ordinateur et iPad paysage (≥ 1024 px) : ouverte (libellés en `text-base`, icône colorée de l'espace). Un bouton la réduit en rail d'icônes ; le choix est mémorisé (`Alt+S` aussi).
- iPad portrait et plus étroit (< 1024 px) : rail d'icônes par défaut, avec un bouton « Menu » qui ouvre la barre complète par-dessus la page. Elle se referme au choix d'une page, d'un appui hors du menu ou avec Échap.
- État actif évident : fond doux de l'espace, icône et texte dans sa couleur, barre verticale à gauche, `aria-current="page"`.

## 6. Composants partagés

Un seul composant par usage. Ils sont dans `apps/frontend/src/components/shared/` (et `layout/` pour le gabarit) ; les primitives shadcn sont dans `components/ui/`.

| Composant      | Quand l'utiliser                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PageHeader`   | En haut de **chaque** page : `title`, `subtitle` optionnel, `back` (`{ to, label }`) pour les pages de détail, `actions` (le bouton principal à droite, au plus un ou deux), `area` pour l'icône colorée de l'espace. |
| `Section`      | Toute carte de contenu : `icon` + `title` + `description` optionnelle + `action` optionnelle (en haut à droite) + contenu. `area` ou `tone` colore la pastille de l'icône. Remplace `Block`, `Panel`, `InfoCard` et les `Section` locales. `Card` brut seulement pour un cas qui n'a pas de titre (barre de filtres, tableau seul). `size="compact"` (titre `text-lg`, marges réduites, action toujours sur la ligne du titre) pour les écrans denses : récapitulatif du patient, panneau « Rappel » de la séance, cartes en colonnes étroites. |
| `Field`        | Tout champ de formulaire : `label`, `hint` (aide sous le libellé), `required` (affiche « obligatoire » en toutes lettres, pas d'astérisque), `error`. Il relie lui-même libellé, aide et erreur au champ (`id`, `aria-describedby`, `aria-invalid`). |
| `EmptyState`   | Liste ou zone vide : `illustration="pear"` (mascotte souriante) ou `"pear-calm"` (yeux fermés, « rien à faire »), sinon `icon` + `area`, `title` (une phrase), `description` optionnelle, `action` (le bouton qui fait avancer). Exemple : « Aucune séance pour l'instant » + « Démarrer le bilan ». |
| `Stepper`      | Assistants en plusieurs étapes (création de patient, etc.) : `steps` (`label`, `description` optionnelle) et `current` (index). Avec `onStepClick`, on peut revenir à une étape terminée ; jamais sauter en avant. |
| `StatusBadge`  | Tout statut ou type affiché en pastille. Couleurs via les tons sémantiques (§ 1.2). Un nouveau statut s'ajoute dans sa table, avec un libellé français. |
| `PearMascot`   | Illustration simple de la mascotte (SVG, aucune image) pour états vides, accueil, fin d'assistant. `mood` : `happy` (défaut) ou `calm`. |
| `SaveIndicator`| Sous tout champ enregistré automatiquement (avec le hook `useAutosave` : enregistre peu après la frappe et en quittant le champ) : « Enregistrement… », « Enregistré à 14 h 32 », ou l'erreur en clair. Rien avant la première modification. |
| `ConfirmDialog`| Toute suppression ou action irréversible : titre en question, conséquence en une phrase, bouton d'action nommé (« Désactiver », pas « Confirmer »). |
| `PageShell`    | Gabarit de page (largeur, marges). Posé par `AppLayout`, pas par les pages. |

Boutons (`components/ui/button.tsx`) :

- `default` (vert plein) : **l'action principale de l'écran, une seule**.
- `outline` ou `secondary` : actions secondaires.
- `ghost` : actions tertiaires, boutons-icônes dans un en-tête.
- `destructive` : seulement dans la fenêtre de confirmation, pas dans la page.
- Toujours un libellé verbe + objet (« Nouveau compte », « Enregistrer la séance »). Icône à gauche facultative.

Tableaux : en-tête `text-sm text-muted-foreground` sur fond `muted`, cellules `text-base`, lignes d'au moins 56 px. Les actions d'une ligne sont des boutons visibles (pas un menu `…` caché quand il n'y a que deux actions), ou un menu `…` d'au moins 44 px.

## 7. Ton des textes

- **Français, vouvoiement**, phrases courtes. Une idée par phrase.
- **Ses mots** : ceux de la feuille de Valérie (« Bilan », « Suivi », « Habitudes et évolution », « Conseils diététiques »), pas de vocabulaire de logiciel (« entité », « enregistrement », « synchroniser », « valider le formulaire »).
- Accents et typographie française : « Paramètres », « Déconnexion », espace insécable avant `:` `?` `!`, apostrophe typographique `’`.
- Boutons : verbe à l'infinitif + objet (« Créer le compte », « Ajouter une mesure »). Pas de « OK », « Valider », « Soumettre ».
- États vides : ce qui manque + ce qu'on peut faire (« Aucun compte ne correspond à cette recherche. »).
- Erreurs : ce qui ne va pas + comment corriger, sans reproche ni code (« L’adresse e-mail n’est pas valide. »). Jamais de message technique brut (`500`, `undefined`).
- Confirmations : la question porte sur l'action (« Désactiver le compte de Marie Dupont ? ») et la conséquence est dite (« Elle ne pourra plus se connecter. »).
- Enregistrement automatique : indicateur discret « Enregistré à 14 h 32 ».
- Dates : « lundi 3 mars », heures « 14 h 30 » ; pas de format technique (`2026-03-03`).

## 8. Mode sombre

Gardé, choisi par l'utilisatrice (bouton soleil/lune de l'en-tête, mémorisé). Il suit la même palette (valeurs § 1). Tester chaque écran migré dans les deux modes.

## 9. Migrer une page

1. Retirer `max-w-*`/`mx-auto` du conteneur racine (le gabarit s'en charge).
2. Remplacer le titre maison par `PageHeader` (avec `area`).
3. Remplacer les cartes locales (`Block`, `Panel`, `InfoCard`, `Section` locale) par `Section`.
4. Remplacer les champs maison par `Field` + `Input`/`Select`/`Textarea`.
5. Remplacer les vides par `EmptyState`, les badges de couleur par `StatusBadge`.
6. Remplacer `text-sm` par `text-base` pour le contenu, `text-xs` par `text-sm` sauf mention technique ; retirer les couleurs Tailwind en dur.
7. Vérifier à 1180 × 820 (iPad paysage), 820 × 1180 (iPad portrait) et 1440 px, en clair et en sombre.

La page témoin est `apps/frontend/src/pages/admin/UsersPage.tsx` (et `components/admin/UserFormDialog.tsx`).
