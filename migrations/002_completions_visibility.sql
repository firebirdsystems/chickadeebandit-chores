-- Add a visibility column to completions so the row policy can be
-- `owner_or_visibility`: every completion is household-visible ('everyone', the
-- default), so glance/widget/child dashboards keep reading household-wide, while
-- WRITES are owner-scoped — a non-adult may only insert/update/delete their OWN
-- completion rows (adults still mark any member, e.g. login-less kids). This
-- blocks a member forging or deleting another member's completions via raw /api/db.
-- 'visibility' is in the encryption skip-list, so it stays plaintext for the policy.
ALTER TABLE app_chore_tracker__completions
  ADD COLUMN visibility TEXT NOT NULL DEFAULT 'everyone';
