-- settings uses a natural key — household_id is part of the PK to prevent
-- cross-household key collisions (e.g. both households have key='theme').
CREATE TABLE IF NOT EXISTS app_chore_tracker__settings (
  key          TEXT NOT NULL,
  value        TEXT NOT NULL,
  PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS app_chore_tracker__chores (
  id           TEXT NOT NULL,
  name         TEXT NOT NULL,
  points       INTEGER NOT NULL DEFAULT 5,
  assigned_to  TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- Composite PK includes household_id so two households don't collide on
-- the same (chore_id, member_id, week) tuple.
CREATE TABLE IF NOT EXISTS app_chore_tracker__completions (
  chore_id     TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  week         TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (chore_id, member_id, week)
);
