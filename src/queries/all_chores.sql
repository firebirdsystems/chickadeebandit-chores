SELECT
  id,
  name,
  points,
  assigned_to,
  created_at
FROM chores
WHERE household_id = current_setting('app.household_id', true)::uuid
ORDER BY name
LIMIT 200
