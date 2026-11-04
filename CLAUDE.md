# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Weight Tracker: a static SPA (Bodyweight + Exercises sections) using native ES modules, Firebase Auth/Firestore (loaded from gstatic CDN) and Chart.js as the global `window.Chart` (cdnjs). **There is no build step, package.json, linter or test suite** — deliberately, since `.github/workflows/static.yml` uploads the repo as-is to GitHub Pages on push to `main`. Don't introduce tooling or bundling.

To run locally, serve the repo root with any static server (ES modules don't work from `file://`), e.g. `python -m http.server`, and open it in a browser. Sign-in is Google via Firebase popup against the real project in `src/config/firebase.js`.

## Architecture

Full detail (in Spanish) is in `docs/ARCHITECTURE.md`; read it before structural changes. Key rules:

- Dependency direction: `main.js → shell/ → features/ → shared/ → lib/` (`shared/` may also use `config/`).
  - `lib/` imports nothing from the project (generic utils).
  - A feature may import `lib/` and `shared/` but **never another feature**; shared needs move up to `shared/`.
  - Only `shell/` knows both features (router, export, session).
- Each feature exposes its public API **only** via its `index.js` (`init*`, `load*`, `clear*`, `export…`); other files are internal. `main.js` wires features to auth sign-in/sign-out and the hash router (`#/bodyweight`, `#/exercises`, plus Exercises sub-routes `#/exercises/ex/<id>` and `#/exercises/archive`; the router hands the sub-route to `applyExercisesRoute`). Cross-feature data goes through the shell: Exercises gets the bodyweight average via `setBodyweightProvider(makeBodyweightLookup)` in `main.js`.
- Feature layout: `state.js` (single exported mutable object — ES modules can't reassign imported `let`s), `repository.js` (Firestore, no DOM), pure logic modules (`stats.js`, `selectors.js`, …), `views/` (render DOM from state), `export.js` (plain-text export section).
- Firebase is imported only through `src/config/firebase.js`, which pins the SDK version (10.12.0) and re-exports the needed functions — add new Firebase imports there. User data lives under `users/{uid}/…` via `shared/user-db.js`; writes go through `shared/sync-status.js` `persist()` so the Saving/Saved/Error indicator stays accurate.
- Exercises uses `data-action` event delegation (`exercises/actions.js`). Opening Bodyweight resets Exercises to View mode (`resetExercisesMode`).
- Styles are split by responsibility and the `<link>` order in `index.html` matters (tokens → base → components → layout → login → bodyweight → exercises → train). JS toggles classes rather than writing inline styles. Theme colors used from JS (charts) live in `shared/theme.js` and must match `styles/tokens.css`.
- Dates are `'YYYY-MM-DD'` strings handled in UTC via `lib/dates.js`.
- Guideline from the docs: split modules past ~300 lines or when they mix DOM with calculation.
