-- ════════════════════════════════════════════════════════════
-- fix_naveen_compensation.sql
-- One-time repair for compensation rows corrupted by the
-- is_current/effective_to bug in the old POST /compensation
-- handler (every save blanket-overwrote ALL prior rows'
-- effective_to with the new row's effective_from, instead of
-- only closing out the chronologically adjacent row). This
-- only touches the 3 known-bad rows for this one employee from
-- testing — not a general migration, since the underlying bug
-- is now fixed in routes.ts and won't recur for future saves.
-- ════════════════════════════════════════════════════════════

-- Row 1: 2026-06-18, £0.001 — should close out the day before the next entry starts
UPDATE employee_compensation
SET is_current = 0, effective_to = '2026-06-19'
WHERE id = 'f3fef4b2-a57c-4aa9-aa20-4bc5672c57bb';

-- Row 2: 2026-06-19, £1 — was superseded same-day by Row 3, never current going forward
UPDATE employee_compensation
SET is_current = 0, effective_to = '2026-06-19'
WHERE id = 'bf39d6d0-0002-4598-aa49-a749dde5151d';

-- Row 3: 2026-06-19, £0.001 — the last save of the day, this is the genuinely current one
UPDATE employee_compensation
SET is_current = 1, effective_to = NULL
WHERE id = '4abfe059-e908-4022-be2e-9642ddca6e69';
