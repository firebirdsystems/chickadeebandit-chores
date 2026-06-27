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
WHERE c.week = strftime('%G-W%V', 'now')
ORDER BY c.completed_at DESC
LIMIT 200
