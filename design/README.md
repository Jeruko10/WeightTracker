# Design

Numbered design documents and ADRs (Architecture Decision Records). Every plan is saved here.

## Numbering

- One sequence for everything: `NNN-title.md`, three digits, the next free number, a short kebab-case title (`001-nutrition-section.md`).
- An ADR is `NNN-adr-title.md` (`002-adr-goal-history.md`) and has three sections, **Context**, **Decision** and **Consequences**, under a header that gives its kind, status and date.
- A number is never reused. A decision that is reversed keeps its file, marked `Superseded by NNN`, and the new one says what it replaces.
- A rule whose history an ADR tells links to the ADR and does not repeat it; the ADR links back to where the rule lives today ([docs/conventions.md](../docs/conventions.md), [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md), [docs/development.md](../docs/development.md)).

## Index

No numbered documents yet. The next one is `001`.

## Kept elsewhere

| Document | Kind | Date | Note |
| --- | --- | --- | --- |
| [Arquitectura](../docs/ARCHITECTURE.md) | Architecture (in Spanish) | 2026-10-11, last changed 2026-11-11 | Folders, layers, a feature's anatomy, the data model, styles and how to grow. Stays in `docs/`; not numbered. |
