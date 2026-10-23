---
name: wayfinder-sessions
description: Start one fresh Claude session per ready ticket on the wayfinder map, each working that ticket with the wayfinder-ticket skill.
disable-model-invocation: true
---

Start a separate, fresh session for each ticket the user wants worked from the wayfinder map: issue #1 in `HADKASHI/medical-management-app`. Each session runs the project skill `wayfinder-ticket`. Sessions load that skill themselves, which is why they can work without the user typing anything; the plugin's `wayfinder` skill is user-invoked only, so a started session cannot load it.

Arguments, optional: ticket numbers or titles. With none, use the whole frontier.

## Steps

1. **Find the frontier.** Use `gh`, or `"/c/Program Files/GitHub CLI/gh.exe"` if it isn't on PATH. List the map's children with `gh api repos/HADKASHI/medical-management-app/issues/1/sub_issues`. Keep each child that is open, has no assignee, and whose `issues/<n>/dependencies/blocked_by` entries are all closed. Note each one's `wayfinder:<type>` label. If the frontier is empty, report that, along with what's blocked and on what, and stop.
2. **Confirm the set.** If arguments named tickets, use those, but drop any ticket that is closed, claimed, or blocked, and say why. Otherwise show the frontier as a table (title, type, HITL/AFK) and ask the user which to start. Default to all of them.
3. **Check the skill is on `main`.** Run `git fetch origin` and `git ls-tree origin/main .claude/skills/wayfinder-ticket/SKILL.md`. If it's missing, commit and push it first: worktree sessions only see what's on a branch.
4. **Start the sessions.** Load `mcp__ccd_session__start_session` with ToolSearch if it isn't loaded yet. Make the start calls together in one message, after calling `mcp__ccd_session__mark_chapter` with a batch title. Write a bold title line and one sentence for each session. For each ticket, call it with:
   - `initiation: "user_asked"`, `context: "fresh"`, `use_worktree: true`
   - `title`: `Wayfinder: <ticket title>`. `name` and `branch_name`: a short slug of the title.
   - `prompt`: the brief below, filled in.
   - `background`: the map's Destination plus one line per relevant decision from Decisions so far, at least 80 characters.

   ```
   Invoke the Skill tool with skill `wayfinder-ticket` as your first action, then use it to resolve exactly one ticket on the wayfinder map (issue #1 of `HADKASHI/medical-management-app`): **#<n> "<title>"** (label `wayfinder:<type>`, <HITL: worked live with the user | AFK: worked on your own>). The skill holds the full procedure and this repo's GitHub conventions. If the Skill tool reports it unknown, Read `.claude/skills/wayfinder-ticket/SKILL.md` in your working directory and follow it: it's a model-invocable project skill the user wrote for exactly this.
   Sessions working in parallel right now: <the other tickets by title, or "none">. Re-fetch the map right before editing it, and take ADR numbers from origin/main.
   ```
5. **Report** a table to the user: one row per session, with a link `[<title>](#<session id>)`, the ticket, and HITL/AFK. Tell them HITL sessions are waiting for their answers. Then end the turn.
6. **When a session's note arrives,** check its work before reporting it: the ticket is closed with a resolution comment, the map has its Decisions-so-far line, and the commits are on `origin/main` (`git pull --ff-only`). Fix stale map lines it left behind. When all are done, report the new frontier.
