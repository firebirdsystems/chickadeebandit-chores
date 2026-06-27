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
  frequency    TEXT NOT NULL DEFAULT 'weekly',  -- 'weekly' | 'daily'
  created_at   TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- `day` is part of the PK so daily chores can be completed once per calendar
-- day: a weekly chore stores day = '' (one row per week, exactly as before),
-- a daily chore stores day = 'YYYY-MM-DD' (up to one row per day). `week` is
-- set on every row so weekly rollups stay a simple `WHERE week = ?` filter.
-- (Each household has its own database, so no household_id column is needed.)
CREATE TABLE IF NOT EXISTS app_chore_tracker__completions (
  chore_id     TEXT NOT NULL,
  member_id    TEXT NOT NULL,
  week         TEXT NOT NULL,
  day          TEXT NOT NULL DEFAULT '',
  completed_at TEXT NOT NULL,
  PRIMARY KEY (chore_id, member_id, week, day)
);
