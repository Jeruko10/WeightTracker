# Design

Plans and ADRs. Every plan is saved here before implementing it.

## Layout

- Plan: `design/NNN-title.md` — three digits, next free number, short kebab-case title. Goal, approach, numbered steps with a checkbox; each step names its files and when it is done. Up to ~60 lines.
- ADR: `design/adr/NNNN-title.md` — four digits, its own sequence. Context, Decision, Consequences; up to 20 lines. Immutable: a new ADR supersedes the old one, which is marked `Superseded by NNNN`.
- A number is never reused.
- A rule whose history an ADR tells links to the ADR; the ADR links back to where the rule lives ([conventions](../docs/conventions.md), [ARCHITECTURE](../docs/ARCHITECTURE.md), [development](../docs/development.md)).

## Index

No plans or ADRs yet. Next plan: `001`; next ADR: `0001`.

[Arquitectura](../docs/ARCHITECTURE.md) (in Spanish) stays in `docs/`, not numbered.
