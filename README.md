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
| Module Auteur (parcours, éditeur canvas) | 🔜 Plan 2 |
| Module Player (démo / simulation / évaluation) | 🔜 Plan 3 |
| Export SCORM 1.2 / xAPI | 🔜 Plan 4 |
| Assistance IA (Claude API, optionnelle) | 🔜 Plan 5 |

## Prérequis

- **Node.js** v18 ou supérieur
- **Linux** : `scrot` ou `gnome-screenshot` pour la capture desktop
  ```bash
  sudo apt install scrot
  ```
- **macOS / Windows** : aucune dépendance système supplémentaire

## Installation

```bash
git clone https://github.com/virgosfredianilorenzo-cyber/ScreenCaptureMaintenance.git
cd ScreenCaptureMaintenance
npm install
cp config.example.json config.json
```

## Configuration

Éditer `config.json` (non versionné) :

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
| `port` | Port du serveur local |
| `dataDir` | Répertoire de stockage des captures et parcours |
| `capture.intervalMs` | Intervalle entre deux captures automatiques (ms) |
| `ai.enabled` | Active l'assistance IA (nécessite une clé API Anthropic) |
| `ai.apiKey` | Clé API Anthropic (jamais incluse dans les exports SCORM/xAPI) |
| `export.defaultPassingScore` | Seuil de réussite par défaut à l'export (%) |

## Démarrage

```bash
npm start
```

Ouvrir [http://localhost:3000](http://localhost:3000) dans le navigateur.

## Tests

```bash
npm test
```

20 tests unitaires et d'intégration (Jest + Supertest).

## Sécurité

Audit Plan 1 effectué (2026-05-25) — aucune CVE dans les dépendances (`npm audit`).

Corrections appliquées :
- **XSS** : remplacement de `innerHTML` par des API DOM dans la galerie client
- **Path traversal** : validation que `entry.filename === <uuid>.png` avant suppression de fichier
- **Validation d'entrée** : format UUID vérifié sur `DELETE /api/gallery/:id` (→ 400 si invalide)
- **Dépendance morte** : paquet `uuid` supprimé (remplacé par `crypto.randomUUID`)

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
    routes/
      capture.js              ← POST /api/capture/single|start|stop, GET /api/capture/status
      gallery.js              ← GET /api/gallery, DELETE /api/gallery/:id
  client/
    index.html
    js/
      api.js                  ← Fetch helpers
      toolbar.js              ← Boutons Capturer / Stop
      gallery.js              ← Affichage thumbnails
    css/
      main.css
data/                         ← Captures et parcours (gitignore)
  gallery/
    index.json
    *.png
docs/
  superpowers/
    specs/                    ← Design documents
    plans/                    ← Plans d'implémentation
```

## Compatibilité

| OS | Support |
|---|---|
| Linux | ✅ (nécessite `scrot` ou `gnome-screenshot`) |
| macOS | ✅ |
| Windows | ✅ (prévu — natif via screenshot-desktop) |

## Documentation technique

- [Design spec complète](docs/superpowers/specs/2026-05-25-screencapturemaintenance-design.md)
- [Plan 1 — Foundation + Capture + Gallery](docs/superpowers/plans/2026-05-25-plan1-foundation-capture-gallery.md)
