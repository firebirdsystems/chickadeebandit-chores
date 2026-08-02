-- Automation support for the `add_chore` action.
--
-- `source_event_id` records which app event produced the row. The dispatcher's
-- dedupe guard matches on it (SELECT 1 FROM ... WHERE source_event_id = ?
-- LIMIT 1), so one event can never be applied twice — a retried or replayed
-- delivery finds the existing row and skips.
--
-- Nullable on purpose: rows created by a person in the UI have no source event,
-- and the guard only ever looks for a specific non-null id.
ALTER TABLE app_chore_tracker__chores ADD COLUMN source_event_id TEXT;

CREATE INDEX IF NOT EXISTS app_chore_tracker__idx_chores_source_event_id
  ON app_chore_tracker__chores(source_event_id);
