SELECT
  c.chore_id,
  c.member_id,
  c.week,
  c.completed_at,
  ch.name   AS chore_name,
  ch.points AS chore_points
FROM completions c
JOIN chores ch
  ON ch.id           = c.chore_id
  AND ch.household_id = c.household_id
WHERE c.household_id = current_setting('app.household_id', true)::uuid
  AND c.week = to_char(CURRENT_DATE, 'IYYY-"W"IW')
ORDER BY c.completed_at DESC
LIMIT 200
