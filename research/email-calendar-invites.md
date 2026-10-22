# How do we send calendar invites Outlook accepts?

Research for issue #11. Researched 2026-10-22 against primary sources (IETF RFCs, Microsoft Learn / Open Specifications, provider docs and pricing pages; links inline). Items marked **[verify in spike]** are not stated by any primary source and must be confirmed with one real test send to the work mailbox.

## Verdict

**Feasible on a free tier, but it needs a cheap custom domain (~US$10/year).**

- Send iTIP-over-email (iMIP, RFC 6047) messages: a `text/calendar; method=REQUEST` part for create/update and `method=CANCEL` for delete, with a **stable `UID`** per appointment and a **`SEQUENCE` that only goes up**.
- Send them from a Supabase Edge Function through an **HTTP email API**, not SMTP: Edge Functions block outbound ports 25 and 587 ([Supabase Edge Function limits](https://supabase.com/docs/guides/functions/limits)).
- Recommended provider: **Resend Free** (3,000 emails/month, 100/day, 3 domains; [pricing](https://resend.com/pricing)). Our volume is a handful of emails per month.
- **A custom domain is required.** Resend's shared `resend.dev` sender can only mail the address on the Resend account, and returns 403 for anyone else ([Resend KB](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)). A verified domain also gives SPF/DKIM alignment, which is what gets the mail past Exchange Online Protection into the inbox. A `.com` at Cloudflare Registrar is about US$10.1 to 10.5/year at cost (third-party price trackers, 2026; confirm on Cloudflare before buying). Use a subdomain such as `cal.example.com` for sending.
- **Fallback if Resend's attachment shape isn't recognised by Exchange:** Mailgun Free (100/day, 1 custom domain; [pricing](https://www.mailgun.com/pricing/)), which accepts a **pre-built raw MIME message** (`/v3/{domain}/messages.mime`; [Mailgun send docs](https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http)). With raw MIME we control the exact iMIP structure.

## 1. What the invite must contain

### MIME (RFC 6047 iMIP)

From [RFC 6047](https://www.rfc-editor.org/rfc/rfc6047.html) section 2.4 to 2.6:

- The calendar part is `Content-Type: text/calendar` and **must** carry a `method` parameter whose value equals the iCalendar `METHOD` property. A `text/calendar` part without `method` is not an iMIP message (it's just a file).
- Add `charset=UTF-8` if anything is non-ASCII; base64 or quoted-printable transfer encoding unless the path is 8-bit clean.
- `multipart/alternative` must not carry two different iCalendar objects. Senders **should** include a human-readable part. Receivers must find `text/calendar` parts anywhere inside `multipart/*`.
- Handling goes by Content-Type, not by the `.ics` filename.

Minimal shape (what we'd build ourselves for the raw-MIME fallback, and what Resend should approximate):

```
From: Appointments <calendar@cal.example.com>
To: owner@work.example.com
Subject: Busy
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="b1"

--b1
Content-Type: multipart/alternative; boundary="b2"

--b2
Content-Type: text/plain; charset=UTF-8

Busy (personal appointment).
--b2
Content-Type: text/calendar; charset=UTF-8; method=REQUEST
Content-Transfer-Encoding: base64

<base64 of the VCALENDAR below>
--b2--
--b1
Content-Type: application/ics; name="invite.ics"
Content-Disposition: attachment; filename="invite.ics"
Content-Transfer-Encoding: base64

<same base64>
--b1--
```

The second (attachment) copy is optional. Postmark recommends sending the invite both inline and as an attachment for client compatibility ([Postmark: calendar invites](https://postmarkapp.com/support/article/1101-how-do-i-send-calendar-invites-with-postmark)).

### iCalendar, by method (RFC 5546 iTIP)

Required properties from the [RFC 5546](https://www.rfc-editor.org/rfc/rfc5546.html) restriction tables:

| | REQUEST (3.2.2) | CANCEL (3.2.5) |
|---|---|---|
| `METHOD` | `REQUEST` | `CANCEL` |
| `UID` | required | required (same as the original) |
| `DTSTAMP` | required | required |
| `ORGANIZER` | required | required |
| `ATTENDEE` | 1+ | the attendees being removed (all, for a full cancel) |
| `DTSTART` | required | optional |
| `SUMMARY` | required (may be empty) | optional |
| `SEQUENCE` | required when > 0 | required |
| `STATUS` | optional | `CANCELLED` to cancel the whole event |

**Create** (`SEQUENCE:0`):

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//example//medical-management-app//EN
METHOD:REQUEST
BEGIN:VEVENT
UID:6f1c2e0a-0000-4000-8000-000000000001@cal.example.com
SEQUENCE:0
DTSTAMP:20261022T090000Z
DTSTART:20261105T070000Z
DTEND:20261105T083000Z
SUMMARY:Busy
ORGANIZER;CN=Appointments:mailto:calendar@cal.example.com
ATTENDEE;CN=Owner;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:owner@work.example.com
STATUS:CONFIRMED
TRANSP:OPAQUE
CLASS:PRIVATE
X-MICROSOFT-CDO-BUSYSTATUS:BUSY
X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY
END:VEVENT
END:VCALENDAR
```

**Update** (move time, etc.): same `UID`, `SEQUENCE` incremented (1, 2, ...), new `DTSTAMP`, new times, still `METHOD:REQUEST`.

**Cancel**: same `UID`, `SEQUENCE` incremented again, `METHOD:CANCEL`, `STATUS:CANCELLED`, same ORGANIZER/ATTENDEE, new `DTSTAMP`. Keep `DTSTART`/`DTEND`/`SUMMARY` for readability. Microsoft's own cancel example also carries `TRANSP:TRANSPARENT` and `X-MICROSOFT-CDO-BUSYSTATUS:FREE` ([MS-OXCICAL Organizer's Cancellation](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/58adbf7c-d2ef-43ec-8471-d9f17691c69e)).

Notes on the choices:

- **UID**: generate once when the appointment is created (e.g. `<uuid>@cal.example.com`), store it in the DB, never change it. UID is the primary key for matching revisions (RFC 5546 2.1.5). Exchange accepts arbitrary third-party UIDs: it stores them in `PidLidGlobalObjectId` ("ThirdPartyGlobalId") and that's what it matches updates on ([MS-OXCICAL: UID](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/ac8c1e68-de58-4230-a2e2-79aae754a055)).
- **SEQUENCE**: must increment on any change to DTSTART/DTEND/DURATION/RRULE/STATUS, and on every CANCEL (RFC 5546 2.1.4). The highest SEQUENCE wins; ties are broken by later DTSTAMP (2.1.5). Simplest rule for us: **store `sequence` per appointment and increment on every update or cancel email.**
- **Time zone (Asia/Jerusalem)**: write `DTSTART`/`DTEND` in **UTC with `Z`** and omit `VTIMEZONE`. RFC 5545 allows UTC date-times, Outlook renders them in the viewer's zone, and it removes all VTIMEZONE/DST bugs (Israel's DST rules are a classic source of them). Convert in the backend from the stored local time.
- **Busy status**: Exchange maps `X-MICROSOFT-CDO-BUSYSTATUS` to `PidLidBusyStatus` (FREE=0, TENTATIVE=1, BUSY=2, OOF=3) and falls back to `TRANSP` (OPAQUE=busy) only when that is absent. On a REQUEST that carries `X-MICROSOFT-CDO-INTENDEDSTATUS`, Exchange 2013+ stores the item as **tentative** until the attendee responds, and the intended status (BUSY) applies after acceptance ([MS-OXCICAL X-MICROSOFT-CDO-BUSYSTATUS](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/cd68eae7-ed65-4dd3-8ea7-ad585c76c736), [TRANSP](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/54d3000c-a6b3-43c0-b4b0-543578f86fa0), [Product behavior](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/afb90409-bcd2-4a44-9f1e-ca9340ec0508), [Organizer's Meeting Request example](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/206554c5-41ab-4da4-a864-fe2a0e85caa1)).
- **Neutral content**: `SUMMARY:Busy`, no `LOCATION`, no `DESCRIPTION` beyond a neutral line, `CLASS:PRIVATE`. The email Subject and text body must be equally neutral: they're visible to anyone who can read the work mailbox and are retained by the employer.
- **RSVP=FALSE**: the owner still has to accept once in Outlook (that's what turns tentative into busy), but no reply email needs to reach us. If Outlook sends a reply anyway, it goes to the ORGANIZER address; it can bounce or be dropped harmlessly. **[verify in spike]** whether Outlook still shows Accept with `RSVP=FALSE` (it should; RSVP only controls whether a reply is expected).

## 2. How Exchange Online handles it

- For **user mailboxes**, calendar processing is `AutomateProcessing = AutoUpdate` and can't be changed; `AddNewRequestsTentatively` defaults to `$true`, so a recognised meeting request lands on the calendar as tentative before the user acts, and later REQUESTs/CANCELs update that item in place ([Set-CalendarProcessing](https://learn.microsoft.com/powershell/module/exchange/set-calendarprocessing)). `ProcessExternalMeetingMessages` (default `$false`) is documented for resource mailboxes (rooms); people routinely receive external invites in user mailboxes, so it shouldn't block us, but **[verify in spike]**.
- Updates are linked to the original by the stored GlobalObjectId (from our UID); a different UID makes a second, separate event.
- A CANCEL marks the event "Canceled:" with busy status Free; the owner may still need to click "Remove from calendar". Free/busy is cleared either way.
- Tenant admins can add mail-flow rules that quarantine or strip external meeting requests (a common anti-phishing measure; Microsoft Q&A, not a doc guarantee). If the work tenant does that, this whole approach fails silently, so the first spike send is the real test.

## 3. Email providers compared (free tiers, 2026-10)

| Provider | Free tier | Can we set `text/calendar; method=...`? | Custom domain? | Fit |
|---|---|---|---|---|
| **Resend** | 3,000/mo, 100/day, 3 domains | Attachment `contentType` is a free string in the official SDK ([resend-node types](https://github.com/resend/resend-node/blob/main/src/emails/interfaces/create-email-options.interface.ts)); docs don't mention calendar invites. Whether the part is recognised as iMIP by Exchange: **[verify in spike]** | Required to mail anyone but yourself | **Recommended** |
| **Mailgun** | 100/day, 1 custom domain | Yes, full control via raw MIME endpoint | Sandbox domain only reaches pre-authorised recipients and has poor reputation; use a custom domain | **Fallback** |
| **Postmark** | 100/mo, no overages | Yes; Postmark documents invites with `ContentType: text/calendar; charset=utf-8; method=REQUEST` | Yes (sender signature/domain); pricing page lists custom sending domains on Free. Account-approval rules for new accounts not checked | Works, but tight 100/month cap |
| **Brevo** | 300/day | API attachments are name + content; no documented way to set the `method` parameter | DKIM-authenticated domain strongly advised | Not recommended (SMTP relay would need port 465, untested from Edge Functions) |

Supabase side: Free plan includes 500,000 Edge Function invocations/month and a 150 s wall clock; outbound SMTP on 25/587 is blocked, so use HTTPS APIs ([limits](https://supabase.com/docs/guides/functions/limits), [invocations](https://supabase.com/docs/guides/platform/manage-your-usage/edge-function-invocations)).

## 4. Domain setup (one-time)

1. Buy a cheap domain (~US$10/yr `.com`, Cloudflare Registrar at cost) or reuse one the owner already has.
2. Add it in Resend using a sending subdomain (e.g. `cal.example.com`); publish the DKIM TXT and SPF/MX records Resend shows.
3. Add a DMARC record yourself (Resend does not create one): start with `v=DMARC1; p=none; rua=mailto:dmarc@example.com`.
4. ORGANIZER = `calendar@cal.example.com`, the same address as `From`.

## 5. Pitfalls

1. **UID drift → duplicates.** Regenerating the UID (or building it from mutable data like the date) creates a new event instead of updating. Store it per appointment.
2. **SEQUENCE not increasing → update ignored.** Exchange treats a REQUEST with an equal/lower SEQUENCE as stale or a mere reconfirmation. Persist and increment.
3. **`method` parameter missing or mismatched** with `METHOD:` → arrives as a plain `.ics` attachment, not an invite.
4. **Organizer = attendee.** If ORGANIZER were the owner's own work address, Outlook would treat the owner as the organizer (no Accept, can look like spoofing). Organizer must be our sending address.
5. **Junk / quarantine.** Unauthenticated or `resend.dev` mail to a corporate tenant is likely junked; a junked invite is not processed. Custom domain with SPF+DKIM+DMARC is the mitigation; ask the owner to mark the first one "Not junk" / add the sender to safe senders.
6. **Tenant policy can block external invites** (mail-flow rules). Not detectable from our side; test early.
7. **Tentative until accepted.** Until the owner clicks Accept, free/busy shows Tentative, not Busy. After a time change Outlook may ask for re-acceptance; with `X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY` it should go back to Busy after accepting **[verify in spike]**.
8. **Time zones.** Use UTC `Z` times; don't hand-write a VTIMEZONE for Asia/Jerusalem.
9. **Privacy leak through the subject/body/filename.** Everything in the email is retained by the employer. Neutral title only, no doctor, clinic, or reason anywhere, including the attachment filename.
10. **Line folding / CRLF.** iCalendar lines must end in CRLF and be folded at 75 octets (RFC 5545 3.1). Use a library (e.g. `ical-generator` or hand-rolled with tests) rather than string concatenation.
11. **Idempotency.** A retried Edge Function must not send two different SEQUENCEs for one change: increment SEQUENCE in the same DB transaction that records the outgoing email, and send with Resend's `Idempotency-Key`.

## 6. Suggested spike (before committing)

One Edge Function, one test domain, three sends to the work mailbox: REQUEST (seq 0) → accept in Outlook → REQUEST with new time (seq 1) → CANCEL (seq 2). Check: lands in Inbox not Junk; shows Accept; free/busy is Busy after accept; the update moves the same event (no duplicate); the cancel frees the slot. If Resend's attachment isn't treated as an invite, switch the same payload to Mailgun's raw MIME endpoint.

## Sources

- RFC 5545 iCalendar: https://www.rfc-editor.org/rfc/rfc5545.html
- RFC 5546 iTIP: https://www.rfc-editor.org/rfc/rfc5546.html
- RFC 6047 iMIP: https://www.rfc-editor.org/rfc/rfc6047.html
- MS-OXCICAL (UID, busy status, examples): https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxcical/
- Set-CalendarProcessing: https://learn.microsoft.com/powershell/module/exchange/set-calendarprocessing
- Supabase Edge Function limits: https://supabase.com/docs/guides/functions/limits
- Resend pricing / 403 KB / SDK types: https://resend.com/pricing, https://resend.com/docs/knowledge-base/403-error-resend-dev-domain
- Postmark calendar invites / pricing: https://postmarkapp.com/support/article/1101-how-do-i-send-calendar-invites-with-postmark, https://postmarkapp.com/pricing
- Mailgun pricing / sending: https://www.mailgun.com/pricing/, https://documentation.mailgun.com/docs/mailgun/user-manual/sending-messages/send-http
