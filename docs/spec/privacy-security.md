# Privacy and security

Rules for holding the owner's medical data on a hosted service, decided in [Privacy and security rules](https://github.com/HADKASHI/medical-management-app/issues/14). They build on [stack.md](stack.md) and the facts in [What does Supabase Free provide for data protection and recovery?](https://github.com/HADKASHI/medical-management-app/issues/12). Backups and export are in [backups-export.md](backups-export.md).

## Data at rest

- **No field-level encryption.** Supabase's AES-256 at rest, TLS in transit, and RLS on every table are enough. Server-side Vault or pgcrypto would not keep the data from anyone who can already run SQL. Client-side encryption would not help against the realistic threats (a stolen account or phone), and it would bring key management across devices and the risk of losing the notes. This is an accepted risk (see below).
- Supabase Vault and pgsodium are not used.

## Auth

- **Email + password, plus enforced TOTP MFA.** Every table gets a **restrictive** RLS policy requiring `auth.jwt() ->> 'aal' = 'aal2'`, alongside the owner-only `auth.uid()` policy. A session that has only passed the password step can enroll or verify a factor and do nothing else.
- **Two TOTP factors:** the main one (iCloud Keychain or an authenticator app) and a backup saved offline. If both are lost, the owner removes the factor in the Supabase dashboard.
- **Sessions:** long-lived (refresh token in the PWA's storage, default 1-hour JWT). A TOTP code is needed only on a new device or after signing out.
- **No in-app lock** (PIN, Face ID or WebAuthn). The device's own passcode and Face ID guard the open app.
- Public sign-up stays disabled. Supabase's built-in Auth rate limits stay on their defaults.

## Sign out

- **Any sign-out** clears that device's persisted query cache (IndexedDB) and removes its own `push_subscriptions` row.
- **"Sign out everywhere"** in Settings: Supabase global sign-out (revokes every refresh token), deletes **all** `push_subscriptions` rows, and clears the local cache. Other devices sign in again and re-subscribe to push the next time they open.

## Push payloads (lock screen)

Web Push payloads are encrypted to the device, so the push services can't read them. The exposure is the lock screen, so payload text stays minimal:

| push | shows | never shows |
|---|---|---|
| Dose Reminder | Stock Item names ("Medication A, Medication B due") | strength, amount |
| Appointment Reminder | the time ("Appointment tomorrow at 10:30") | title, provider, location, notes |
| Daily Alert Time push | counts ("2 items low, 1 Authorization expiring") | item or Authorization names |

The details are on the screen each push opens, behind the device lock. Owner setting: iOS **Show Previews → When Unlocked** for the app.

## Work Calendar Invite content

Only the neutral title **"Personal appointment"** ([ADR 0001](../adr/0001-work-calendar-via-email-invites.md)) and the time (including Travel Buffers). No location, no description, and no attendees besides the owner's work address. The employer's systems therefore see when the owner is busy, but not why.

## Outbox and logs

- **Outbox rows** hold only what is sent (the push text above, or the neutral invite), plus ids, kind, status, attempts and last error.
- **Retention:** sent rows are deleted **30 days** after sending. Failed rows stay until the owner dismisses the "Delivery problems" banner, and are then deleted.
- **Logs** (Edge Function, Worker, `raise` in SQL) record only ids, kinds, status codes and error messages. Never payload text, push endpoints or keys, email addresses, tokens or any domain field.

## Secrets and keys

- The **service-role (secret) key** exists only in the Edge Function environment, where Supabase injects it. It is never in the frontend, CI or the Worker.
- The **keepalive Worker uses the anon (publishable) key only**. It calls a dedicated `security definer` RPC that returns just the heartbeat's age and nothing else.
- Where each secret lives is in [stack.md](stack.md#secrets).

### Rotation runbook

Rotate on any suspected leak, including a gitleaks or GitHub secret-scanning hit. A secret that reached git history counts as leaked even after the commit is removed.

| secret | how to rotate |
|---|---|
| Supabase secret key | create a new `sb_secret_` key, update Edge Function secrets and redeploy, delete the old key |
| Supabase anon / publishable key | public by design; rotate only if abused, then update the frontend env and the Worker secret |
| Resend API key | create a new key in Resend, update the Edge Function and Worker secrets, revoke the old one |
| VAPID key pair | generate a new pair, update both secret and frontend env, delete all `push_subscriptions`; each device subscribes again on next open |
| Supabase access token, Cloudflare API token | revoke and reissue, update GitHub Actions secrets |
| Database password (`SUPABASE_DB_URL` in the backups repo) | reset the database password in Supabase, update the backups repo secret |
| Owner password / TOTP | change the password, re-enroll TOTP, then "Sign out everywhere" |

## Public repo

- GitHub **secret scanning and push protection** are on.
- CI runs **gitleaks** on every pull request and push.
- Seed data, fixtures, tests, screenshots, issues and PRs use made-up examples only ("Medication A, 30 pills", `user@example.com`).

## Production data stays in production

Production data never goes to the local dev stack, to CI, or to an AI tool's context. The exceptions are backup restore tests: the backup job's throwaway Postgres container in the private backups repo, and manual restore drills on a throwaway project or local stack, deleted afterwards ([backups-export.md](backups-export.md)). Development and tests use seed data only.

## Frontend

- No analytics, trackers or third-party scripts. Fonts and assets are self-hosted.
- Headers set through Cloudflare:
  - `Content-Security-Policy`: `default-src 'self'`; `script-src 'self'`; `connect-src 'self'` plus the Supabase project URL (`https` and `wss`); `img-src 'self' data:`; `frame-ancestors 'none'`.
  - `Referrer-Policy: no-referrer`.
  - `X-Content-Type-Options: nosniff`.

## Admin accounts

Whoever controls these accounts controls the data or its delivery path, so each needs 2FA: **Supabase, GitHub, Cloudflare, Resend**, and the **personal email account** used for password reset.

## Threat list

| threat | what protects | response |
|---|---|---|
| Lost or stolen phone | iOS passcode/Face ID and device encryption; lock-screen pushes show names only | "Sign out everywhere" from another device |
| Leaked or guessed password | enforced TOTP (`aal2`); sign-up disabled; Auth rate limits | change password, "Sign out everywhere" |
| Reset-email account taken over | 2FA on that email account; TOTP still required after a reset | secure the email account, change password, re-enroll TOTP |
| Leaked service-role key | only in the Edge Function environment | rotate per runbook |
| Leaked Resend / VAPID / CI tokens | kept in platform secret stores | rotate per runbook |
| Public-repo mistake (secret or real data committed) | push protection, gitleaks, made-up data only | rotate any secret; treat real data as exposed and remove it from history |
| Admin account takeover | 2FA on all admin accounts | recover the account, rotate every secret it held |
| Shoulder-surfing the lock screen | minimal push text; Show Previews → When Unlocked | none needed |
| Employer reading the calendar | neutral, detail-free invites | none needed |

## Accepted risks

- No field-level encryption: anyone with database access (Supabase staff, a stolen secret key) can read all data.
- Supabase staff could access the data under its DPA. There is no published staff-access policy, and there is no SOC 2 report or BAA on Free.
- No leaked-password check and no session time-box on Free (mitigated by TOTP).
- Logs are kept for 1 day only, so after-the-fact investigation is limited.
- The employer sees appointment times and Travel Buffers.
