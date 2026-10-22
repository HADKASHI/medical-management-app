# Can a personal app write to a work-account Outlook calendar?

Research for issue #2. Researched 2026-10-22 against Microsoft Learn / Microsoft Support (primary sources only; links inline).

## Verdict

**Technically yes, but almost certainly not without the work tenant's IT admin.**

The right shape is a **delegated `Calendars.ReadWrite` + `offline_access`** grant, used by the backend with a stored refresh token (authorization code flow, confidential client). That runs in the background with no user present, until the refresh token is revoked or goes unused for 90 days.

The blocker is consent. Microsoft's current **default** user-consent policy for new tenants ("Let Microsoft manage your consent settings") explicitly **excludes `Calendars.ReadWrite`** (and every other Calendars scope) from what end users may consent to. Many established tenants also disable user consent entirely or restrict it to verified publishers. So in most work tenants, the owner clicking "Accept" will hit a "Need admin approval" screen, and an admin has to grant consent (or the owner must use a different calendar).

## Key facts

### 1. Permission choice: delegated, not application

| | Delegated `Calendars.ReadWrite` | Application `Calendars.ReadWrite` |
|---|---|---|
| Meaning | "create, read, update, and delete events in user calendars" (as the signed-in user) | "create, read, update, and delete events of **all** calendars without a signed-in user" |
| Admin consent required (by permission definition) | No | **Yes** |
| Background use | Yes, via refresh token (`offline_access`) | Yes, via client credentials |
| Fit for one personal user | Good | Poor: tenant-wide access to every mailbox unless an Exchange admin scopes it |

Source: [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference) (Calendars.ReadWrite entry).

Application permissions are only reasonable if IT is willing to both grant admin consent **and** scope the app to the owner's single mailbox via [RBAC for Applications in Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac) (needs an Exchange admin / Organization Management; replaces the older Application Access Policies). That is a much bigger ask of IT than delegated consent; don't lead with it.

### 2. App registration options

Supported account types (`signInAudience`) per [Validation differences by supported account types](https://learn.microsoft.com/en-us/entra/identity-platform/supported-accounts-validation):

- **Single tenant in the work tenant** (`AzureADMyOrg`): registered inside the employer's Entra tenant. By default "all users can register applications" ([Delegate app management](https://learn.microsoft.com/en-us/entra/identity/role-based-access-control/delegate-app-roles)), but admins often turn that off. It also puts a personal app's registration inside the employer's directory, which IT may object to. Being "registered in your tenant" helps only under the low-risk/verified-publisher policy, not under the Microsoft-managed default (which excludes Calendars scopes regardless).
- **Multitenant** (`AzureADMultipleOrgs`) or **multitenant + personal accounts** (`AzureADandPersonalMicrosoftAccount`): registered in a tenant the owner controls (e.g. a free dev tenant). The work tenant sees it as an external, **unverified-publisher** app. If risk-based step-up consent is on, users can't consent to most multitenant apps from unverified publishers registered after Nov 2020 ([Publisher verification overview](https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview)). Publisher verification needs a verified Microsoft AI Cloud Partner Program account and a non-`onmicrosoft.com` domain; unrealistic for a personal project.
- The `AzureADandPersonalMicrosoftAccount` option keeps the door open for the Outlook.com fallback (see below) with one registration.

**Recommendation:** register multitenant + personal accounts in a tenant the owner controls, request only `Calendars.ReadWrite offline_access` (plus `openid`/`User.Read` if needed), and use the confidential-client auth-code flow on the backend.

### 3. Admin consent in a work tenant

- Consent setting options ([Configure user consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent), [Manage app consent policies](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies)):
  - **Do not allow user consent**: admin must consent to everything.
  - **Allow user consent for apps from verified publishers / apps registered in this tenant, for selected low-impact permissions** (`microsoft-user-default-low`): an unverified external app fails; a same-tenant app passes only if the admin classified `Calendars.ReadWrite` as low impact.
  - **Let Microsoft manage your consent settings** (`microsoft-user-default-recommended`): "This is also the default for a new tenant." Users can consent to any user-consentable delegated permission **except** a list that includes `Calendars.Read`, `Calendars.ReadBasic`, `Calendars.ReadWrite`, `Calendars.Read.Shared`, `Calendars.ReadWrite.Shared` (plus Mail, Files, Sites, Contacts, Tasks, etc.). Microsoft updates this policy over time.
  - **Allow user consent for apps** (`microsoft-user-default-legacy`): the only option under which the owner could self-consent to an unverified external app's `Calendars.ReadWrite`.
- Apps that require user assignment always need admin consent, regardless of policy ([Configure user consent](https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent)).
- **How the owner can tell:** just try it. When consent isn't allowed, the consent screen tells non-admin users to ask their admin; if the tenant has the **admin consent workflow** enabled, the screen offers a "request approval" form that routes to IT ([Consent experience](https://learn.microsoft.com/en-us/entra/identity-platform/application-consent-experience)). Non-admins can't read the tenant's consent policy directly in the portal; IT can (Entra admin center > Enterprise apps > Consent and permissions > User consent settings).

### 4. Token lifetime: how long background access lasts

- `offline_access` must be requested explicitly on the v2.0 endpoint to get a refresh token ([Scopes and permissions](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc)).
- Refresh token default lifetime: **90 days** for confidential/web apps; **24 hours** for SPA redirect URIs ([Refresh tokens](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens)). The token **replaces itself on every use**, and the fixed policy values are Max Inactive Time **90 days**, Max Age **until-revoked** ([Configurable token lifetimes](https://learn.microsoft.com/en-us/entra/identity-platform/configurable-token-lifetimes); refresh lifetimes are no longer configurable since 2021). So **a job that refreshes at least every few weeks keeps access indefinitely** until something revokes it.
  - Do the OAuth exchange on the **backend** (web/confidential client), not in the PWA. A token obtained via an `spa` redirect URI dies after 24 h and can't support background sync.
  - Persist the newest refresh token after every refresh.
- What forces re-auth ([Refresh tokens: revocation table](https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens)) for a confidential-client token:
  - user or admin "revoke all refresh tokens / sessions": **revoked**
  - admin password reset in Entra or M365 admin center: **revoked**
  - user changes own password / SSPR / password expiry: stays alive (per the table)
  - consent revoked by user (myapps.microsoft.com) or admin: access ends
  - account disabled/deleted (e.g. leaving the job): access ends
- **Conditional Access sign-in frequency** (P1/P2): default is a rolling 90 days, but IT can set e.g. 1 day / every 7 days. "On confidential clients, the system defers sign-in frequency enforcement on non-interactive sign-ins until the next interactive sign-in" ([CA session lifetime](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-session-lifetime)). The docs are ambiguous about exactly how a pure background refresh behaves under a short SIF; treat it as a risk and **design for periodic interactive re-auth** (a "Reconnect Outlook" prompt in the app when refresh fails with `invalid_grant` / `interaction_required`).
- Other CA policies (compliant/managed device required, approved-client apps only, location restrictions) can block an unmanaged personal app from getting a token at all. Not verifiable without seeing the tenant's policies.

### 5. Alternatives if consent is blocked

1. **Personal Outlook.com calendar via Graph** (delegated, MSA). Consumer accounts aren't subject to an org consent policy, so the same Graph code works if the app registration includes personal accounts (`AzureADandPersonalMicrosoftAccount`). The owner then views it alongside work by sharing it or by subscribing to it.
2. **ICS feed subscription** (no consent needed at all). The backend publishes a secret-URL `.ics` feed; the owner subscribes in Outlook. Per [Microsoft Support](https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web-cff1429c-5af6-41ec-a5b4-74f2c278e98c), subscribed calendars update roughly every **3 h (Outlook.com)** / **6 h (Outlook on the web)**, and "can take more than 24 hours". It's one-way and read-only in Outlook, appears as a separate overlay calendar (not real events in the work calendar, so it doesn't block free/busy), and the secret URL is effectively a bearer credential. Some orgs restrict internet calendar subscriptions (not verified here; ask IT).
3. **Ask IT for a targeted admin consent** to this one app (delegated only), via the admin consent workflow if enabled.

### 6. Privacy note (not asked, but relevant)

Anything written into a work mailbox is employer-controlled data: visible to Exchange admins, subject to retention / eDiscovery, and lost on leaving the job. For medical appointments, the PRD should consider writing a **neutral title** (e.g. "Appointment") to the work calendar rather than details, or prefer the personal-calendar / ICS routes.

## What the owner should check with IT

1. Which **user consent setting** is the tenant on? (Do-not-allow / verified-publishers+low / Microsoft-managed / allow-all.) Unless it's "allow all", self-consent to `Calendars.ReadWrite` will fail.
2. Is the **admin consent workflow** enabled, and would they grant **delegated** `Calendars.ReadWrite` + `offline_access` to a personal, unverified, multitenant app for one user?
3. Any **Conditional Access** policies that would block or shorten tokens for a non-Microsoft app from an unmanaged server/device (sign-in frequency, compliant device, approved apps)?
4. Are **internet calendar (ICS) subscriptions** allowed in Outlook (fallback)?
5. Are they comfortable with personal medical-appointment entries in the work mailbox at all?

## Open / unverified

- Exact behaviour of a background-only refresh under a short CA sign-in frequency (docs say enforcement is deferred to the next interactive sign-in for confidential clients; needs a live test).
- Whether `microsoft-user-default-recommended` treats apps registered in the same tenant differently (docs list the exclusions with no same-tenant carve-out).
- Whether the owner's specific tenant restricts ICS subscriptions.
