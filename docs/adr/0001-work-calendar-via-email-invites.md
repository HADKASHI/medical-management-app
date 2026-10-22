# Work calendar via email invites, not Microsoft Graph

Appointments must block the owner's work free/busy, but the work Microsoft 365 tenant won't let users register apps or consent to calendar access, and IT won't approve one. So the backend emails standard iCalendar invites (`METHOD:REQUEST`/`CANCEL`, a stable UID per appointment, an increasing SEQUENCE) to the work address. A Copilot calendar instruction in the owner's Outlook, scoped to the app's sender address, accepts them automatically. Invites always carry the neutral title "Personal appointment"; real details stay in the app.

## Considered Options

- **Microsoft Graph on the work calendar**: blocked; the tenant needs admin consent and the account can't register apps.
- **ICS feed subscription**: read-only, separate overlay calendar, refreshes every few hours to over a day, and doesn't block free/busy.
- **Graph on a personal Outlook.com calendar**: real-time, but doesn't block work free/busy.

## Consequences

- The app needs a stable sender on our own domain (the Copilot rule is scoped to it) and an email-sending service.
- The app can't tell whether an invite was accepted. If the Copilot instruction is removed or changes behaviour, invites just wait in the inbox for a manual accept.
- Whether updates and cancellations are applied through the instruction is still to be confirmed during the build.
