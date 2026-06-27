SELECT
  id,
  name,
  points,
  assigned_to,
  frequency,
  created_at
FROM app_chore_tracker__chores
ORDER BY name
LIMIT 200
