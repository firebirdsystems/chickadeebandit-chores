CREATE INDEX IF NOT EXISTS app_chore_tracker__completions_retention_idx
  ON app_chore_tracker__completions (completed_at);
