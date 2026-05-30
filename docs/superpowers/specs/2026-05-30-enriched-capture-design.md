# Enriched Capture — Design Spec

**Date:** 2026-05-30
**Project:** ScreenCaptureMaintenance
**Status:** Approved

---

## Goal

Extend the capture system to record mouse movements/clicks, keyboard inputs, and window changes alongside screenshots. Enable learners to reproduce sequences in simulation or evaluation mode. Give trainers a maintenance workflow that minimizes rework when the target software UI evolves.

---

## Architecture Overview

Four independent services:

| Service | Responsibility |
|---|---|
| `CaptureService` | Dual-stream capture: event stream + screenshot stream |
| `SessionStore` | Persist and version sessions as ordered, stable-ID steps |
| `MaintenanceService` | Compare sessions, diff screenshots, suggest event updates |
| `PlayerService` | Guide learner through a session, validate actions, score |

---

## 1. CaptureService

### Dual-stream capture

Two parallel loops run during a session:

**EventListener**
- Listens via `pynput` (mouse + keyboard) and `ewmh`/`wnck` (active window changes)
- Every event is timestamped (ms precision) and appended to `events.json`
- Event types: `mouse_move`, `mouse_click`, `key_press`, `key_release`, `window_change`

**ScreenshotTrigger**
Screenshots are taken on:
1. `mouse_click` event
2. `window_change` event
3. Manual hotkey F9
4. Fallback: 500ms elapsed since last screenshot with at least one event since last capture

The fallback does not fire if no events occurred — avoids empty steps during idle periods.

### Capture modes

| Mode | Behaviour |
|---|---|
| `record` | Normal session. Steps written to `steps.json`, screenshots to `screenshots/`. |
| `compare` | Maintenance session. Screenshots go to `candidate/`, no steps modified. |

### Step creation

On each screenshot trigger:
1. Generate stable step ID (`uuid`)
2. Write entry to `steps.json` with `status: "current"`
3. Set `step_id` on all buffered events since last screenshot

---

## 2. SessionStore — Data Model

### File structure

```
sessions/<session-id>/
├── session.json          ← metadata
├── steps.json            ← ordered step sequence
├── events.json           ← full event stream (decoupled)
├── screenshots/
│   ├── step-<id>-v1.png
│   └── step-<id>-v2.png  ← re-captured during maintenance
└── candidate/            ← temporary, used during compare mode
    └── step-<id>-c1.png
```

### session.json

```json
{
  "id": "uuid",
  "name": "Créer un nouveau projet",
  "app": "MyApp",
  "app_version": "2.1",
  "created_at": "2026-05-30T10:00:00Z",
  "updated_at": "2026-05-30T14:00:00Z"
}
```

### steps.json

```json
[
  {
    "id": "step-abc123",
    "screenshot": "step-abc123-v2.png",
    "screenshot_version": 2,
    "status": "current",
    "description": "Clic sur Nouveau projet",
    "annotations": {
      "instruction": "Cliquez sur le bouton 'Nouveau projet' dans la barre d'outils",
      "hint": {
        "text": "Le bouton se trouve en haut à gauche de la barre d'outils",
        "x": 200,
        "y": 80,
        "show_after_attempts": 1
      },
      "success_feedback": "Parfait !",
      "error_feedback": "Ce n'est pas le bon endroit — regardez la barre d'outils"
    }
  }
]
```

### events.json

```json
[
  {
    "type": "mouse_click",
    "x": 200, "y": 80,
    "button": "left",
    "t": 1748599200050,
    "step_id": "step-abc123"
  },
  {
    "type": "window_change",
    "to": "Dialogue confirmation",
    "t": 1748599200200,
    "step_id": "step-abc123"
  },
  {
    "type": "key_press",
    "key": "Return",
    "t": 1748599200350,
    "step_id": "step-abc123"
  }
]
```

The `step_id` field on each event is the decoupling key — the editor can rebind events between steps without re-capturing.

---

## 3. MaintenanceService

### Maintenance workflow

```
1. Trainer opens session → clicks "Vérifier la session"
2. App switches to compare mode
3. Trainer replays the full workflow on the updated software
4. App captures a candidate session (screenshots only, no step modification)
5. MaintenanceService aligns candidate steps to reference steps by order
6. Diff computed per step pair
7. Review report presented to trainer
8. Trainer processes flagged steps only
9. Session updated and versioned
```

**Future evolution (not in v1):** targeted mode where the trainer re-captures specific steps without replaying the full session.

### Step alignment

- Aligned by order (step N candidate ↔ step N reference)
- If candidate has more steps: extras flagged as `new — to integrate`
- If candidate has fewer steps: missing ones flagged as `absent`

### Similarity scoring

- **pHash** (perceptual hash) for fast global comparison per step pair
- Threshold configurable, default **85%** — below threshold → `needs_review`
- Steps above threshold → auto-validated, no trainer action required

### Change detection — two levels

**Level 1 — Diff heatmap**
Pixel diff between reference and candidate screenshot rendered as a colored overlay (changed zones in orange/red). Shown in the side-by-side review interface.

**Level 2 — Element tracking (template matching)**
For each `mouse_click` event in the reference:
- Extract a 48×48px region centered on click coordinates
- Search for this region in the candidate screenshot (OpenCV template matching)
- **Found at same position** → no action
- **Found at different position** → app suggests updated coordinates, trainer validates with one click
- **Not found** → icon changed or removed, flagged for manual re-capture

Requires `opencv-python` on the server.

### Review interface (per flagged step)

- Side-by-side: reference screenshot left, candidate right
- Diff heatmap overlay toggle
- Event coordinate warnings if click falls in a changed zone
- Three actions per step:
  - **Accept** new screenshot (visual change, same workflow)
  - **Re-capture** this step (opens targeted capture for this step alone)
  - **Edit events** (coordinate editor for moved elements)

### Review summary

```
✓ unchanged  : 9 steps (auto-validated)
⚠ to review  : 2 steps (similarity < 85%)
+ new        : 1 step  (absent in reference)
```

---

## 4. Player — Simulation & Evaluation

### Principle

The player does not replay the session passively. It guides the learner step by step, captures their actions in real time via EventListener, and validates them against the reference event sequence.

**What the learner sees:** reference screenshot in the SCM interface on one side, the real target software on the other. When a step is validated, the screenshot advances automatically.

### Action validation

| Event type | Correct if |
|---|---|
| `mouse_click` | Within ±20px of reference coordinates, on the window matching the last `window_change` event of the step |
| `key_press` | Exact key sequence for the step |
| `window_change` | Correct application/window title |

Tolerance radius (±20px) is configurable per session.

### Simulation mode

- Unlimited attempts
- After `hint.show_after_attempts` failed attempts: hint bubble appears on screenshot, positioned at `(hint.x, hint.y)` with arrow pointing to target
- `error_feedback` shown after each failed attempt
- `success_feedback` shown briefly on validation before advancing
- No score

### Evaluation mode

- Score per step:
  - 100% on first attempt
  - 50% on second attempt
  - 0% beyond (step still progresses after max attempts)
- Max attempts per step configurable (default: 3)
- Hint display configurable: hidden, or visible with score penalty (default: −25% on the step)
- `error_feedback` shown after each failed attempt (no position hint by default)
- Final score screen at end with per-step breakdown

### Annotations (trainer-authored)

All annotations are optional. Fields:

| Field | Shown when |
|---|---|
| `instruction` | Always, above screenshot, before learner acts |
| `hint.text` | After `show_after_attempts` failures (simulation) or never / with penalty (evaluation) |
| `hint.x/y` | Position of bubble on screenshot |
| `success_feedback` | Briefly on step validation |
| `error_feedback` | After each failed attempt |

The editor lets the trainer click directly on the screenshot to position a hint bubble, then fill in text fields per step.

---

## 5. Error Handling

- **EventListener crash** during capture: session marked `incomplete`, partial events saved, trainer notified
- **Screenshot trigger failure**: logged, skipped — next trigger will create the step
- **Candidate session shorter than reference** (trainer missed steps during compare run): flagged steps listed, trainer can dismiss or re-run compare
- **Template matching below confidence threshold**: falls back to flagging for manual review rather than suggesting wrong coordinates
- **Player: target software not focused**: player pauses validation loop, shows "Revenez sur [app name]" until window is active again

---

## 6. Out of Scope (v1)

- Automatic macro replay of event sequences for comparison (Option B maintenance)
- Video export of sessions
- Multi-screen capture
- Cloud sync / shared sessions
- Mobile or browser-based player

---

## Tech Stack

| Component | Technology |
|---|---|
| Event capture | `pynput` (mouse/keyboard), `ewmh` (window changes) |
| Screenshot | Existing Python/PIL fallback (Linux) |
| Image diffing | `pHash` (fast global), `opencv-python` (template matching) |
| Session storage | JSON files (no database) |
| Backend | Node.js (existing) + Python service for image processing |
| Frontend | Existing client, extended |
