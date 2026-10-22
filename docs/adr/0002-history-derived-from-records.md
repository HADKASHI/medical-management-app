# History is derived from domain records, not a log table

The PRD proposed a generic `History Logs` table (`TAKE_MEDICATION`, `RENEW_PRESCRIPTION`, `APPOINTMENT_SUMMARY`). We dropped it: every fact it would hold already lives in a domain record (Doses, Restocks, the Authorization renewal chain, past Appointments with Visit Summaries), so reports query those directly. A second copy would drift from the records it describes, for example when a missed Dose is later corrected to taken. As a result, domain records are never hard-deleted in normal use; they are archived instead.
