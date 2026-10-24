# Reports

What the Reports screen shows, decided in [What do the reports show?](https://github.com/HADKASHI/medical-management-app/issues/16) by reacting to a throwaway prototype (branch `prototype/reports`, variant A). Terms follow [GLOSSARY.md](../../GLOSSARY.md); entities follow [data-model.md](data-model.md). History is read from the records themselves ([ADR 0002](../adr/0002-history-derived-from-records.md)).

## Layout

One **Reports** screen with three tabs: **Doses**, **Renewals**, **Visits**. Each tab has its own filter at the top. The same layout works on iPhone and desktop. Desktop only gets wider cards, with no separate desktop layout.

| Tab | Filter | Shows |
|---|---|---|
| Doses | Stock Item (default: all) + month (‹ ›) | Remaining, then Dose history per medication |
| Renewals | Stock Item (default: all) | Authorization renewal chains with their Restocks |
| Visits | Provider (default: all) | Visit Summaries of past Appointments |

There is **no period filter** and **no custom date range**. The Doses tab steps through calendar months, starting at the current month, and can't go into the future. The other two tabs list everything, newest first.

## Doses tab

### Remaining

The first section of the tab. It has one row per non-archived Stock Item (medications and supplies), filtered by the Stock Item filter, with these columns:

- **Item:** the name.
- **Left:** current `quantity` with its Unit.
- **Red at or below:** `low_stock_threshold`.

A row is **red** when `quantity ≤ low_stock_threshold`, the same condition that trips the Low Stock Alert ([alert-rules.md](alert-rules.md)). Negative quantities show as they are, for example "−2 pills". Remaining always shows **now**, whichever month is selected.

### Dose history

Below Remaining there is one card per medication, filtered by the Stock Item filter, for the selected month:

- **Scheduled medications:** counts of *taken*, *skipped* and *missed* Doses (missed in red), then a grid with **rows = Dose Times** and **columns = days of the month**. Each cell is coloured by the Dose's status (taken, skipped, missed or pending). A day with no Dose due is an empty outline. Tapping a cell shows the date, due time, status and `taken_at`.
- **As Needed medications:** the number of Doses taken in the month, plus a list of their dates and times. There is no grid.
- The grid rows come from the Dose Times of the schedule versions in force that month. A Dose Time that existed for only part of the month shows its days and leaves the other days empty.
- **No adherence percentage.** The report shows counts and the grid only.
- A colour legend sits at the bottom of the tab.

Supplies have no Doses, so they appear only in Remaining.

## Renewals tab

One card per **current** Authorization (one that hasn't been renewed). Archived ones are included, so past history stays visible:

- Header: what it `covers`, its expiry date and the days left (red under 30 days, matching the 30-day Authorization Alert), its type, and the number of previous Renewals.
- A vertical chain from the newest Authorization back to the oldest. Each entry shows `reference_number`, `issued_on` → `expires_on`, and *current* or *renewed*.
- Under each Authorization in the chain are the Restocks filled under it (date, quantity and Unit).
- The Stock Item filter keeps chains whose Authorizations point at that item. Authorizations with no Stock Item (Form 17s and Commitments for treatments) show only when the filter is *all*.

Restocks with no Authorization, and Stock Counts, don't appear in reports.

## Visits tab

Past Appointments (status *done*; cancelled ones are left out), newest first, filtered by Provider. The Provider list holds the distinct `provider` values of past Appointments. Each card shows:

- the title, date, Provider, and the Authorization's `reference_number` if one is linked;
- the `visit_summary`, or "No visit summary yet" with a link to add one.

## Export and print

**None.** Reports are on-screen only: no PDF, CSV or print stylesheet. A full machine-readable copy of the data comes from **Export all data** in Settings ([backups-export.md](backups-export.md)).

## Data access

Each tab reads its records through RLS-protected queries or RPCs, the same way as the rest of the app ([stack.md](stack.md), [privacy-security.md](privacy-security.md)). There are no report tables and no precomputed aggregates. A month of Doses is small enough to count on the client.
