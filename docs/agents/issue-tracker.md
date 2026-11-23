# Issue tracker: GitHub Issues

The project's issues, specs and decision maps live in GitHub Issues of `Viktor7VII/ai-for-developers-project-387`. Use the `gh` CLI for all operations (`gh` infers the repo from `git remote -v`).

`.scratch/core-spec/` is the local copy and working material of the core specification: the decision map, 15 decision tickets and the six implementation slice tickets in `.scratch/core-spec/slices/` (these slices are not migrated to GitHub Issues; GitHub issues link to them). Every migrated issue links back to its local file. Keep both in sync when a decision changes: the GitHub issue is authoritative, the local file mirrors it.

## Current structure

The core specification was agreed in the first project [`Viktor7VII/ai-for-developers-project-386`](https://github.com/Viktor7VII/ai-for-developers-project-386) and stays there as the original source; this repository continues it. Always reference these issues by full URL (a bare `#<n>` would point to this repository):

- **Map**: https://github.com/Viktor7VII/ai-for-developers-project-386/issues/3 — decision map of the core specification, label `wayfinder:map`.
- **Specification**: https://github.com/Viktor7VII/ai-for-developers-project-386/issues/19 — index of the agreed specification (links to the tickets, `GLOSSARY.md`, ADRs, contract and slice tickets), label `spec`.
- **Decision tickets**: https://github.com/Viktor7VII/ai-for-developers-project-386/issues/4 – https://github.com/Viktor7VII/ai-for-developers-project-386/issues/18 — sub-issues of the map, labels `wayfinder:grilling` / `wayfinder:research`, answers recorded as the first `## Answer` comment.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body-file <file>`. Body starts with the question or task; add `Part of #<map>` and `Blocked by: #<n>, #<n>` lines when relevant, and a link to related repository documents.
- **Read an issue**: `gh issue view <number> --json number,title,body,labels,comments,state`.
- **List issues**: `gh issue list --state all --json number,title,labels,state` with `--label` filters.
- **Update an issue**: `gh issue edit <number> --body-file <file>` / `--title`; keep the original question intact and record changes in a comment.
- **Sub-issue of a parent (map)**: `gh issue edit <parent> --add-sub-issue <child>` or `gh api --method POST repos/{owner}/{repo}/issues/<parent>/sub_issues -F sub_issue_id=<child-db-id>`.
- **Blocking**: GitHub native issue dependencies: `gh issue edit <child> --add-blocked-by <blocker>` or `gh api --method POST repos/{owner}/{repo}/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>` (`<db-id>` from `gh api repos/{owner}/{repo}/issues/<n> --jq .id`). Mirror it in the body as a `Blocked by:` line. A ticket is resolved when it has an `## Answer` comment (issues stay open unless the user asks to close them); it is unblocked when every blocker is resolved.
- **Answer / resolution**: post the decision as a comment starting with `## Answer` (`gh issue comment <number> --body-file <file>`), then update the local copy in `.scratch/`.
- **Close**: only when the user explicitly asks; post the explanation as a comment first, then `gh issue close <number> --reason completed`. Never close issues automatically or via commit keywords (`Closes #n`).
- **Labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`.
- **Commits**: implementation commits reference their ticket with a `Refs:` line (AGENTS.md); use `Refs: https://github.com/Viktor7VII/ai-for-developers-project-387/issues/<n>` for GitHub issues (full URL, never a bare `#<n>`, see AGENTS.md) or the ticket file path for slice tickets in `.scratch/core-spec/slices/`.

New issues go into this repository (`Viktor7VII/ai-for-developers-project-387`); do not file new issues into the first project. Never file into `mattpocock/skills`.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

## When a skill says "publish to the issue tracker"

Create a GitHub issue (and mirror it in `.scratch/` if it belongs to the core specification).

## When a skill says "fetch the relevant ticket"

Read it as in **Read an issue** above; for slice tickets read the file in `.scratch/core-spec/slices/`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: an issue labelled `wayfinder:map` holding Destination / Notes / Decisions so far / Not yet specified / Out of scope.
- **Child ticket**: a sub-issue of the map with label `wayfinder:<type>` (`research` / `prototype` / `grilling` / `task`).
- **Blocking**: see **Blocking** above.
- **Frontier**: sub-issues of the map without an `## Answer` comment, whose blockers are all resolved, and without an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me`, the session's first write.
- **Resolve**: post the `## Answer` comment, append a context pointer (gist + link) to the map's Decisions so far; close only on the user's instruction.
