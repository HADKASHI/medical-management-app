# Medical Management

One person's medication and supply stock, the authorizations that let them get it, and their medical appointments.

## Language

### Stock

**Stock Item**:
A medication or medical supply the owner keeps on hand, counted in a single **Unit**.
_Avoid_: Medication (for the general entity), product, supply item, drug

**Kind**:
Whether a **Stock Item** is a *medication* (has a strength, e.g. "50 mg") or a *supply* (test strips, syringes).
_Avoid_: Type, category

**Unit**:
What one counts of a **Stock Item**: pill, ml, strip, piece. Quantities may be fractional.
_Avoid_: Measure, package

**Low-Stock Threshold**:
The quantity at or below which a **Stock Item** is considered running out.
_Avoid_: Minimum, reorder point

**Pack Size**:
How many **Units** come in one pack of a **Stock Item**, used to enter **Restocks** in packs.
_Avoid_: Box size

**Restock**:
Adding a picked-up quantity to a **Stock Item**, optionally under the **Authorization** it was filled with.
_Avoid_: Refill, purchase, dispensing

**Stock Count**:
Setting a **Stock Item**'s quantity to what was physically counted, recording the difference.
_Avoid_: Adjustment, correction, inventory

**Archived**:
No longer in use: hidden from daily views and alerts, but kept in history.
_Avoid_: Deleted, inactive

### Dosing

**Dose Schedule**:
When a medication is due and how many **Units** each time: fixed daily times, certain weekdays, every N days, or **As Needed**.
_Avoid_: Regimen, plan, frequency

**As Needed**:
A **Dose Schedule** with no due times; doses are logged only when taken.
_Avoid_: PRN, on demand

**Dose**:
One due or logged intake of a medication, with an amount and a status: *pending*, *taken*, *skipped* or *missed*. Only *taken* reduces stock.
_Avoid_: Intake, administration

**Missed**:
A **Dose** not confirmed within its confirmation window; it can still be changed to *taken* later.
_Avoid_: Overdue, forgotten

### Authorizations

**Authorization**:
An HMO document with an expiry that entitles the owner to a medication or a treatment: a *prescription*, a *Form 17*, or a *commitment*.
_Avoid_: Approval, permit, document, prescription (for the general entity)

**Form 17**:
An **Authorization** (טופס 17) from the HMO covering a specific treatment, test or visit with a provider.
_Avoid_: Referral

**Commitment**:
An **Authorization** (התחייבות) in which the HMO commits to cover a treatment or supply, typically for a period or number of sessions.
_Avoid_: Approval, coverage

**Renewal**:
Replacing an expiring **Authorization** with a new one that points back to it; the old one becomes *renewed* and stops alerting.
_Avoid_: Extension, update

### Appointments

**Appointment**:
A scheduled medical visit or treatment with a provider, with a start and an end.
_Avoid_: Meeting, event, visit (for the entity)

**Provider**:
The doctor, clinic or therapist an **Appointment** is with, as free text.
_Avoid_: Doctor (for the general term)

**Travel Buffer**:
Time blocked on the work calendar before or after an **Appointment**, beyond its actual start and end.
_Avoid_: Padding, margin

**Visit Summary**:
The owner's notes on what happened at an **Appointment**, written after it.
_Avoid_: Notes (for this specific meaning)

**Work Calendar Invite**:
The neutral-titled calendar invitation the app emails to the owner's work address so an **Appointment** blocks their time.
_Avoid_: Sync, Outlook event
