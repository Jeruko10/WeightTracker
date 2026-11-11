# Conventions

How Weight Tracker's code and styles are written. **Read this before touching code or styles.** Each rule carries its reason, because the reason is what stops somebody from "fixing" it. The deliberate departures are listed at the end, in [Exceptions to the conventions](#exceptions-to-the-conventions), each with the convention it departs from and why that is right.

The full structure — every folder and file, a feature's anatomy, the data model and how to grow — is in [ARCHITECTURE.md](ARCHITECTURE.md) (in Spanish); read it before structural changes. Running, deploying and the no-build rule are in [development.md](development.md).

## Structure

### Dependencies point one way

`main.js → shell/ → features/ → shared/ → lib/` (`shared/` may also use `config/`).

- `lib/` imports nothing from the project (generic utils).
- A feature may import `lib/` and `shared/` but **never another feature**; shared needs move up to `shared/`.
- Only `shell/` knows both features (router, export, session).

The diagram and the reasons are in [ARCHITECTURE.md](ARCHITECTURE.md#capas-y-reglas-de-dependencia).

### A feature's public API is its `index.js`

Each feature exposes its public API **only** via its `index.js` (`init*`, `load*`, `clear*`, `export…`); other files are internal. Cross-feature data goes through the shell: Exercises gets the bodyweight average via `setBodyweightProvider(makeBodyweightLookup)` in `main.js`, because a feature never imports another.

### Every feature has the same layout

- `state.js` — a single exported mutable object, because ES modules can't reassign imported `let`s.
- `repository.js` — Firestore, no DOM.
- Pure logic modules (`stats.js`, `selectors.js`, …).
- `views/` — render DOM from state.
- `export.js` — the plain-text export section.

What each file of each feature does is in [ARCHITECTURE.md](ARCHITECTURE.md#anatomía-de-una-feature).

### The HTML report is one self-contained file

The HTML report (`shell/export-html.js`) is one self-contained file (inline CSS/JS, SVG charts from `lib/svg-charts.js`, no network); each feature supplies structured data through `bodyweightReport()` / `exercisesReport()`.

### Split a module past ~300 lines

Split modules past ~300 lines or when they mix DOM with calculation.

## Firebase and data

### Firebase comes in through one file

Firebase is imported only through `src/config/firebase.js`, which pins the SDK version (10.12.0) and re-exports the needed functions — add new Firebase imports there.

### User data and writes

User data lives under `users/{uid}/…` via `shared/user-db.js`. Writes go through `shared/sync-status.js` `persist()` so the Saving/Saved/Error indicator stays accurate.

### Dates are UTC strings

Dates are `'YYYY-MM-DD'` strings handled in UTC via `lib/dates.js`.

## Events and behaviour

### Exercises delegates its events

Exercises uses `data-action` event delegation (`exercises/actions.js`).

### Opening Bodyweight resets Exercises

Opening Bodyweight resets Exercises to View mode (`resetExercisesMode`).

## Styles

### One stylesheet per responsibility, in a fixed order

Styles are split by responsibility and the `<link>` order in `index.html` matters (tokens → base → components → layout → login → bodyweight → exercises → train).

### JS toggles classes

JS toggles classes rather than writing inline styles.

### Colors live only in `styles/tokens.css`

Colors live only in `styles/tokens.css` (dark default; light via `data-theme=light` or the OS preference — the light block is duplicated, keep both in sync). Charts read the same CSS variables through `shared/theme.js`, and a theme change fires `themechange` so they redraw; avoid hard-coded colors in CSS/JS.

## Exceptions to the conventions

None recorded yet. A new exception is added here, under its own heading, with the convention it departs from and why the departure is right.
