# Development

How Weight Tracker is run and deployed. The structure is in [ARCHITECTURE.md](ARCHITECTURE.md) (in Spanish); the rules the code keeps in [conventions.md](conventions.md).

## No build step

Weight Tracker is a static SPA (Bodyweight + Exercises sections) using native ES modules, Firebase Auth/Firestore (loaded from gstatic CDN) and Chart.js as the global `window.Chart` (cdnjs). **There is no build step, `package.json`, linter or test suite** — deliberately, since `.github/workflows/static.yml` uploads the repo as-is to GitHub Pages on push to `main`. Don't introduce tooling or bundling.

## Run locally

Serve the repo root with any static server (ES modules don't work from `file://`) and open it in a browser:

```bash
python -m http.server
```

Sign-in is Google via Firebase popup against the real project in `src/config/firebase.js`.

## Deploy

Push to `main`: `.github/workflows/static.yml` uploads the whole repository to GitHub Pages. It can also be run by hand from the Actions tab.
