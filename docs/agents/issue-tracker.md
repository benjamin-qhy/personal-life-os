# Issue tracker: GitHub

Engineering issues and specs live in GitHub Issues for
benjamin-qhy/personal-life-os. Use the gh CLI with an explicit
--repo benjamin-qhy/personal-life-os argument to avoid targeting upstream.

This tracker is for engineering work on the vault system.
Personal tasks retain the existing Obsidian workflow.
Never copy journal text to GitHub. Follow AGENTS.md privacy and
authorization rules before network operations or publishing.

## Conventions

- Create: gh issue create --repo benjamin-qhy/personal-life-os --title "<title>" --body-file <file>
- Read: gh issue view <number> --repo benjamin-qhy/personal-life-os --comments
- List: gh issue list --repo benjamin-qhy/personal-life-os --state open --json number,title,body,labels
- Comment: gh issue comment <number> --repo benjamin-qhy/personal-life-os --body-file <file>
- Add labels: gh issue edit <number> --repo benjamin-qhy/personal-life-os --add-label "<label>"
- Remove labels: gh issue edit <number> --repo benjamin-qhy/personal-life-os --remove-label "<label>"
- Close: gh issue close <number> --repo benjamin-qhy/personal-life-os

For multiline content, use a body file containing the exact approved text.
Creating that file also follows the vault's file approval rules.
Resolve ambiguous issue or PR numbers before acting.

## Pull requests as a triage surface

PRs as a request surface: no.

## Skill terminology

"Publish to the issue tracker" means create a GitHub issue after
the required authorization.

"Fetch the relevant ticket" means read the referenced GitHub issue
and its comments.

## Wayfinding operations

- Map: one issue labelled wayfinder:map containing Notes,
  Decisions-so-far, and Fog.
- Child tickets: link issues to the map using GitHub sub-issues
  when available. Otherwise use a task list in the map and a
  Part of #<map> line in each child.
- Types: wayfinder:research, wayfinder:prototype,
  wayfinder:grilling, and wayfinder:task.
- Blocking: use native issue dependencies when available.
  Otherwise record Blocked by: #<number> in each child.
- Frontier: select the first open, unassigned child in map order
  with no open blockers.
- Claim: assign the ticket to the driving developer before work,
  subject to authorization.
- Resolve: post the approved result, close the ticket, and append
  a concise result pointer to the map's Decisions-so-far.
