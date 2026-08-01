SELECT
  c.chore_id,
  c.member_id,
  c.week,
  c.day,
  c.completed_at,
  ch.name   AS chore_name,
  ch.points AS chore_points
FROM app_chore_tracker__completions c
JOIN app_chore_tracker__chores ch
  ON ch.id = c.chore_id
-- `week` is stamped by the client from the household's LOCAL clock, so the
-- bucket has to be derived from :today (the household-local date) rather than
-- from SQLite's UTC clock — otherwise the week rolls over early and this
-- returns nothing for the tail of every Sunday west of UTC.
WHERE c.week = strftime('%G-W%V', :today)
ORDER BY c.completed_at DESC
LIMIT 200
