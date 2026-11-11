# Status

> **Before touching code or styles, read [docs/conventions.md](docs/conventions.md). Before a structural change — a new module, folder or section, or anything that moves between layers — read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (in Spanish).**
> They hold the rules this project is built on, each with the reason that keeps it from being "fixed". Running, deploying and the no-build rule are in [docs/development.md](docs/development.md); decisions with a history in [design/](design/README.md); every file in [MAP.md](MAP.md).

## Where things stand (2026-11-11)

- **Latest work:** a blank card in Train on wide screens fixed (`fbff087`), exercise-list tags as full words, body-weight loads read "bodyweight + 30 kg". Deployed by the push to `main`.
- **This session:** the project's guidance moved out of a per-project `CLAUDE.md` into `MAP.md`, this file, `docs/conventions.md`, `docs/development.md` and a few lines added to `docs/ARCHITECTURE.md`; `design/` and `devlogs/` were created. `design/` has no ADRs yet: the old `CLAUDE.md` told no decision with a history. The per-project `CLAUDE.md` is gone: the global one is the only one.

## Open items

- **`src/features/exercises/actions.js` is 436 lines**, past the ~300-line guideline; [ARCHITECTURE.md](docs/ARCHITECTURE.md#cómo-crecer) suggests one file per entity.

## How to resume

1. Read this file and [MAP.md](MAP.md); open the document the notice above names for the work at hand.
2. What each past session did is in [devlogs/](devlogs/).
3. After each step, update this file: what was done, and where the plan stands.
