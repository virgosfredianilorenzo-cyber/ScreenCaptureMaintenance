# ScreenCaptureMaintenance — Design Spec

**Date :** 2026-05-25  
**Statut :** Approuvé  

---

## 1. Contexte et objectif

Outil e-learning auteur permettant à un formateur de capturer un parcours applicatif (séquence de screenshots d'un logiciel) et de le publier comme activité interactive pour des apprenants en asynchrone. L'apprenant reproduit le parcours dans le LMS selon trois modes : démo, simulation, évaluation. La publication se fait en SCORM 1.2 ou xAPI.

Contrainte centrale : quand l'interface du logiciel capturé change, le formateur doit pouvoir mettre à jour uniquement les étapes affectées sans refaire tout le parcours, et conserver un historique de versions.

---

## 2. Architecture globale

```
┌─────────────────────────────────────────────────────┐
│                  Serveur Node/Express                │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ Capture API  │  │ Parcours API │  │ Export API│  │
│  └──────────────┘  └──────────────┘  └───────────┘  │
│        │                  │                │         │
│  screenshot-desktop   JSON store      SCORM/xAPI     │
└─────────────────────────────────────────────────────┘
           │                  │
    ┌──────┴──────┐    ┌──────┴───────────────────┐
    │  Interface  │    │   Package exporté         │
    │  Auteur     │    │  (HTML autonome)          │
    │  (navigateur│    │  Démo / Simu / Éval       │
    │  local)     │    │  aucune dép. serveur Node │
    └─────────────┘    └───────────────────────────┘
```

- **Serveur :** Express + Node.js, port configurable
- **Capture desktop :** `screenshot-desktop` (cross-platform : Linux, Mac, Windows)
- **Édition :** Canvas via Fabric.js (hotspots + annotations)
- **Stockage :** fichiers JSON + PNG sur filesystem local
- **Player :** bundle HTML/JS/CSS autonome, injecté dans le package au moment de l'export
- **Architecture fichiers :** non-monolithique — chaque responsabilité dans son propre fichier

---

## 3. Modèle de données

### Structure filesystem

```
data/
  parcours/
    {parcoursId}/
      manifest.json
      versions/
        v1/
          version.json
          steps/
            {stepId}.json
            {stepId}.png
        v2/
          ...
  gallery/
    index.json
    {captureId}.png
```

### manifest.json

```json
{
  "id": "uuid",
  "title": "Titre du parcours",
  "tags": ["tag1", "tag2"],
  "currentVersion": "v2",
  "versions": ["v1", "v2"],
  "scoring": {
    "enabled": true,
    "defaultPointsPerStep": 1,
    "allowPartialCredit": true
  },
  "feedback": {
    "enabled": true,
    "showOnCorrect": true,
    "showOnIncorrect": true
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### version.json

```json
{
  "version": "v2",
  "label": "Mise à jour bouton Nouveau",
  "createdFrom": "v1",
  "createdAt": "ISO8601",
  "stepOrder": ["stepId1", "stepId2", "stepId3"]
}
```

### {stepId}.json

```json
{
  "id": "uuid",
  "order": 1,
  "title": "Titre de l'étape",
  "instruction": "Texte affiché à l'apprenant",
  "screenshot": "uuid.png",
  "scoring": {
    "enabled": true,
    "points": 1
  },
  "feedback": {
    "enabled": true,
    "correct": "Bien joué !",
    "incorrect": "Ce n'est pas le bon endroit"
  },
  "hotspots": [
    {
      "id": "uuid",
      "x": 120,
      "y": 45,
      "width": 80,
      "height": 30,
      "isCorrect": true
    }
  ],
  "annotations": [
    { "type": "arrow", "x1": 100, "y1": 200, "x2": 120, "y2": 45 },
    { "type": "text", "x": 50, "y": 100, "content": "Ici !" },
    { "type": "highlight", "x": 110, "y": 35, "width": 100, "height": 40 }
  ]
}
```

**Règle :** le paramètre de scoring/feedback au niveau de l'étape prime sur le paramètre global du parcours.

---

## 4. Module Auteur

### Interface

```
┌─────────────────────────────────────────────────────────┐
│  TOOLBAR  [● Capturer] [■ Stop] [+ Nouveau parcours]    │
├───────────────┬─────────────────────────────────────────┤
│  GALERIE      │  ÉDITEUR D'ÉTAPE                        │
│               │                                         │
│  [img] s1     │  ┌──────────────────────────────────┐  │
│  [img] s2     │  │  Screenshot (Canvas Fabric.js)   │  │
│  [img] s3     │  │  Hotspots + Annotations          │  │
│  ──────────── │  └──────────────────────────────────┘  │
│  Recherche    │  Outils: [Hotspot] [Flèche] [Texte]    │
│  Tags         │  Instruction: [___________________]    │
│               │  Points: ● Actif ○ Non  Valeur: [1]   │
│               │  Feedback: ● Actif ○ Non               │
│               │    OK: [___]  KO: [___]                │
├───────────────┴─────────────────────────────────────────┤
│  TIMELINE  [ s1 ] [ s2 ] [ s3 ] [+]  ← drag & drop     │
└─────────────────────────────────────────────────────────┘
```

### Flux de travail formateur

1. **Capture** : `● Capturer` → captures automatiques (intervalle configurable) ou manuelles → galerie brute
2. **Composition** : glisser les captures de la galerie vers la timeline
3. **Édition par étape** : dessin des hotspots, annotations, rédaction instruction et feedbacks, config scoring
4. **Remplacement d'étape** : nouvelle capture → glisser sur l'étape existante → hotspots/annotations conservés par défaut
5. **Versioning** : `Créer une version` → clone la version courante → travail sur la nouvelle sans perdre l'ancienne

### Structure de fichiers (serveur)

```
src/server/
  index.js
  routes/
    capture.js
    parcours.js
    steps.js
    gallery.js
    export.js
  services/
    captureService.js       ← logique screenshot-desktop
    parcoursService.js      ← versioning, CRUD parcours
    stepService.js          ← CRUD étapes individuelles
    fileService.js          ← lecture/écriture JSON + PNG
    exportService.js        ← orchestration export
    scormBuilder.js         ← génération imsmanifest.xml + zip
    xapiBuilder.js          ← génération tincan.xml + zip
    playerBundler.js        ← injection parcours.json dans le player
```

### Structure de fichiers (client)

```
src/client/
  index.html
  js/
    toolbar.js
    gallery.js
    editor.js               ← Canvas Fabric.js
    timeline.js
    api.js                  ← appels fetch
  css/
    main.css
    editor.css
    gallery.css
```

---

## 5. Module Player

Bundle autonome embarqué dans chaque package exporté. Aucune dépendance réseau au moment de la lecture.

### Interface

```
┌─────────────────────────────────────────────────────────┐
│  "Titre du parcours"                  Étape 3 / 8       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         Screenshot de l'étape courante                  │
│         (overlay canvas : hotspots / annotations)       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  Instruction : "Cliquez sur le bouton Nouveau"          │
│  Feedback : [zone de feedback après interaction]        │
│  [← Précédent]              [Suivant →]  [Rejouer]     │
│  Score (éval) : ██████░░░░  6/8                         │
└─────────────────────────────────────────────────────────┘
```

### Comportement par mode

| | Démo | Simulation | Évaluation |
|---|---|---|---|
| Hotspots visibles | Oui (surlignés) | Guidés | Non |
| Feedback immédiat | — | Oui (si activé) | Oui (si activé) |
| Score calculé | Non | Non | Oui (si activé) |
| Envoi LMS | Non | Non | Oui |
| Navigation | Libre | Libre | Séquentielle |

### Logique de score

- Clic correct au 1er essai → points pleins
- Clic correct après erreur(s) → 50% des points
- Échec après N essais (défaut : 3, configurable par parcours) → 0 point, passage automatique
- Score final = (points obtenus / points max) × 100
- Si aucune étape n'a de points : export sans données de score

### Structure de fichiers (player)

```
player/
  player.html
  js/
    player.js               ← orchestration modes et navigation
    engine.js               ← logique hotspots, score, feedback
    renderer.js             ← affichage screenshot + canvas overlay
    scormAdapter.js         ← interface SCORM 1.2
    xapiAdapter.js          ← interface xAPI
  css/
    player.css
  lib/
    pipwerks-scorm.js       ← lib SCORM 1.2 embarquée
    xapi.js                 ← lib xAPI embarquée
```

---

## 6. Export SCORM 1.2 / xAPI

### Formulaire d'export

```
Format :   ● SCORM 1.2   ○ xAPI (Tin Can)
Mode :     ○ Démo   ○ Simulation   ● Évaluation
Seuil de réussite : [70] %  (mode évaluation uniquement)
Nom du package : [nom-du-parcours-v2]
                              [Générer le .zip  ↓]
```

### Structure package SCORM 1.2

```
package.zip
  imsmanifest.xml
  adlcp_rootv1p2.xsd
  player.html
  js/  css/  lib/
  assets/
    step-001.png  step-002.png  ...
  data/
    parcours.json
```

### Structure package xAPI

Identique avec `tincan.xml` à la place de `imsmanifest.xml`.

### Données transmises au LMS

| Événement | SCORM 1.2 | xAPI |
|---|---|---|
| Ouverture | `lesson_status = "incomplete"` | Statement `launched` |
| Complétion | `lesson_status = "completed"` | Statement `completed` |
| Score (si activé) | `score.raw / max / min` | Statement `scored` |
| Réussite | `lesson_status = "passed"` | Statement `passed` |
| Échec | `lesson_status = "failed"` | Statement `failed` |
| Par étape (xAPI) | — | Statement `interacted` |

---

## 7. Maintenabilité

- Chaque étape est un fichier JSON + PNG indépendant → remplacement sans impact sur les autres étapes
- Le versioning clone les fichiers de la version précédente → zéro perte de l'historique
- Architecture non-monolithique : chaque service, route et composant UI dans son propre fichier
- Le player est découplé du serveur → une mise à jour du player ne casse pas les packages déjà exportés (les anciens packages embarquent leur propre version du player)

---

## 8. Stack technique

| Couche | Technologie |
|---|---|
| Serveur | Node.js + Express |
| Capture desktop | `screenshot-desktop` |
| Édition canvas | Fabric.js |
| Packaging zip | `archiver` (npm) |
| SCORM 1.2 runtime | pipwerks SCORM API Wrapper |
| xAPI runtime | ADL xAPI JS Library |
| Stockage | Filesystem local (JSON + PNG) |
| OS supportés | Linux, macOS, Windows |
