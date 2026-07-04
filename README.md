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

## Tests

```bash
npm test
```

20 tests unitaires et d'intégration (Jest + Supertest).

---

## Sécurité

Audit Plan 1 effectué (2026-05-25) — aucune CVE dans les dépendances (`npm audit`).

Corrections appliquées :
- **XSS** : remplacement de `innerHTML` par des API DOM dans la galerie client
- **Path traversal** : validation que `entry.filename === <uuid>.png` avant suppression de fichier
- **Validation d'entrée** : format UUID vérifié sur `DELETE /api/gallery/:id` (→ 400 si invalide)
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
