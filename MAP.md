# Map

Weight Tracker: static SPA to log body weight and goals (Bodyweight) and training days, sets and deloads (Exercises).

- **Stack:** native ES modules, Firebase Auth/Firestore (gstatic CDN, pinned 10.12.0), Chart.js 4.4.1 as `window.Chart` (cdnjs). No build step.
- **Run:** `python -m http.server` in the root, open in a browser (modules fail on `file://`). Sign-in is Google, against the real Firebase project.
- **Build / test / lint:** none, deliberately. Don't add tooling or bundling.
- **Deploy:** push to `main`; `.github/workflows/static.yml` uploads the repo as-is to GitHub Pages.
- **Docs:** `docs/` is for humans (ARCHITECTURE in Spanish, conventions, development); read only if the task asks.

## Invariants and traps

- Dependencies: `main.js → shell/ → features/ → shared/ → lib/`; `lib/` imports nothing of the project.
- A feature never imports another feature; only `shell/` knows both. Cross-feature data goes via the shell (`setBodyweightProvider`).
- A feature exposes its API only through its `index.js`; the rest is internal.
- Firebase is imported only through `src/config/firebase.js` (re-exports what the app uses).
- Writes go through `persist()` in `shared/sync-status.js` so the Saving/Saved/Error indicator stays true.
- User data lives under `users/{uid}/…` via `shared/user-db.js`.
- Bodyweight docs: `entries/{id}` {date, weight}, `data/goal` (active), `goalHistory/{id}` (archived).
- Exercises docs: `trainingDays`, `exercises` (sets `[{id,min,max}]`, `dayId` null = archived, `machine` = active tag), `exerciseLogs` (`reps, weight` or `left`/`right`), `deloads` {date}.
- Set ids are stable, never indexes: an index would shift history onto another set.
- Dates are `'YYYY-MM-DD'` strings in UTC (`lib/dates.js`); never `Date` local time.
- `state.js` exports one mutable object (imported `let`s can't be reassigned).
- Colors only in `styles/tokens.css`; the light block is duplicated (`data-theme=light` and OS light): edit both.
- `<link>` order in `index.html` matters: tokens → base → components → layout → login → bodyweight → exercises → train.
- JS toggles classes, not inline styles. Split modules past ~300 lines or mixing DOM with calculation.
- Opening Bodyweight resets Exercises to View mode (`resetExercisesMode`).
- The HTML report (`shell/export-html.js`) is self-contained: inline CSS/JS, SVG charts, no network.

## Entry points

- `index.html` — markup; applies saved theme (`wt-theme`) before first paint.
- `src/main.js` — starts shell, wires features to auth and router.

## `src/`

- `config/firebase.js` — Firebase init, `auth`/`db`, SDK re-exports.

### `lib/` — generic utils, no app knowledge

- `dates.js` — UTC date strings: today, addDays, daysBetween, formats.
- `confirm-tap.js` — "tap again to confirm" for irreversible deletes.
- `snackbar.js` — temporary notice with Undo (recoverable deletes).
- `svg-charts.js` — line and bar charts as SVG strings, for the report.
- `dom.js`, `html.js`, `storage.js`, `clipboard.js` — small helpers (`esc()` escapes HTML).

### `shared/` — services used by several features

- `user-db.js` — Firestore references under `users/{uid}/…`.
- `sync-status.js` — Saving/Saved/Error indicator and `persist()`.
- `theme.js` — System/Light/Dark, `themechange` event, chart colors from CSS.
- `settings.js` — per-device prefs: weight step, cycle length (`settingschange`).
- `export-format.js` — plain-text export helpers.

### `shell/` — frame common to every section

- `auth.js` — sign-in/out and which screens show.
- `router.js` — hash routes; passes the remainder to the section as sub-route.
- `export.js` — clipboard text export and HTML report download, both features.
- `export-html.js` — self-contained HTML report; layout only.
- `export-day.js` — one training day as screenshot-sized HTML (`dayReport()`).
- `profile-menu.js` — the avatar menu.

### `features/bodyweight/`

- `index.js` — public API (`init`/`load`/`refresh`/`clear`, `bodyweightReport`…).
- `state.js`, `repository.js` — state; CRUD of entries, goal, goal history.
- `stats.js` — interpolated daily series, 7-day averages (pure).
- `goal-plan.js` — a goal's plan and archiving (pure).
- `render.js` — main render; calls each view.
- `views/` — overview stats, goal banner/tab, weekly table, history, tabs.
- `chart/` — weight chart, data, window layout, zoom animation and planner.

### `features/exercises/`

- `index.js` — public API (`init`/`load`/`clear`, `exportSections`, `applyExercisesRoute`…).
- `state.js` — data (days, exercises, logs, deloads) and UI state.
- `repository.js` — loading, batched persist, serializers; data model in `docs/ARCHITECTURE.md`.
- `nav.js` — active screen (list / detail / archive) from the sub-route.
- `actions.js` — `data-action` event delegation handler.
- `selectors.js` — sort, filter, last load, "done today".
- `deloads.js` — deload cycle: current, next, previous, phase.
- `tonnage.js` — tonnage by date and track (pure).
- `bodyweight-source.js` — slot where the shell injects the bodyweight average.
- `modes.js`, `folds.js`, `charts.js`, `form-readers.js`, `constants.js` — modes, folding, charts, form parsing, limits/icons.
- `views/` — tree, detail, archive, forms, deload card, Train mode, components.

## `styles/` — one sheet per responsibility

`tokens` (colors), `base`, `components`, `layout`, `login`, `bodyweight`, `exercises`, `train`; each styles what its name says.
