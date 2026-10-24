# Build plan

How the spec is turned into build work, decided in [Slice the spec into build issues](https://github.com/HADKASHI/medical-management-app/issues/17). The issues themselves are the plan: [all build issues](https://github.com/HADKASHI/medical-management-app/issues?q=label%3Abuild). The first one is [Walking skeleton: scaffold, local Supabase, test harness, CI](https://github.com/HADKASHI/medical-management-app/issues/18).

## Slices

- Every build issue is a **vertical slice** sized for **one test-first session** with the `tdd` skill. A slice goes through every layer it needs: migration, RPC, `app.tick()`, screen. Its acceptance behaviours are written as test names grouped by layer ([testing.md](testing.md)).
- Body: **What to build**, **Acceptance behaviours**, **Spec**, **Not in this slice** ([template](../../.github/ISSUE_TEMPLATE/build-slice.md)).
- Order comes only from GitHub's native **blocked-by** links, which follow real dependencies rather than one chain. Work any open build issue whose blockers are all closed.

## Labels

| label | on |
|---|---|
| `build` | every build issue |
| `phase:a` … `phase:d` | exactly one per issue |
| `owner-task` | manual checklists only the owner can do (sign-ups, purchases, keys); body is **Checklist** + **Unblocks** |

There are no phase issues, milestones or size labels.

## Phases

The PRD order is kept:

- **A: core stock, dosing, go-live.** Walking skeleton → sign-in with enforced TOTP → Stock Items → Restock and Stock Count → Dose Schedules → Due Doses → Confirmation Window → Low Stock in the Alerts list → production deploy and keepalive → daily encrypted backup and Data Export. Real data goes in only after the backup slice.
- **B: Authorizations and Appointments.** Authorizations with Renewal, Authorization Alerts (starting the Settings screen), Appointments.
- **C: push and work-calendar invites.** Push foundation (outbox, sender, test notification), Dose Reminders, Appointment Reminders and the Daily Alert Time push, invite on create, invite updates and cancellations.
- **D: reports.** Doses tab, then Renewals and Visits.

## Placement rules

- The Playwright smoke flows from [testing.md](testing.md#end-to-end-smoke-tests-playwright) arrive with the slice that first makes each flow possible; the harness comes with sign-in.
- The Daily Alert Time setting comes with the Daily Alert Time push; the Authorization lead times come with Authorization Alerts.
- The **deferred check that work Outlook applies invite updates and cancellations** ([ADR 0001](../adr/0001-work-calendar-via-email-invites.md)) is the acceptance gate of **Invite updates and cancellations, validated in work Outlook**. If it fails, that slice switches to the Mailgun fallback and re-tests before closing. The full [manual release checklist](testing.md#manual-release-checklist) is run at the end of that slice.
- Owner tasks sit right before the slice they unblock: accounts before the production deploy, the backups repo before the backup slice, the domain + Resend + VAPID before the push foundation.
