# Domain Docs

Engineering skills use a single-context layout.

## Layout

- CONTEXT.md at the repository root holds the domain glossary.
- docs/adr/ holds architecture decision records.

These paths describe the intended layout. Setup does not create
domain content or invent decisions.

## Before exploring

Read AGENTS.md first. Read only material needed for the current task.

When present, read the relevant parts of CONTEXT.md and ADRs that
touch the area being investigated.

When domain documents are absent, do not infer their contents.
Follow AGENTS.md requirements for missing files.
Creating domain documents requires a separate proposal and approval.

## Vocabulary

Use terms defined in CONTEXT.md when naming domain concepts.
If a needed term is absent, flag the gap for domain-modeling
without inventing a definition.

## ADR conflicts

Explicitly identify any proposal that contradicts an existing ADR.
Explain the conflict and why reconsideration may be warranted.
Do not silently override recorded decisions.

## Privacy

Keep domain documentation focused on the vault system.
Never copy journal text into these documents or treat example
notes as facts about the person's life.
