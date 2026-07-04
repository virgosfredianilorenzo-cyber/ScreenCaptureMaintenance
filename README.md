# ScreenCaptureMaintenance

Outil e-learning auteur pour capturer des parcours applicatifs et les publier comme activités interactives SCORM 1.2 ou xAPI.

## Concept

Un **formateur** capture une séquence de screenshots d'un logiciel, annote chaque étape (zones cliquables, instructions, feedbacks), puis exporte un package prêt à uploader dans un LMS.

L'**apprenant** reproduit le parcours en trois modes :
- **Démo** — lecture passive, les zones correctes sont surlignées
- **Simulation** — l'apprenant interagit, feedback immédiat, pas de score
- **Évaluation** — interactions tracées, score envoyé au LMS via SCORM 1.2 ou xAPI

## État du projet

| Module | Statut |
|---|---|
| Serveur Express + API capture/galerie | ✅ Plan 1 — terminé |
| Module Auteur (parcours, éditeur canvas) | ✅ Plan 2 — terminé |
| Module Player (démo / simulation / évaluation) | 🔜 Plan 3 |
| Export SCORM 1.2 / xAPI | 🔜 Plan 4 |
| Assistance IA (Claude API, optionnelle) | 🔜 Plan 5 |

---

## Prérequis

### Node.js 18+

Vérifie ta version :

```bash
node --version
```

> **Résultat attendu :** `v18.x.x` ou supérieur.  
> Si Node.js n'est pas installé, télécharge-le depuis [nodejs.org](https://nodejs.org/) (choisis la version LTS).

Sur Ubuntu/Debian, tu peux aussi l'installer via le terminal :

```bash
sudo apt install nodejs npm
node --version
```

### Outil de capture (Linux uniquement)

```bash
sudo apt install scrot
```

> Sur macOS et Windows, aucune dépendance système supplémentaire n'est nécessaire.

---

## Installation

**1. Télécharge le projet**

```bash
git clone https://github.com/virgosfredianilorenzo-cyber/ScreenCaptureMaintenance.git
```

> Si tu n'as pas `git` : `sudo apt install git`

**2. Entre dans le dossier**

```bash
cd ScreenCaptureMaintenance
```

**3. Installe les dépendances**

```bash
npm install
```

> `npm install` lit le fichier `package.json` et télécharge toutes les bibliothèques nécessaires dans un dossier `node_modules/`. Cela peut prendre une minute.  
> **Résultat attendu :** `added X packages` sans erreur.

**4. Crée le fichier de configuration**

```bash
cp config.example.json config.json
```

> Cette commande copie le fichier d'exemple pour créer ton propre `config.json`. Ce fichier n'est pas versionné (il ne sera pas envoyé sur GitHub), ce qui te permet d'y mettre ta clé API en toute sécurité.

**5. Édite la configuration** (optionnel)

Ouvre `config.json` dans un éditeur de texte et ajuste selon tes besoins :

```json
{
  "port": 3000,
  "dataDir": "./data",
  "capture": {
    "intervalMs": 2000
  },
  "ai": {
    "enabled": false,
    "apiKey": "",
    "model": "claude-sonnet-4-6",
    "maxAttemptsPerStep": 3
  },
  "export": {
    "defaultPassingScore": 70
  }
}
```

| Clé | Description |
|---|---|
| `port` | Port du serveur local (défaut : 3000) |
| `dataDir` | Répertoire de stockage des captures et parcours |
| `capture.intervalMs` | Intervalle entre deux captures automatiques (ms) |
| `ai.enabled` | Met `true` pour activer l'assistance IA |
| `ai.apiKey` | Ta clé API Anthropic (voir ci-dessous) |
| `export.defaultPassingScore` | Seuil de réussite par défaut à l'export (%) |

### Obtenir une clé API Anthropic (optionnel)

L'assistance IA est optionnelle. Si tu veux l'activer :

1. Crée un compte sur [console.anthropic.com](https://console.anthropic.com)
2. Dans le menu, va dans **API Keys** et génère une clé
3. Colle-la dans `config.json` → `ai.apiKey` et mets `ai.enabled` à `true`

> Ta clé ne sera jamais incluse dans les exports SCORM/xAPI — elle reste uniquement dans ton `config.json` local.

---

## Démarrage

```bash
npm start
```

Ouvre [http://localhost:3000](http://localhost:3000) dans ton navigateur.

**Pour arrêter le serveur :** appuie sur `Ctrl+C` dans le terminal.

**Les prochaines fois**, il suffit de faire :

```bash
cd ScreenCaptureMaintenance
npm start
```

---

## Premier parcours — Guide pas à pas

> Ce guide te montre comment créer un parcours pédagogique complet, de la capture d'écran à l'étape annotée. Aucune connaissance technique requise.

### Étape 1 — Démarre le serveur

```bash
npm start
```

Ouvre [http://localhost:3000](http://localhost:3000) dans ton navigateur. Tu vois l'interface en trois colonnes :

| Colonne gauche | Colonne centrale | Colonne droite |
|---|---|---|
| Galerie des captures | Éditeur de l'étape courante | *(non utilisé pour l'instant)* |

La timeline des étapes du parcours se trouve **en bas** de l'écran.

---

### Étape 2 — Capture des écrans

1. Dans la barre d'outils en haut, clique sur **"Capturer"**.
   - L'outil commence à prendre une photo de ton écran toutes les 2 secondes.
   - Les captures apparaissent dans la galerie à gauche au fur et à mesure.

2. Navigue dans l'application que tu veux documenter (clics, menus, formulaires…).

3. Une fois la séquence capturée, clique sur **"Stop"**.

> **Astuce :** Tu peux aussi cliquer sur **"Capture unique"** pour ne prendre qu'une seule photo à la demande.

---

### Étape 3 — Crée un parcours

1. Dans la barre d'outils, clique sur **"+ Nouveau"** (à côté du menu déroulant des parcours).
2. Saisis un nom, par exemple `Prise en main du logiciel X`.
3. Clique OK — le parcours apparaît dans le sélecteur et la timeline (vide) s'affiche en bas.

---

### Étape 4 — Ajoute des étapes à la timeline

1. Dans la galerie à gauche, repère la capture que tu veux utiliser comme première étape.
2. **Glisse-dépose** la vignette vers la timeline en bas de l'écran.
   - Une carte apparaît dans la timeline avec un numéro d'ordre.
3. Répète pour chaque capture pertinente, dans l'ordre logique.

> **Réordonnancer :** tu peux glisser-déposer les cartes de la timeline entre elles pour changer leur ordre.

> **Supprimer une étape :** clique sur le **×** en haut à droite de la carte.

---

### Étape 5 — Annote une étape dans l'éditeur

1. Dans la timeline, clique sur une carte d'étape — la capture s'affiche dans l'éditeur central.
2. Dans la barre d'outils de l'éditeur, choisis un outil :

   | Outil | Usage |
   |---|---|
   | **Hotspot** | Dessine une zone interactive (rectangle) sur l'écran |
   | **Texte** | Ajoute une annotation textuelle sur l'image |
   | **Flèche** | Sélectionne / déplace les objets existants |

3. **Créer un hotspot :** sélectionne l'outil Hotspot, puis clique-glisse sur la zone de l'image à mettre en évidence.
4. **Ajouter du texte :** sélectionne l'outil Texte, clique sur l'image, puis tape ton annotation.
5. Dans le formulaire à droite du canvas, remplis :
   - **Titre** — nom court de l'étape (`Cliquer sur "Fichier"`)
   - **Instruction** — consigne affichée à l'apprenant (`Cliquez sur le menu Fichier pour continuer.`)

6. Clique sur **"Enregistrer"** — l'étape est sauvegardée.

> **Supprimer un objet :** sélectionne-le sur le canvas et clique sur **"Supprimer l'objet"** dans la barre.

---

### Étape 6 — Crée une nouvelle version (optionnel)

Si tu veux garder une version de référence de ton parcours avant de le modifier :

1. Dans le sélecteur de parcours, clique sur **"⎇ Version"**.
2. Donne un label à la version (ex : `v2-refonte`).
3. Une nouvelle version vide est créée — elle repart de zéro mais tu peux retrouver l'ancienne via le sélecteur.

---

### Résumé du workflow

```
npm start
    │
    ├─ Capturer des écrans  →  galerie
    ├─ Créer un parcours    →  sélecteur
    ├─ Glisser des captures →  timeline
    ├─ Annoter chaque étape →  éditeur canvas
    └─ Enregistrer
```

Tes données sont sauvegardées dans le dossier `data/` — aucune connexion internet requise.

---

## Tests

```bash
npm test
```

47 tests unitaires et d'intégration (Jest + Supertest).

---

## Sécurité

Audit Plan 1 effectué (2026-05-25) — aucune CVE dans les dépendances (`npm audit`).

Corrections appliquées :
- **XSS** : remplacement de `innerHTML` par des API DOM dans la galerie client ; échappement `p.title` dans la toolbar
- **Path traversal** : validation `entry.filename === <uuid>.png` (galerie) ; `path.basename(captureFilename)` (steps)
- **Validation d'entrée** : format UUID vérifié sur `DELETE /api/gallery/:id` (→ 400 si invalide)
- **Intégrité des données** : whitelist des champs modifiables dans `updateStep` ; validation des IDs dans `reorderSteps`
- **Dépendance morte** : paquet `uuid` supprimé (remplacé par `crypto.randomUUID`)

---

## Structure du projet

```
src/
  server/
    index.js                  ← Bootstrap Express
    config.js                 ← Chargement config.json
    middleware/
      errorHandler.js
    services/
      fileService.js          ← Lecture/écriture JSON + PNG
      captureService.js       ← Capture desktop (screenshot-desktop)
      parcoursService.js      ← CRUD parcours + versioning
      stepService.js          ← CRUD étapes, réordonnancement, screenshot
    routes/
      capture.js              ← POST /api/capture/single|start|stop, GET /api/capture/status
      gallery.js              ← GET /api/gallery, DELETE /api/gallery/:id
      parcours.js             ← CRUD /api/parcours + versions
      steps.js                ← CRUD /api/parcours/:id/versions/:ver/steps
  client/
    index.html                ← Layout 3 panneaux (galerie | éditeur | timeline)
    js/
      api.js                  ← Fetch helpers (capture + parcours + steps)
      toolbar.js              ← Capture, sélecteur de parcours, création version
      gallery.js              ← Thumbnails draggables
      timeline.js             ← Timeline drag & drop (ajout + réordonnancement)
      editor.js               ← Canvas Fabric.js (hotspot + texte, save/restore)
    css/
      main.css                ← Layout global
      editor.css              ← Canvas, toolbar éditeur, timeline cards
data/                         ← Captures et parcours (gitignore)
  gallery/
    index.json
    *.png
  parcours/
    {id}/
      manifest.json           ← Métadonnées du parcours
      versions/
        {ver}/
          version.json        ← Ordre des étapes
          steps/
            {stepId}.json     ← Données de l'étape (titre, instruction, fabricJson…)
            {stepId}.png      ← Screenshot de l'étape
docs/
  superpowers/
    specs/                    ← Design documents
    plans/                    ← Plans d'implémentation
```

---

## Compatibilité

| OS | Support |
|---|---|
| Linux | ✅ (nécessite `scrot` ou `gnome-screenshot`) |
| macOS | ✅ |
| Windows | ✅ (prévu — natif via screenshot-desktop) |

---

## Documentation technique

- [Design spec complète](docs/superpowers/specs/2026-05-25-screencapturemaintenance-design.md)
- [Plan 1 — Foundation + Capture + Gallery](docs/superpowers/plans/2026-05-25-plan1-foundation-capture-gallery.md)
- [Plan 2 — Module Auteur](docs/superpowers/plans/2026-07-04-plan2-module-auteur.md)
