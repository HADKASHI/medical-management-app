---
name: wayfinder-ticket
description: Resolve exactly one ticket of this repo's wayfinder map (GitHub issue #1). Use when a session's brief names a wayfinder ticket to work, or the user asks to resolve a map ticket.
---

Resolve **one** ticket of the wayfinder map: a GitHub issue that is a child of the map, issue #1 in `HADKASHI/medical-management-app`. The map is an **index**: each decision lives in its own ticket, and the map only gives the gist and a link. Tickets produce **decisions, not code**.

## Steps

1. **Load the map.** Run `gh issue view 1` and read its Destination, Notes, Decisions so far, Not yet specified, and Out of scope. Done when you can say the destination in one line.
2. **Pick the ticket.** Take the one your brief or the user names. If none is named, take the first open, unblocked, unassigned child (see *Frontier* below). **Claim it before any other work** with `gh issue edit <n> --add-assignee HADKASHI`. If it's already assigned, stop and report that.
3. **Read what it builds on.** Read the ticket body and its `wayfinder:<type>` label (the type is never in the body). Read the closed tickets it references, plus `GLOSSARY.md`, `docs/spec/`, and `docs/adr/` as far as they bear on it.
4. **Resolve it by type**, with the Skill tool:
   - `wayfinder:grilling`: **HITL**. Invoke `mattpocock-skills:grilling` and `mattpocock-skills:domain-modeling`. Ask in numbered rounds with a recommended answer for each, and wait for the user. The user answers their side of every question themselves. Done when every branch of the design tree is visited and the user confirms you share an understanding.
   - `wayfinder:prototype`: **HITL**. Invoke `mattpocock-skills:prototype`, build something rough to react to (made-up data only), and iterate with the user until they decide.
   - `wayfinder:research`: **AFK**. Invoke `mattpocock-skills:research` against primary sources. Put the findings on a throwaway branch `research/<slug>`, push it, and open no PR; the branch is never merged.
   - `wayfinder:task`: **AFK** if you can do the work yourself, otherwise **HITL**: give the user a precise checklist. Done when the work is done and its resulting facts are recorded.
5. **Write the durable output.** Decisions that the build needs go in `docs/spec/<topic>.md`. New terms go in `GLOSSARY.md` (definitions only, no implementation details). An ADR goes in `docs/adr/` only when the choice is hard to reverse, surprising, and a real trade-off. Commit as described under *Git* below.
6. **Record the resolution.** Post a resolution comment on the ticket (the answer plus links to the spec or findings), then close it. Then add one line to the map's **Decisions so far**: `- [<ticket title>](<url>): <one-line gist>`. Done when the ticket is closed and the map line is live.
7. **Advance the frontier.** Graduate any fog in **Not yet specified** that the answer has made sharp into new tickets, and remove those patches from the map. If the answer shows a ticket is beyond the destination, close it and add one line to **Out of scope** with the reason. If the answer invalidates another ticket, update or close that ticket.
8. **Report** in a few lines: the decision, any new tickets (by name, with links), and what's ready next.

Never resolve a second ticket in the same session.

## This repo's tracker

- **`gh`:** use `gh`. If it isn't on PATH, use `"/c/Program Files/GitHub CLI/gh.exe"`. It's authenticated as HADKASHI. API paths are `repos/HADKASHI/medical-management-app/...`.
- **Labels:** a ticket carries exactly one of `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` or `wayfinder:task`. The map carries `wayfinder:map`. No other labels.
- **Ticket body:** `## Question` followed by the question, sized for one session.
- **Children:** `gh api -X POST .../issues/1/sub_issues -F sub_issue_id=<id>`, where `<id>` is the issue's database id from `gh api .../issues/<n> --jq .id`, not its number.
- **Blocking:** use GitHub's native dependencies: `gh api -X POST .../issues/<blocked>/dependencies/blocked_by -F issue_id=<blocker id>`. List them with `gh api .../issues/<n>/dependencies/blocked_by`.
- **Create, then wire:** create every new issue first, then link children, blocking, and cross-references using the real numbers.
- **Frontier:** the children of the map (`gh api .../issues/1/sub_issues`) that are open, have no assignee, and whose `blocked_by` issues are all closed.
- **Editing the map:** other sessions edit it at the same time. Fetch the body (`gh issue view 1 --json body --jq .body`) **right before** you edit it, change only your own lines, and write it back with `gh issue edit 1 --body-file <file>`. Keep temporary files in your scratchpad, not the repo.
- **Refer by name:** in comments, map lines, and reports, name tickets by their title with the link inside it, never as a bare `#n`.

## Git

Commit on your branch, then run `git fetch origin && git rebase origin/main && git push origin HEAD:main`. Before adding an ADR, check `origin/main` for the highest ADR number and take the next one. End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Public repo

Everything in this repo and its issues is public. Use made-up examples only ("Medication A, 30 pills", `user@example.com`). Real medical details, the owner's employer, real email addresses, and secrets stay out of every file, comment, and commit.
