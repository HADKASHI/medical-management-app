# Alert rules

When the app notifies the owner, and what each notification leads to. Terms follow [GLOSSARY.md](../../GLOSSARY.md); entities follow [data-model.md](data-model.md).

Constraints from the iPhone push research: iOS web push has **no action buttons**, so every action happens on a screen the notification opens; the **backend sends every push at its due time** (no on-device scheduling); and every push shows a notification (no silent push).

## Two kinds

| | **Reminder** | **Alert** |
|---|---|---|
| About | something to do now | a condition that lasts until fixed |
| Kinds | Dose, Appointment | Low Stock, Authorization expiring / expired |
| Sent | at its own exact time | only at the **Daily Alert Time** |
| In-app | the screen it opens | the **Alerts list**, for as long as the condition holds |

The Alerts list is the source of truth for Alerts; pushes only point at it, so a lost or swiped push loses nothing.

## Settings (app-wide)

| setting | default |
|---|---|
| Daily Alert Time | 09:00 |
| Authorization lead times | 30, 7 and 0 days before `expires_on` |

All times are wall-clock Asia/Jerusalem. Everything else below is fixed, not a setting. There are no per-item overrides.

## Dose Reminder

- **Trigger:** a Dose's `due_at`. As Needed Doses get no Reminder.
- **Grouping:** all Doses due in the same minute share one push ("Medication A, Medication B due").
- **Re-send:** if any Dose from the push is still pending 30 minutes later, one re-send. Nothing after that.
- **Snooze:** fixed 30 minutes, repeatable. Snoozing replaces the pending re-send with a push 30 minutes from the snooze. No snooze or re-send is sent after the Confirmation Window ends.
- **Tap:** opens **Due Doses**, listing every still-pending Dose from that push, each with **Taken / Skip / Snooze**, plus **All taken**.
- **Confirmation Window:** a pending Dose becomes *missed* at the earlier of **24 hours after `due_at`** or the `due_at` of the **next Dose of the same Stock Item**. No push when it becomes missed. A missed Dose can still be changed to taken.

## Appointment Reminder

- **Triggers:** two Reminders per Appointment:
  - **Evening before:** 20:00 the day before `starts_at`.
  - **Before leaving:** `starts_at − buffer_before_minutes − 60 min`.
- **Not sent** for cancelled Appointments. A Reminder whose time has already passed when the Appointment is created or moved is skipped, not sent late.
- **Snooze:** none.
- **Tap:** opens the Appointment's detail (time, location, notes).

## Low Stock Alert

- **Trips** when `quantity ≤ low_stock_threshold`. **Clears** (and re-arms) when quantity rises above the threshold, through a Restock, a Stock Count or a threshold change.
- **Pushes:** at the first Daily Alert Time after it trips, then every 7 days at the Daily Alert Time while it stays low.
- **Negative stock:** no separate Alert. The Low Stock Alert reads as a prompt to count, e.g. "Medication A: −2 pills, do a Stock Count".
- **Tap:** the Alerts list.

## Authorization Alert

- **Applies** only to Authorizations that are neither renewed nor archived.
- **Pushes:** at the Daily Alert Time on each lead-time day (30, 7, 0 days before `expires_on`). The Alert sits in the list from the first lead time on.
- **Created late:** an Authorization created already inside a lead time fires only its current tier, at the next Daily Alert Time. Passed tiers are not back-filled.
- **Expired:** after `expires_on`, an unrenewed Authorization stays in the list as **Expired**, with no further pushes.
- **Renewal or archive:** the old one's Alert leaves the list at once. The new Authorization runs its own lead times.
- **Tap:** the Alerts list.

## Daily Alert Time push

All Alert pushes due on the same day go in **one** push summarising them ("2 items low, 1 Authorization expiring"). No push if none are due that day, even when the list is not empty.

## Cross-cutting rules

- **No quiet hours.** Reminders fire at their time; Alerts are already limited to the Daily Alert Time; iOS Focus covers the night.
- **No snooze or dismiss** for Alerts or Appointment Reminders. An Alert leaves the list only when its condition clears.
- **Edits re-evaluate at once.** Changing a threshold, a quantity, `expires_on`, an Appointment's time or Travel Buffers re-evaluates Alerts and reschedules Reminders. A threshold raised above current stock trips the Alert, pushed at the next Daily Alert Time. A moved Appointment gets new Reminders.
- **Archiving a Stock Item:** its Alerts leave the list and no more pushes go out for it; no new Doses are created; Doses still pending are marked *skipped*.
- **Badge:** the Home Screen badge shows pending Doses plus Alerts in the list. It is updated with every push and when the app opens.
