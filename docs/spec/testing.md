# Testing

How the app is tested, from Phase A onward. Decided in [Testing strategy](https://github.com/HADKASHI/medical-management-app/issues/15). It builds on [stack.md](stack.md) (Vitest, SQL tests against the local Supabase stack, CI on every PR) and [ADR 0004](../adr/0004-domain-logic-in-postgres-with-outbox.md) (domain rules live in Postgres).

The goal: adding a unit or integration test means **dropping one file in a known folder**. Every runner picks up new files by glob, and CI runs them all with no extra wiring.

## Layers

| layer | what it tests | tool | where | command |
|---|---|---|---|---|
| **Database integration** | every domain rule: RPCs, the per-minute job, RLS, outbox claim/record | pgTAP via `supabase test db` | `supabase/tests/**/*.test.sql` | `pnpm test:db` |
| **Unit** | TypeScript logic: sender core, date/format helpers, form validation, service worker handlers, screens with their own logic | Vitest (+ React Testing Library, jsdom) | `*.test.ts(x)` next to the code | `pnpm test` |
| **End-to-end smoke** | a few whole flows through the real UI and local Supabase | Playwright (Chromium) | `e2e/*.spec.ts` | `pnpm test:e2e` |
| **Manual** | what can't be automated: real Web Push on the iPhone, Home Screen install, Outlook invites | release checklist below | this file | — |

`pnpm test:all` runs all three automated layers in order.

## The boundary: test each rule once, where it lives

- Every rule in [data-model.md](data-model.md) and [alert-rules.md](alert-rules.md) is tested **in pgTAP, at the RPC or job level**: Dose generation, the Confirmation Window, stock changes, Low Stock and Authorization Alerts, enqueued Reminders and re-sends, Snooze, invite sequence bumps, RLS.
- TypeScript tests cover **only TypeScript code**. The frontend never re-tests a domain rule; it trusts the RPC.

## Database integration tests (pgTAP)

- **Runner:** `supabase test db` (pg_prove) against the local stack after `supabase db reset`. Each test file wraps itself in `begin; … rollback;`, so tests never see each other's data.
- **Layout:** one folder per area, one file per behaviour group, e.g. `supabase/tests/doses/confirmation_window.test.sql`, `supabase/tests/alerts/low_stock.test.sql`, `supabase/tests/rls/owner_only.test.sql`.
- **Test-only helpers** live in a `tests` schema created and committed by `supabase/tests/000-setup.test.sql`, which runs first. It is never a migration, so production never has it, and `supabase db reset` removes it before the next run:
  - **builders** that insert valid rows with defaults and take only what the test cares about: `tests.make_stock_item(quantity => 10)`, `tests.make_schedule(stock_item, times => '{08:00,20:00}')`, `tests.make_authorization(expires_on => ...)`, `tests.make_appointment(starts_at => ...)`;
  - **`tests.as_owner()` / `tests.as_stranger()`**: switch to the `authenticated` role and set `request.jwt.claims` to that user, so RLS is tested in SQL;
  - **`tests.at(timestamptz)`**: set the clock (below).
- **Seed data is not test data.** `supabase/seed.sql` holds made-up examples ("Medication A, 30 pills") for local manual use; no test depends on it.

### Controllable clock

- Every function that needs the time calls **`app.now()`**, never `now()`, `current_timestamp` or `clock_timestamp()`. `app.now()` returns `current_setting('app.now', true)::timestamptz` when that is set, and `now()` otherwise. Clients can't set `app.now` through PostgREST, so in production it is always the real time.
- The pg_cron job is just `select app.tick()`. A test sets the time and calls `app.tick()` as often as it likes to simulate minutes passing:
  ```sql
  select tests.at('2026-01-05 08:00 Asia/Jerusalem');  -- sets app.now (set local)
  select app.tick();
  select tests.at('2026-01-05 08:30 Asia/Jerusalem');
  select app.tick();  -- re-send is enqueued
  ```
- A guard test (`supabase/tests/lint/no_bare_now.test.sql`) scans the source of every function in the `app` and `public` schemas and fails if one calls the clock directly instead of through `app.now()`.

### Time cases every time-dependent rule covers

- an ordinary day,
- the **spring-forward** day and the **fall-back** day in Asia/Jerusalem, using the DST rule in [data-model.md](data-model.md#dose_times),
- midnight and day boundaries (evening-before Appointment Reminder, every-N-days schedules, "next Dose" for the Confirmation Window).

## Unit tests (Vitest)

- **Files:** `foo.test.ts` next to `foo.ts`. One Vitest config with two projects: `node` (sender core, helpers) and `jsdom` (React and service worker code).
- **Sender core:** the outbox sender's logic lives in `supabase/functions/_shared/` as **runtime-neutral TypeScript** (no `Deno.*` or `npm:` imports), so Vitest runs it in Node. It takes a `PushPort` and a `MailPort`; tests pass **fakes** that record calls and return scripted results (201, 404/410, 500, timeout). They check the push payload (Declarative Web Push format), the iMIP/ICS text (UID, SEQUENCE, METHOD REQUEST/CANCEL, neutral title, buffers), and how each result is reported back. The real `@negrel/webpush` and Resend adapters are thin and not unit-tested.
- **React:** component tests only for screens with their own logic (e.g. Due Doses with "All taken", Restock entered in packs). Data hooks are mocked at the TanStack Query hook boundary, not at `fetch`. Purely presentational screens get no tests.
- **Service worker:** `push` and `notificationclick` handlers are plain functions tested with fake events.

## End-to-end smoke tests (Playwright)

- Chromium against `vite preview` and the local Supabase stack (owner user created by a fixture). Kept **small** (3–5 flows), run on every PR:
  1. sign in;
  2. a due Dose (made by `app.tick()` at a set `app.now`) is taken from Due Doses, and stock goes down;
  3. a Restock in packs raises stock and clears a Low Stock Alert;
  4. creating an Appointment shows it and leaves an invite row in the outbox.
- Add a flow when a bug escapes that only a whole-flow test would have caught, not to cover every screen.

## Test-first workflow

- Build issues are worked with the `tdd` skill. Each build issue lists its **acceptance behaviours** written as test names ("a Dose pending 24 h becomes missed").
- Red → green → refactor, **one behaviour at a time**, at the lowest layer that owns the rule (usually pgTAP).
- A PR merges only when CI is green. No coverage-percentage gate.

## CI

On every pull request (GitHub Actions), in this order:

1. typecheck, lint;
2. `pnpm test` (Vitest);
3. start the local Supabase stack (`supabase start`), then `supabase db reset` and `supabase test db`;
4. `pnpm test:e2e` against the same stack.

## Manual release checklist

Run on the owner's iPhone before the first release and after changes to push, the service worker or invites:

- [ ] Add to Home Screen; the app opens standalone.
- [ ] Enable notifications from a tap; Settings → "Send test notification" arrives.
- [ ] A real Dose Reminder arrives on time; tapping it opens Due Doses; Taken reduces stock.
- [ ] The Home Screen badge shows pending Doses plus Alerts.
- [ ] A new Appointment's invite lands on the work calendar; editing it updates the event and deleting it removes it.
