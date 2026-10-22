# Supabase Free: data protection and recovery

Research for issue #12. Checked against first-party sources on 2026-10-23. Quotes are from the cited page; where docs pages disagree, that is called out.

## TL;DR

- **Encryption**: AES-256 at rest and TLS in transit on every plan. For column-level encryption use **Vault**; **pgsodium is being deprecated** and should not be used.
- **Backups on Free: none you can rely on.** Automatic daily backups and PITR are Pro/Team/Enterprise only. Supabase itself tells Free projects to export with `supabase db dump`.
- **Pausing** (after ~1 week of low DB activity) keeps the data and can be restored from Studio within a window (docs say 1 year in the body text, 90 days in a heading); after the window a backup file and Storage objects can be downloaded but may not restore cleanly.
- **Deletion is permanent**, backups included.
- **Export path that works on Free**: a scheduled GitHub Actions job running `supabase db dump` (roles, schema, data) through the **session pooler** (IPv4) connection string, with the output **encrypted** before it leaves the runner and stored somewhere private, never this public repo or its artifacts.
- **Residency**: a Frankfurt project keeps Postgres, Auth and Storage in-region. Compliance (SOC 2 report, HIPAA BAA) is not available on Free.
- **Auth hardening on Free**: TOTP MFA (free, on by default) plus an RLS `aal2` policy; password strength rules; 1 h JWT expiry. Leaked-password protection and session time-box/inactivity limits are **Pro only**.

## 1. Encryption

| Item | Fact | Source |
| --- | --- | --- |
| At rest / in transit | "All customer data is encrypted at rest with AES-256 and in transit via TLS." | [Security](https://supabase.com/security) |
| Client connections | Docs advise SSL everywhere; `sslmode=require` encrypts but does not verify the server, use `verify-full` with the downloaded root cert. Database settings has a toggle to reject non-SSL connections. | [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres) |
| pgsodium | "Supabase does not recommend the usage of pgsodium as it will be deprecated." Use Vault instead; avoid its Transparent Column Encryption. | [pgsodium](https://supabase.com/docs/guides/database/extensions/pgsodium) |
| Vault | Authenticated encryption (libsodium AEAD); key is "never stored in the database alongside the encrypted data"; per-project root key is managed by Supabase and retrievable via the Management API. A `pg_dump`/`pg_restore` into a new project "cannot decrypt secrets copied from the old project" unless the old root key is copied first. | [Vault](https://supabase.com/docs/guides/database/vault) |
| `pgcrypto` | Standard Postgres contrib extension, available as an extension; key management is then on the app. | [Postgres pgcrypto](https://www.postgresql.org/docs/current/pgcrypto.html) |

Implication: platform encryption at rest protects against stolen disks, not against anyone holding the DB password or service key. Vault fits secrets (API keys, tokens); for a single-user app, encrypting ordinary medical rows column-by-column mostly adds complexity, and it **ties backups to the project root key** - if Vault is used, the root key must be backed up with the dumps.

## 2. Backups on Free

- "We automatically back up all Pro, Team, and Enterprise Plan projects on a daily basis." Free is not in the list. Retention: Pro 7 days, Team 14, Enterprise up to 30. ([Backups](https://supabase.com/docs/guides/platform/backups))
- "Pro, Team and Enterprise Plan projects can enable PITR as an add-on." ([Backups](https://supabase.com/docs/guides/platform/backups))
- "We recommend that free tier plan projects regularly export their data using the Supabase CLI db dump command." ([Backups](https://supabase.com/docs/guides/platform/backups))
- "Database backups do not include objects you store via the Storage API." ([Backups](https://supabase.com/docs/guides/platform/backups))
- Pricing table lists no automatic backups for Free; log retention is 1 day; 500 MB DB per project; two active free projects. ([Pricing](https://supabase.com/pricing))

**Conclusion: there is no usable, owner-downloadable backup on Free while the project is running.** The only platform-side copy that appears is the snapshot taken when a project is paused (next section).

## 3. Pausing and deletion

**Pausing**
- "A Free plan project is considered inactive if it does not receive sufficient user database activity over the past week." Pricing: paused "After 1 week of inactivity". ([Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Pricing](https://supabase.com/pricing))
- Restore window: the page body says "users have a 1-year window to restore the project on the platform from within Supabase Studio", while a section heading/anchor and a screenshot still say 90 days. **Treat 90 days as the safe planning number.** ([Upgrading](https://supabase.com/docs/guides/platform/upgrading), [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing))
- Restore moves the project to the latest minor Postgres version.
- After the window, "you can download your project's backup file, and Storage objects from the project dashboard" and restore into a new project or locally; because the backup is outside the compatibility window it "may fail to restore". ([Upgrading](https://supabase.com/docs/guides/platform/upgrading))
- Pausing does not lose data by itself, but while paused the app is down and a scheduled dump will fail. ADR 0003 (external keepalive) is what prevents this.

**Deletion**
- Deleting a project is irreversible: data, configuration and all automated backups/PITR snapshots are removed; the docs say to export first. ([Deleting your project](https://supabase.com/docs/guides/platform/delete-project))

## 4. Export paths

| Path | Notes | Source |
| --- | --- | --- |
| `supabase db dump` | Wraps `pg_dump`. Officially documented as three files: `--role-only` (roles.sql), default (schema.sql), `--data-only --use-copy` (data.sql). | [Backups in CI](https://supabase.com/docs/guides/deployment/ci/backups) |
| `pg_dump` directly | Works over the connection string; it is a single-session tool, so use the direct connection or the **session-mode** pooler, not transaction mode. | [Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) |
| Paused-project download | Dashboard download of backup + Storage objects, only for paused projects (section 3). | [Upgrading](https://supabase.com/docs/guides/platform/upgrading) |

**Scheduled dump from GitHub Actions on Free: yes, it works.** Supabase publishes a periodic GitHub Actions workflow that runs the three `db dump` commands with a `SUPABASE_DB_URL` secret. ([Backups in CI](https://supabase.com/docs/guides/deployment/ci/backups)) Two adjustments for this project:

1. **Connection string**: the direct host `db.<ref>.supabase.co` is IPv6-only unless the paid IPv4 add-on is bought; GitHub-hosted runners generally lack IPv6. Use the **shared pooler, session mode, port 5432** (IPv4 on every plan). ([Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres))
2. **Where the dump goes**: the official example commits dumps back to the repo and warns "Never backup your data to a public repository." This repo is public, and its workflow logs and artifacts are readable by anyone with read access (everyone, for a public repo), retained 90 days by default. ([GitHub: download artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)) So:
   - Encrypt on the runner before anything leaves it (e.g. `age` or `gpg` to a public key; private key only on the owner's devices).
   - Push the encrypted file to a **private** destination: a separate private GitHub repo (deploy key / fine-grained token as a secret), or an object store bucket (e.g. Cloudflare R2, already in the stack's vendor set) with a write-only token.
   - Never upload unencrypted dumps as workflow artifacts and never echo data to logs.
   - Also put the scheduled workflow itself in the private repo if possible, so its run history is not public.
   - Keep the Vault root key (if Vault is used) alongside the encryption keys, offline.
   - Test a restore into a scratch project or local Postgres periodically; a dump never restored is not a backup.

## 5. Access and residency

- Residency: for a project in an AWS region, "your Postgres database, Auth service, and Storage objects are hosted in that region"; "Projects hosted in EU regions keep your primary database data in-region." ([Security](https://supabase.com/security))
- Transfers outside the EEA (account/service data) rely on EU Standard Contractual Clauses; a DPA governs Customer Data, with Supabase as processor. ([Privacy](https://supabase.com/privacy))
- Staff access: the privacy notice says "We will not access the content of the databases itself" (in the context of the AI assistant collecting only schema/metadata), and disclosure is allowed "as required by law or subpoena". No public page describes internal staff access controls in detail; the SOC 2 Type 2 report that would is available only to Team/Enterprise. ([Privacy](https://supabase.com/privacy), [Security](https://supabase.com/security))
- Compliance on Free: SOC 2 report, ISO 27001 and HIPAA are not included ([Pricing](https://supabase.com/pricing)); a BAA requires at least the Team plan ([Shared responsibility](https://supabase.com/docs/guides/platform/shared-responsibility-model)). For a personal app this is a legal non-issue, but it means no contractual health-data guarantees.
- Supabase AI features in Studio send schema/metadata to AI providers (OpenAI, Amazon Bedrock). ([Privacy](https://supabase.com/privacy))

## 6. Auth hardening for one email + password user

| Control | Free? | Source |
| --- | --- | --- |
| TOTP MFA | Yes: "free to use and is enabled on all Supabase projects by default." | [TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp) |
| Enforce MFA in data access | Yes: restrictive RLS policy `using ((select auth.jwt()->>'aal') = 'aal2')` on each table. | [MFA](https://supabase.com/docs/guides/auth/auth-mfa) |
| Phone MFA | Not on Free ("Advanced" MFA is paid). | [Pricing](https://supabase.com/pricing) |
| Password strength / min length | Yes; required character classes configurable; "Anything less than 8 characters is not recommended." | [Password security](https://supabase.com/docs/guides/auth/password-security) |
| Leaked-password (HIBP) check | **No**: "available on the Pro Plan and above." | [Password security](https://supabase.com/docs/guides/auth/password-security) |
| JWT expiry | Configurable, default 1 h; do not go below 5 min. | [Sessions](https://supabase.com/docs/guides/auth/sessions) |
| Session time-box, inactivity timeout, single session | **No**: "only available on Pro Plans and up." | [Sessions](https://supabase.com/docs/guides/auth/sessions) |
| Refresh-token reuse detection | Yes, on by default (single-use tokens, 10 s reuse interval). | [Sessions](https://supabase.com/docs/guides/auth/sessions) |

Other free measures: disable public sign-ups after the single account exists; never ship the `service_role` key to the client; RLS on every table (already decided in the stack).

## 7. Gaps the owner must cover

1. **Backups** - Free has none while running. A scheduled, encrypted, off-site dump (section 4) is mandatory, plus periodic restore tests. This is the biggest gap.
2. **Pausing** - keepalive (ADR 0003) must work, or the app goes down and dumps fail; plan on a 90-day restore window if it does not.
3. **Accidental deletion** - irreversible, backups included; only the owner's own dumps survive it.
4. **Storage objects** - not in DB dumps; if the app ever stores files, they need their own export.
5. **Key custody** - dump-encryption key and (if used) Vault root key must be kept offline by the owner; losing them makes backups useless.
6. **Breached-password check and session limits** - not on Free; compensate with a long unique password, TOTP MFA enforced by `aal2` RLS, and disabled sign-ups.
7. **Short logs** - 1 day of API/DB logs, so incidents must be noticed quickly.
8. **No contractual assurance** - no SOC 2 report, BAA or detailed staff-access policy on Free; accepted risk for a personal app.
