# Map

Every file in the repository and what it does, one line each. Keep this up to date when a file is added, moved or changes purpose.

Where to start: [STATUS.md](STATUS.md) for where the work stands, [docs/](docs/) for how the app is built and the rules it keeps, [design/](design/README.md) for decisions and plans.

## Root

- `MAP.md` — this index.
- `STATUS.md` — where the work stands and where to resume; its notice says which doc to read before touching what.
- `index.html` — the app's markup. Applies the saved theme before first paint (inline script, `wt-theme`), links the stylesheets in cascade order, Chart.js 4.4.1 from cdnjs and `src/main.js`.
- `assets/icon.png` — the app icon (favicon and Apple touch icon).
- `.github/workflows/static.yml` — deploys the whole repository, as-is, to GitHub Pages on every push to `main` (or by hand).

## `docs/`

- `ARCHITECTURE.md` — the architecture, in Spanish: folders, layers and dependency rules, a feature's anatomy, the Exercises data model, styles and how to grow.
- `conventions.md` — the rules the code and styles keep, each with its reason, and the exceptions to them.
- `development.md` — no build step, running locally, signing in, deploying.

## `design/`

- `README.md` — numbering of design documents and ADRs, and their index.

## `devlogs/`

- `README.md` — what goes in the folder: one entry per session, by the `devlog` skill.

## `src/`

- `main.js` — entry point: starts the shell and wires the features to auth sign-in/sign-out and the hash router; hands Exercises the bodyweight average.

### `src/config/`

- `firebase.js` — `initializeApp` and the `auth`/`db` instances; the only place with the config. Pins the Firebase SDK (10.12.0) and re-exports the functions the app uses.

### `src/lib/` — generic utils, no knowledge of the app or Firebase

- `dates.js` — `'YYYY-MM-DD'` dates in UTC: today, addDays, daysBetween, formats.
- `dom.js` — `byId`, `playEnter` (entry animation).
- `html.js` — `esc()` for interpolating text into HTML.
- `confirm-tap.js` — "tap again to confirm" (cascading, irreversible deletes).
- `snackbar.js` — a temporary notice with an "Undo" action (recoverable deletes, archiving).
- `storage.js` — fault-tolerant `localStorage`.
- `clipboard.js` — `copyText` with a fallback.
- `svg-charts.js` — line and bar charts as SVG strings, for the HTML report (no Chart.js).

### `src/shared/` — app services shared by the features

- `user-db.js` — Firestore references under `users/{uid}/…`.
- `sync-status.js` — the "Saving… / Saved / Error" indicator and `persist()`.
- `theme.js` — System/Light/Dark theme (`data-theme` on `<html>`, the `themechange` event) and chart colors read from the CSS variables.
- `settings.js` — per-device preferences in `localStorage`: weight step (1 / 2.5 / 5 kg) and cycle length (2–14 days; emits `settingschange`).
- `export-format.js` — plain-text helpers for the export (rules, padding).

### `src/shell/` — the frame common to every section

- `auth.js` — sign-in/sign-out and which screens show for the session.
- `profile-menu.js` — the avatar menu.
- `router.js` — hash routes (`#/bodyweight`, `#/exercises`, `#/exercises/ex/<id>`, `#/exercises/archive`); passes what follows a section's hash to it as a sub-route.
- `export.js` — export to the clipboard (text) and download of the HTML report; combines both features.
- `export-day.js` — one training day as HTML that fits a screenshot: tonnage of the last 6 sessions and the last log of each set. Data from `dayReport()`.
- `export-html.js` — the self-contained HTML report to send to a person: summary, weight, training, tabs and folds. Layout only; data from `bodyweightReport()` and `exercisesReport()`.

### `src/features/bodyweight/` — body weight and goals

- `index.js` — public API: `initBodyweight`, `loadBodyweight`, `refreshBodyweight`, `clearBodyweight`, `onBodyweightShown`, `makeBodyweightLookup`, `exportBodyweight`, `bodyweightReport`.
- `state.js` — `entries`, `goal`, `goalHistory`, `pendingReset`, `chartRange`.
- `repository.js` — CRUD of entries, goal and goal history.
- `stats.js` — interpolated daily series, 7-day averages, data thresholds (pure).
- `goal-plan.js` — a goal's plan and its archiving (pure).
- `render.js` — main render: calls each view.
- `export.js` — the plain-text export section.
- `views/overview-stats.js` — the three average cards.
- `views/goal-banner.js` — the goal banner (pace, projection, bars, reached/overdue).
- `views/weekly-summary.js` — the weekly table.
- `views/history.js` — adding a weigh-in (form in Progress) and the History tab: editing and deleting with Undo.
- `views/goal-tab.js` — the Goal tab: form, preview, summary and past goals.
- `views/tabs.js` — the Progress / History / Goals tabs.
- `chart/weight-chart.js` — creates/updates the chart and the range selector.
- `chart/chart-data.js` — day axis, range window and datasets (weight + ideal pace).
- `chart/chart-view.js` — chart state and window layout (X/Y bounds, scroll).
- `chart/zoom-animation.js` — the zoom animation on a range change.
- `chart/zoom-planner.js` — smooth Y-axis planning during the zoom (pure).

### `src/features/exercises/` — days, exercises, sets, deloads

- `index.js` — public API: `initExercises`, `loadExercises`, `clearExercises`, `resetExercisesMode`, `exportSections`, `applyExercisesRoute`, `setBodyweightProvider`, `refreshExercises`.
- `state.js` — data (days, exercises, logs, deloads) and UI state (mode, screen, track, forms).
- `nav.js` — the active screen (list / detail / archive) from the hash sub-route.
- `tonnage.js` — tonnage by date and track (pure).
- `bodyweight-source.js` — the slot through which the shell injects the bodyweight average.
- `constants.js` — limits, per-set colors, SVG icons.
- `repository.js` — loading, batched persist and serializers; its comment documents the data model.
- `selectors.js` — queries on the state: sort, filter, last load, "done today".
- `deloads.js` — the deload cycle: current, next, previous, phase.
- `modes.js` — View / Edit / Train.
- `folds.js` — persistent folding and "Expand all".
- `charts.js` — per-exercise charts.
- `form-readers.js` — reading and validating forms.
- `actions.js` — the `data-action` handler (event delegation).
- `export.js` — the plain-text export section.
- `views/render.js` — main render of the tree.
- `views/components.js` — reusable buttons and icons.
- `views/tree.js` — the list: days (accordion) → compact exercise rows; link to the archive.
- `views/detail.js` — exercise detail: machine tracks, tonnage chart, sets and history.
- `views/archive.js` — the archive: restore into a day or delete for good.
- `views/forms.js` — log forms (bilateral / L-R) and the exercise form (unilateral, body weight, machine).
- `views/deload.js` — the deload card.
- `views/train.js` — Train mode.

## `styles/` — loaded from `index.html` in this order

- `tokens.css` — the color variables: dark by default, light with `data-theme=light` or the OS in light (the block is duplicated). Charts read these same variables.
- `base.css` — reset, body, global animations.
- `components.css` — reusable pieces: card, btn, inputs, chip, fold, icon-btn…
- `layout.css` — the shell: top bar, profile menu, header, tabs, sync.
- `login.css` — the sign-in screen.
- `bodyweight.css` — the Bodyweight section, with its desktop layout.
- `exercises.css` — the Exercises section (tree, forms, deload, charts).
- `train.css` — Train mode.
