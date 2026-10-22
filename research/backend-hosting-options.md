# Backend / hosting options for scheduled push + Graph tokens

Research for [#4](https://github.com/HADKASHI/medical-management-app/issues/4). Sources checked 2026-10-22; free-tier numbers change, so re-check before building.

## Requirements

A single-user PWA backend needs:

- a relational DB
- auth
- scheduled jobs with minute precision (reminders)
- sending Web Push (VAPID) to an installed iPhone PWA
- secure storage of Microsoft Graph refresh tokens
- ideally a free tier. The owner is in Israel.

## Constraints that apply to every option

- **iOS Web Push** needs iOS/iPadOS 16.4+. The app must be installed to the Home Screen with a manifest set to `display: standalone` or `fullscreen`. Permission can only be requested from a direct user gesture. The server must be able to reach `*.push.apple.com`. No Apple Developer account is needed. ([WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/))
- **Graph refresh tokens**:
  - Tokens issued to a redirect URI registered as `spa` expire after **24 hours**. Tokens in other scenarios last **90 days**.
  - Tokens rotate on each use, so the old one should be deleted.
  - They "need to be stored safely like access tokens or application credentials".
  - **Implication:** the backend should run the auth-code flow as a confidential (web) client. If the PWA itself obtains the token as a SPA, it dies within a day and the backend can't use it unattended.
  ([Microsoft Learn: refresh tokens](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens))
- **Any host that sleeps** (spin-down, pausing) breaks reminders, because nothing wakes it at reminder time.

## Comparison

| | **Supabase (Free)** | **Firebase (Spark / Blaze)** | **Cloudflare Workers + D1 (Free)** | **Oracle Cloud Always Free VM** | **Render (Free)** |
|---|---|---|---|---|---|
| Relational DB | Postgres, 500 MB | No. Firestore is a document DB (1 GiB, 50K reads / 20K writes per day) | D1 (SQLite), 5 GB, 5M reads / 100K writes per day | Self-hosted Postgres on the VM | Postgres, but **it expires 30 days after creation** |
| Auth | Built in (50K MAU) | Built in | None; you build it yourself | You build it yourself | You build it yourself |
| Scheduled jobs | Supabase Cron (pg_cron) runs anything from every second to yearly and can call Edge Functions over HTTP. Docs advise at most 8 concurrent jobs and at most 10 min per job | Scheduled functions need **Blaze** (card on file). Cloud Scheduler gives 3 free jobs per account, then $0.10/job/month | Cron Triggers: 5 per account, minute granularity, **10 ms CPU** per run | Anything (systemd timer, node-cron) | Cron jobs are not a free service type. In-process cron dies when the service spins down |
| Web Push sender | Edge Function (Deno): 2 s CPU, 256 MB, 150 s wall clock | Cloud Function (Blaze only) | Worker. WebCrypto is available, but the 10 ms CPU budget is tight | Node `web-push` library, no limits | Node `web-push` library |
| Secrets / token storage | Edge Function secrets (env vars). **Vault**: libsodium AEAD-encrypted table with the root key held outside the DB | Secret Manager (Blaze only) | Worker secrets; encrypt the column yourself | Files and env on your own VM; encrypt the column yourself | Env vars; encrypt the column yourself |
| Free-tier gotcha | **Paused after 7 days of low DB activity.** An email warning comes about a week ahead. While paused, nothing runs | Spark has no Functions at all, so scheduling means Blaze with a card | 10 ms CPU per invocation, and no auth or relational tooling built in | **Idle reclamation**: an instance whose p95 CPU, network and (A1 only) memory all stay below 20% for 7 days may be reclaimed, which describes a tiny cron app exactly. A card is required, and capacity can run out | Spins down after 15 min idle (about 1 min to wake), and the DB is deleted after the 30 days plus 14 days grace |
| Data location | No Middle East region. Closest are Frankfurt `eu-central-1` and Zurich `eu-central-2` | Tel Aviv `me-west1` is supported (location fixed once created) | Global edge network; D1 has a location hint, not a strict region | **Israel Central (Jerusalem) `il-jerusalem-1`** (must be your home region) | US/EU |
| Ops burden | Low | Low to medium | Medium | High (OS patching, TLS, backups) | Low |

Sources:

- [Supabase pricing](https://supabase.com/pricing)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)
- [Supabase secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Vault](https://supabase.com/docs/guides/database/vault)
- [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [Firebase pricing](https://firebase.google.com/pricing)
- [Firebase scheduled functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Firestore locations](https://firebase.google.com/docs/firestore/locations)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [OCI regions](https://docs.oracle.com/en-us/iaas/Content/General/Concepts/regions.htm)
- [Render free tier](https://render.com/docs/free)
- [Fly.io pricing](https://docs.fly.io/about/pricing)

Not in the table: **Fly.io**. It has no free tier for new organizations, only a trial of 2 machine-hours or 7 days. The smallest always-on machine (shared-cpu-1x, 256 MB) costs about $2.19 a month. This is the cheap paid fallback for a plain Node server.

## Recommendation: Supabase Free, region Frankfurt (`eu-central-1`)

It is the only option that covers all five needs on a free tier with no card and low operational work:

- relational Postgres
- built-in auth
- second-level cron through pg_cron
- Edge Functions with enough CPU (2 s) for VAPID signing and payload encryption
- Vault for encrypted Graph refresh tokens

Sketch:

1. A `pg_cron` job runs every minute. It calls an Edge Function through `pg_net`, or does the due-reminder query in SQL and then calls the function.
2. The Edge Function sends Web Push to the stored subscription with the VAPID private key, which lives in an Edge Function secret. It also refreshes and rotates the Graph token, storing it in Vault or a column encrypted with a key kept in a secret.
3. The Graph OAuth flow runs in the backend as a confidential client, to get the 90-day token lifetime and avoid the 24-hour SPA limit.

### Biggest gotcha: inactivity pausing

A paused project stops cron, so **reminders fail without any error**.

- The docs say "a few requests to the database each day" keeps a project active. They don't say whether internal pg_cron activity counts. A community answer says it does, but that is not an official statement.
- **Mitigation:**
  - Have the per-minute job write a heartbeat row.
  - Add an *external* daily ping, for example a scheduled GitHub Actions workflow that does a real read or write through the REST API.
  - Treat Supabase's pause-warning email as an alarm.
  - Upgrade to Pro if the app becomes critical. Paid projects are never paused.

### Runner-up options

- **Cloudflare Workers + D1** never sleeps. Its weak points are the 10 ms CPU budget, no built-in auth, and SQLite.
- **Oracle Always Free VM in Jerusalem** is the "plain server" choice with Israel data residency. The risk of idle reclamation and the operations work make it a worse fit for a personal app.
- **Firebase** is ruled out unless a card on Blaze is acceptable, and it isn't relational.
- **Render Free** is ruled out: it sleeps, and its DB is deleted.

## Open points to verify while building

- Whether `npm:web-push` runs unchanged in Supabase Edge Functions (Deno), or a Deno-native VAPID library is needed.
- The exact thresholds for activity and pause detection. They aren't documented, so watch the first weeks.
